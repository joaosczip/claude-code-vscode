import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { logger } from './logger';

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
  fs.writeFileSync(lockPath, JSON.stringify(content), { encoding: 'utf8', mode: 0o600 });
  logger.debug(`ideLock: lock file written at ${lockPath}`);
  return lockPath;
}

export function deleteLockFile(lockPath: string): void {
  try {
    fs.unlinkSync(lockPath);
    logger.debug(`ideLock: lock file deleted at ${lockPath}`);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }
}
