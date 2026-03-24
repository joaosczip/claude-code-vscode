import * as vscode from 'vscode';

export function buildReference(editor: vscode.TextEditor): string {
  // 1. Get file path relative to workspace root
  const fileUri = editor.document.uri;
  const filePath = fileUri.fsPath;

  let relativePath: string;
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders && workspaceFolders.length > 0) {
    relativePath = vscode.workspace.asRelativePath(fileUri, false);
  } else {
    // If no workspace, use the full file path
    relativePath = filePath;
  }

  // 2. Get selection
  const selection = editor.selection;
  const startLine = selection.start.line;
  const endLine = selection.end.line;
  const isEmpty = selection.start.isEqual(selection.end);

  // 3. Build @mention string
  // Convert 0-based line numbers to 1-based
  if (isEmpty) {
    // No selection (empty/cursor): return `@relativePath`
    return `@${relativePath}`;
  } else if (startLine === endLine) {
    // Single-line selection: return `@relativePath:line` (1-based)
    return `@${relativePath}#${startLine + 1}`;
  } else {
    // Multi-line selection: return `@relativePath:startLine-endLine` (1-based)
    return `@${relativePath}#${startLine + 1}-${endLine + 1}`;
  }
}
