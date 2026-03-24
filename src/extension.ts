import * as vscode from 'vscode';
import * as referenceBuilder from './referenceBuilder';
import * as terminalManager from './terminalManager';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(logger);
  logger.info('cc-cli-ext activating');

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

  updateStatus();
}

export function deactivate(): void {}
