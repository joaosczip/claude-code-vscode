import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as referenceBuilder from './referenceBuilder';
import * as terminalManager from './terminalManager';
import { findFreePort } from './portFinder';
import { writeLockFile, deleteLockFile } from './ideLock';
import { startMcpServer } from './mcpServer';
import { installHooks } from './hookInstaller';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(logger);
  logger.info('cc-cli-ext activating');

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    installHooks(context.extensionPath, workspaceRoot);
    logger.debug(`hooks installed for workspace: ${workspaceRoot}`);
  } else {
    logger.debug('no workspace root — skipping hook installation');
  }
  let launching = false;

  // Restore persisted pin from workspace state
  terminalManager.initFromWorkspaceState(context);

  // Status bar item — clicking it pins the active terminal
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.command = 'cc-cli-ext.pinTerminal';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const updateStatus = (): void => {
    statusBar.text = terminalManager.getStatusText();
  };

  // Update status on terminal lifecycle events
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(updateStatus),
    vscode.window.onDidCloseTerminal(updateStatus),
    vscode.window.onDidChangeActiveTerminal(updateStatus),
  );

  // Command: send @reference to Claude terminal
  context.subscriptions.push(
    vscode.commands.registerCommand('cc-cli-ext.sendReference', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        logger.debug('sendReference: no active editor, skipping');
        return;
      }
      const ref = referenceBuilder.buildReference(editor);
      logger.debug(`sendReference: sending "${ref}"`);
      terminalManager.sendReference(ref);
      updateStatus();
    })
  );

  // Command: pin active terminal as Claude Code target
  context.subscriptions.push(
    vscode.commands.registerCommand('cc-cli-ext.pinTerminal', () => {
      logger.info('pinTerminal: pinning active terminal');
      terminalManager.pinCurrentTerminal(context);
      updateStatus();
      vscode.window.showInformationMessage('Terminal pinned as Claude Code target.');
    })
  );

  // Command: launch Claude with MCP server
  context.subscriptions.push(
    vscode.commands.registerCommand('cc-cli-ext.launchClaude', async () => {
      if (launching) {
        logger.warn('launchClaude: already launching, ignoring');
        vscode.window.showWarningMessage('Claude is already launching.');
        return;
      }
      logger.info('launchClaude: starting');
      launching = true;

      let lockPath: string | undefined;
      let server: { close(): void } | undefined;
      let cleaned = false;

      const cleanup = (): void => {
        if (cleaned) { return; }
        cleaned = true;
        logger.debug('launchClaude: cleanup triggered');
        if (lockPath) { deleteLockFile(lockPath); }
        if (server) { server.close(); }
        launching = false;
      };

      try {
        const authToken = crypto.randomUUID();
        const port = await findFreePort();
        lockPath = writeLockFile(port, authToken);
        logger.debug(`launchClaude: MCP server on port ${port}, lockPath=${lockPath}`);
        server = await startMcpServer(port, authToken);

        const terminal = vscode.window.createTerminal({ name: 'Claude' });
        terminal.show();
        terminal.sendText('claude', true);

        const closeListener = vscode.window.onDidCloseTerminal(t => {
          if (t === terminal) { closeListener.dispose(); cleanup(); }
        });
        context.subscriptions.push(closeListener, { dispose: cleanup });
      } catch (err: unknown) {
        logger.error(`launchClaude: failed — ${String(err)}`);
        cleanup();
        vscode.window.showErrorMessage(`Failed to launch Claude: ${String(err)}`);
      }
    })
  );

  updateStatus();
}

export function deactivate(): void {}
