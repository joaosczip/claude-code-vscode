# Send Reference Feature — Design Spec

**Date:** 2026-03-20
**Extension:** cc-cli-ext (Claude Code VS Code Extension)

## Overview

The Send Reference feature lets users send file/line references from the VS Code editor to an active Claude Code terminal session. References use Claude Code's native `@mention` syntax.

## Commands

| Command | ID | Default Keybinding |
|---|---|---|
| Send Reference to Claude Code | `cc-cli-ext.sendReference` | `Shift+Cmd+L` (editorTextFocus) |
| Pin as Claude Code Terminal | `cc-cli-ext.pinTerminal` | — (status bar click) |

## Reference Syntax

Built by `referenceBuilder.buildReference(editor)`:

| Selection State | Output |
|---|---|
| No selection (cursor only) | `@relative/path/to/file.ts` |
| Single-line selection | `@relative/path/to/file.ts:5` |
| Multi-line selection | `@relative/path/to/file.ts:5-12` |

- Line numbers are 1-based
- Path is relative to workspace root via `vscode.workspace.asRelativePath()`
- Falls back to absolute path when no workspace is open

## Terminal Targeting

Managed by `terminalManager`. Priority order in `getTargetTerminal()`:

1. **Pinned terminal** — terminal previously pinned by name via `pinCurrentTerminal()`; cleared automatically if the terminal is closed
2. **Claude-named terminal** — any open terminal whose name contains "claude" (case-insensitive)
3. **Active terminal** — `vscode.window.activeTerminal`
4. **None** — warning message shown to user

Pinned terminal name is persisted to `context.workspaceState` under key `cc-cli-ext.pinnedTerminalName` and restored on activation.

## Status Bar

- Alignment: Right, priority 100
- Clicking the status bar item triggers `cc-cli-ext.pinTerminal`
- Text when connected: `$(terminal) Claude: [terminal name]`
- Text when disconnected: `$(warning) Claude: not connected`
- Updates on: terminal open, close, active terminal change

## Module Structure

```
src/
  extension.ts        — activation, command registration, status bar
  referenceBuilder.ts — builds @mention string from editor state
  terminalManager.ts  — finds target terminal, sends text, manages pin state
```

## sendText Behavior

`terminal.sendText(reference, false)` — the `false` flag means no newline is appended. The reference text is inserted at the current cursor position in the terminal prompt without submitting it, letting the user review and edit before pressing Enter.

## Entry Points

- Activation event: `onStartupFinished`
- Main: `./out/extension.js`
- VS Code engine: `^1.85.0`
