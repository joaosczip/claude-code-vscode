# Claude Code — VS Code Extension

Send file and line references from VS Code directly into your Claude Code terminal session — without leaving the editor.

## What it does

When you're editing a file and want Claude to look at something specific, press `Shift+Cmd+L` (or right-click → **Send Reference to Claude Code**). The extension inserts an `@file:line` reference at the Claude prompt, ready for you to add context and submit.

| Selection | Inserted text |
|-----------|---------------|
| No selection (cursor only) | `@src/foo.ts ` |
| Single line selected | `@src/foo.ts:42 ` |
| Multi-line selected | `@src/foo.ts:42-57 ` |

The reference is typed into the terminal — not submitted — so you can complete your message before hitting Enter.

## Installation

### From the marketplace

> Coming soon.

### From source

```bash
git clone https://github.com/joaosczip/cc-cli-ext.git
cd cc-cli-ext
npm install
npm run package        # produces cc-cli-ext-*.vsix
```

Then in VS Code: **Extensions → ··· → Install from VSIX…** and select the generated file.

## Usage

### Automatic terminal detection

The extension finds your Claude terminal automatically:

1. **Pinned terminal** — if you've pinned one (see below), it always wins.
2. **Terminal named "claude"** — any terminal whose name contains the word "claude" (case-insensitive) is used.
3. **Active terminal** — falls back to whatever terminal is currently focused.

### Pinning a terminal

If you have multiple terminals open, pin the one running `claude` so references always go to the right place:

1. Focus the terminal running `claude`.
2. Open the Command Palette (`Cmd+Shift+P`) and run **Pin as Claude Code Terminal**.
   Or click the status bar item at the bottom right.

The pin is saved per workspace and survives VS Code restarts.

### Status bar

The bottom-right status bar shows the current target:

- `$(terminal) Claude: my-terminal` — connected and ready.
- `$(warning) Claude: not connected` — no suitable terminal found.

## Keybinding

| Command | Default keybinding | When |
|---------|--------------------|------|
| Send Reference to Claude Code | `Shift+Cmd+L` | Editor focused |

To change the keybinding, open **Keyboard Shortcuts** (`Cmd+K Cmd+S`) and search for `cc-cli-ext.sendReference`.

## Development

```bash
npm install
npm run watch     # recompile on save
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

## Requirements

- VS Code 1.85 or later
- [Claude Code](https://github.com/anthropics/claude-code) running in an integrated terminal

## License

MIT
