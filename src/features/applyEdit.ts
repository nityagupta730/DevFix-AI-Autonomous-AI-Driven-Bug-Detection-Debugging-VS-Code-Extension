import * as vscode from 'vscode';
import * as path from 'path';

// Diff view ke liye in-memory virtual documents
const store = new Map<string, string>();

class VirtualDocProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    return store.get(uri.path) ?? '';
  }
}

export function registerDiffProvider(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('myai', new VirtualDocProvider())
  );
}

/**
 * Diff dikhata hai (purana vs naya), user se Apply/Cancel puchta hai,
 * Apply par WorkspaceEdit se code badalta hai (Ctrl+Z se undo hota hai).
 */
export async function previewAndApply(
  doc: vscode.TextDocument,
  range: vscode.Range,
  newText: string,
  title = 'AI Suggestion'
): Promise<boolean> {
  const original = doc.getText(range);
  const versionAtStart = doc.version;
  const id = `${Date.now()}`;
  const ext = path.extname(doc.fileName);
  const leftPath = `/original-${id}${ext}`;
  const rightPath = `/proposed-${id}${ext}`;
  store.set(leftPath, original);
  store.set(rightPath, newText);

  const left = vscode.Uri.from({ scheme: 'myai', path: leftPath });
  const right = vscode.Uri.from({ scheme: 'myai', path: rightPath });

  await vscode.commands.executeCommand(
    'vscode.diff',
    left,
    right,
    `${title}: Original ↔ Suggestion`,
    { preview: true }
  );

  const choice = await vscode.window.showInformationMessage(
    'Ye change apply karein? (Diff dekh lo)',
    'Apply',
    'Cancel'
  );

  await closeDiffTab(right);
  store.delete(leftPath);
  store.delete(rightPath);

  if (choice !== 'Apply') {
    return false;
  }
  if (doc.version !== versionAtStart) {
    vscode.window.showWarningMessage(
      'File suggestion ke dauran badal gayi, isliye apply nahi kiya. Dobara try karo.'
    );
    return false;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(doc.uri, range, newText);
  const ok = await vscode.workspace.applyEdit(edit);
  if (ok) {
    vscode.window.showInformationMessage('Fix apply ho gaya. (Ctrl+Z se undo kar sakte ho)');
  }
  return ok;
}

async function closeDiffTab(modified: vscode.Uri) {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (
        tab.input instanceof vscode.TabInputTextDiff &&
        tab.input.modified.toString() === modified.toString()
      ) {
        await vscode.window.tabGroups.close(tab);
        return;
      }
    }
  }
}
