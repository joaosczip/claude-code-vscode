import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

const lockDir = path.join(os.homedir(), '.claude', 'ide');

export function writeLockFile(port: number, authToken: string): string {
  fs.mkdirSync(lockDir, { recursive: true });
  const lockPath = path.join(lockDir, `${port}.lock`);
  const content = {
    pid: process.pid,
    workspaceFolders: (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath),
    ideName: 'VS Code',
    transport: 'ws',
    runningInWindows: process.platform === 'win32',
    authToken,
  };
  fs.writeFileSync(lockPath, JSON.stringify(content), 'utf8');
  return lockPath;
}

export function deleteLockFile(lockPath: string): void {
  try { fs.unlinkSync(lockPath); } catch { /* already gone */ }
}
