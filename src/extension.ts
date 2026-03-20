import * as vscode from 'vscode';
import * as referenceBuilder from './referenceBuilder';
import * as terminalManager from './terminalManager';

export function activate(context: vscode.ExtensionContext): void {
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
        return;
      }
      const ref = referenceBuilder.buildReference(editor);
      terminalManager.sendReference(ref);
      updateStatus();
    })
  );

  // Command: pin active terminal as Claude Code target
  context.subscriptions.push(
    vscode.commands.registerCommand('cc-cli-ext.pinTerminal', () => {
      terminalManager.pinCurrentTerminal(context);
      updateStatus();
      vscode.window.showInformationMessage('Terminal pinned as Claude Code target.');
    })
  );

  updateStatus();
}

export function deactivate(): void {}
