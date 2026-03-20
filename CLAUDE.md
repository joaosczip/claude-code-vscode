# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run compile      # compile TypeScript to out/
npm run watch        # compile in watch mode
npm run package      # package as .vsix (requires vsce)
```

There are no tests. The extension must be tested by running it in VS Code's Extension Development Host (F5).

## Architecture

This is a VS Code extension with 3 source files in `src/`, compiled to `out/`:

- **`extension.ts`** — entry point (`activate`/`deactivate`). Registers both commands, creates the status bar item, and wires up terminal lifecycle event listeners.
- **`terminalManager.ts`** — manages which terminal receives references. Terminal resolution priority: (1) pinned terminal by name (persisted in `workspaceState`), (2) any terminal whose name contains "claude" (case-insensitive), (3) active terminal. The pin is cleared automatically when the pinned terminal is closed.
- **`referenceBuilder.ts`** — builds `@path:line` strings from the active editor's selection. Paths are workspace-relative when a workspace is open, absolute otherwise. Line ranges are 1-based.

## Key behaviors

- `cc-cli-ext.sendReference` (keybinding: `Shift+Cmd+L`) — builds a reference string and calls `terminal.sendText(ref + ' ', false)`. The trailing space and `false` (no newline) allow the user to append more text before submitting.
- `cc-cli-ext.pinTerminal` — stores the active terminal's name in `workspaceState` so it survives reloads.
- The status bar item shows the currently targeted terminal name or a warning if none is found.
