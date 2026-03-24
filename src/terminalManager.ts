import * as vscode from 'vscode';
import { logger } from './logger';

let pinnedTerminalName: string | undefined;

export function initFromWorkspaceState(context: vscode.ExtensionContext): void {
  pinnedTerminalName = context.workspaceState.get<string>('cc-cli-ext.pinnedTerminalName');
  logger.debug(`terminalManager: restored pinned terminal = ${pinnedTerminalName ?? 'none'}`);
}

export function pinCurrentTerminal(context: vscode.ExtensionContext): void {
  const terminal = vscode.window.activeTerminal;
  if (!terminal) {
    logger.warn('pinCurrentTerminal: no active terminal to pin');
    vscode.window.showWarningMessage('No active terminal to pin.');
    return;
  }
  pinnedTerminalName = terminal.name;
  logger.info(`pinCurrentTerminal: pinned "${terminal.name}"`);
  context.workspaceState.update('cc-cli-ext.pinnedTerminalName', terminal.name);
}

export function getTargetTerminal(): vscode.Terminal | undefined {
  const terminals = vscode.window.terminals;

  if (terminals.length === 0) {
    logger.trace('getTargetTerminal: no terminals open');
    return undefined;
  }

  // 1. Pinned terminal by name
  if (pinnedTerminalName) {
    const pinned = terminals.find(t => t.name === pinnedTerminalName);
    if (pinned) {
      logger.trace(`getTargetTerminal: resolved via pin → "${pinned.name}"`);
      return pinned;
    }
    // Terminal was closed — clear pin
    logger.debug(`getTargetTerminal: pinned terminal "${pinnedTerminalName}" no longer exists, clearing pin`);
    pinnedTerminalName = undefined;
  }

  // 2. Terminal with "claude" in name (case-insensitive)
  const claudeTerminal = terminals.find(t =>
    t.name.toLowerCase().includes('claude')
  );
  if (claudeTerminal) {
    logger.trace(`getTargetTerminal: resolved via name match → "${claudeTerminal.name}"`);
    return claudeTerminal;
  }

  // 3. Active terminal
  const active = vscode.window.activeTerminal;
  if (active) {
    logger.trace(`getTargetTerminal: resolved via active terminal → "${active.name}"`);
  } else {
    logger.trace('getTargetTerminal: no terminal resolved');
  }
  return active;
}

export function sendReference(reference: string): void {
  const terminal = getTargetTerminal();
  if (!terminal) {
    logger.warn('sendReference: no target terminal found');
    vscode.window.showWarningMessage(
      "No Claude Code terminal found. Open a terminal running 'claude' or use 'Pin as Claude Code Terminal'."
    );
    return;
  }
  logger.debug(`sendReference: sending to terminal "${terminal.name}"`);
  terminal.sendText(reference + ' ', false);
}

export function getStatusText(): string {
  const terminal = getTargetTerminal();
  if (terminal) {
    return `$(terminal) Claude: ${terminal.name}`;
  }
  return '$(warning) Claude: not connected';
}
