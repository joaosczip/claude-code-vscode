// Hook script: runs as a standalone Node.js process (PostToolUse · Write)
// NO vscode imports — this runs outside the extension host.
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c: string) => { input += c; });
process.stdin.on('end', main);

function main(): void {
  let data: { tool_input?: { file_path?: string } };
  try { data = JSON.parse(input); } catch { return; }

  const filePath = data?.tool_input?.file_path;
  if (!filePath || !filePath.includes('/plans/') || !filePath.endsWith('.md')) return;

  const lockDir = path.join(os.homedir(), '.claude', 'ide');
  let files: string[];
  try { files = fs.readdirSync(lockDir).filter((f: string) => f.endsWith('.lock')); } catch { return; }
  if (!files.length) return;

  let lockData: { authToken?: string };
  try { lockData = JSON.parse(fs.readFileSync(path.join(lockDir, files[0]), 'utf8')); } catch { return; }

  const { authToken } = lockData;
  const port = parseInt(files[0], 10);
  if (!authToken || !port) return;

  connectAndCall(port, authToken, filePath);
}

function connectAndCall(port: number, authToken: string, filePath: string): void {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  let msgId = 1;
  let initialized = false;
  const timeout = setTimeout(() => ws.terminate(), 5000);

  ws.on('open', () => {
    ws.send(JSON.stringify({
      jsonrpc: '2.0', id: msgId++, method: 'initialize',
      params: { protocolVersion: '2024-11-05', clientInfo: { name: 'open-plan-hook', version: '1' }, capabilities: {} },
    }));
  });

  ws.on('message', () => {
    if (!initialized) {
      initialized = true;
      ws.send(JSON.stringify({
        jsonrpc: '2.0', id: msgId++, method: 'tools/call',
        params: { name: 'openPlan', arguments: { filePath } },
      }));
      clearTimeout(timeout);
      setTimeout(() => ws.close(), 400);
    }
  });

  ws.on('error', () => clearTimeout(timeout));
  ws.on('close', () => clearTimeout(timeout));
}
