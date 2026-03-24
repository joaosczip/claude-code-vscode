import * as http from 'http';
import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';

export interface McpServer {
  port: number;
  close(): void;
}

// --- JSON-RPC helpers ---

function jsonRpcResult(id: number | string, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function jsonRpcError(
  id: number | string,
  code: number,
  message: string
): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

// --- Tool: openPlan ---

async function handleOpenPlan(
  filePath: string
): Promise<{ content: Array<{ type: string; text: string }>; isError: boolean } | string> {
  const plansDir = path.join(os.homedir(), '.claude', 'plans') + path.sep;
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(plansDir) || !resolved.endsWith('.md')) {
    return { content: [{ type: 'text', text: 'Error: invalid plan file path' }], isError: true };
  }
  await vscode.commands.executeCommand(
    'markdown.showPreviewToSide',
    vscode.Uri.file(resolved)
  );
  return 'Plan opened in VS Code preview.';
}

// --- MCP message dispatcher ---

async function handleMessage(
  raw: string,
  send: (msg: string) => void
): Promise<void> {
  let msg: {
    jsonrpc: string;
    id?: number | string;
    method?: string;
    params?: unknown;
  };

  try {
    msg = JSON.parse(raw);
  } catch {
    // Malformed JSON — ignore (no id to reply to)
    return;
  }

  const { id, method, params } = msg;

  // Notifications (no id) — no response needed
  if (id === undefined || id === null) {
    return;
  }

  if (method === 'initialize') {
    send(
      jsonRpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'vscode-mcp', version: '0.0.1' },
      })
    );
    return;
  }

  if (method === 'tools/list') {
    send(
      jsonRpcResult(id, {
        tools: [
          {
            name: 'openPlan',
            description:
              'Opens a markdown plan file in VS Code as a preview panel.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description:
                    'Absolute path to the markdown plan file to open.',
                },
              },
              required: ['filePath'],
            },
          },
        ],
      })
    );
    return;
  }

  if (method === 'tools/call') {
    const p = params as { name?: string; arguments?: { filePath?: string } };
    if (p?.name !== 'openPlan') {
      send(
        jsonRpcResult(id, {
          content: [{ type: 'text', text: 'Error: unknown tool' }],
          isError: true,
        })
      );
      return;
    }

    const filePath = p?.arguments?.filePath;
    if (!filePath) {
      send(
        jsonRpcResult(id, {
          content: [{ type: 'text', text: 'Error: missing filePath argument' }],
          isError: true,
        })
      );
      return;
    }

    try {
      const result = await handleOpenPlan(filePath);
      if (typeof result === 'string') {
        send(
          jsonRpcResult(id, {
            content: [{ type: 'text', text: result }],
            isError: false,
          })
        );
      } else {
        send(jsonRpcResult(id, result));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      send(
        jsonRpcResult(id, {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        })
      );
    }
    return;
  }

  // Unknown method
  send(jsonRpcError(id, -32601, 'Method not found'));
}

// --- Server factory ---

export function startMcpServer(
  port: number,
  authToken: string
): Promise<McpServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(426, 'Upgrade Required', { 'Content-Length': '0' });
      res.end();
    });

    const wss = new WebSocketServer({
      server,
      maxPayload: 1024 * 1024, // 1 MB
      verifyClient: (
        { req }: { req: http.IncomingMessage },
        cb: (result: boolean, code?: number, message?: string) => void
      ) => {
        const expected = `Bearer ${authToken}`;
        const authHeader = (req.headers['authorization'] ?? '') as string;
        const a = Buffer.from(authHeader.padEnd(expected.length, '\0'));
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          cb(false, 401, 'Unauthorized');
          return;
        }
        cb(true);
      },
    });

    wss.on('connection', (ws: WebSocket) => {
      ws.on('message', (data: Buffer | string) => {
        const raw = Buffer.isBuffer(data) ? data.toString('utf8') : data;
        handleMessage(raw, (msg) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
          }
        }).catch((err: unknown) => {
          console.error('[mcpServer] unhandled error in message handler:', err);
        });
      });
    });

    server.once('error', reject);

    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);

      resolve({
        port,
        close(): void {
          wss.clients.forEach((client) => client.terminate());
          wss.close();
          server.close();
        },
      });
    });
  });
}
