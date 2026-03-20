import * as vscode from 'vscode';

let pinnedTerminalName: string | undefined;

export function initFromWorkspaceState(context: vscode.ExtensionContext): void {
  pinnedTerminalName = context.workspaceState.get<string>('cc-cli-ext.pinnedTerminalName');
}

export function pinCurrentTerminal(context: vscode.ExtensionContext): void {
  const terminal = vscode.window.activeTerminal;
  if (!terminal) {
    vscode.window.showWarningMessage('No active terminal to pin.');
    return;
  }
  pinnedTerminalName = terminal.name;
  context.workspaceState.update('cc-cli-ext.pinnedTerminalName', terminal.name);
}

export function getTargetTerminal(): vscode.Terminal | undefined {
  const terminals = vscode.window.terminals;

  if (terminals.length === 0) {
    return undefined;
  }

  // 1. Pinned terminal by name
  if (pinnedTerminalName) {
    const pinned = terminals.find(t => t.name === pinnedTerminalName);
    if (pinned) {
      return pinned;
    }
    // Terminal was closed — clear pin
    pinnedTerminalName = undefined;
  }

  // 2. Terminal with "claude" in name (case-insensitive)
  const claudeTerminal = terminals.find(t =>
    t.name.toLowerCase().includes('claude')
  );
  if (claudeTerminal) {
    return claudeTerminal;
  }

  // 3. Active terminal
  return vscode.window.activeTerminal;
}

export function sendReference(reference: string): void {
  const terminal = getTargetTerminal();
  if (!terminal) {
    vscode.window.showWarningMessage(
      "No Claude Code terminal found. Open a terminal running 'claude' or use 'Pin as Claude Code Terminal'."
    );
    return;
  }
  terminal.sendText(reference + ' ', false);
}

export function getStatusText(): string {
  const terminal = getTargetTerminal();
  if (terminal) {
    return `$(terminal) Claude: ${terminal.name}`;
  }
  return '$(warning) Claude: not connected';
}
