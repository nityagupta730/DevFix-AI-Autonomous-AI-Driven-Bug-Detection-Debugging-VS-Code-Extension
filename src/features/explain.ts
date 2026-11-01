import * as vscode from 'vscode';
import { getBackend } from '../llm/backend';
import { escapeHtml, runWithProgress } from '../util';

export function registerExplain(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('myai.explain', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Pehle koi file kholo.');
        return;
      }
      const doc = editor.document;
      const code = editor.selection.isEmpty
        ? doc.getText()
        : doc.getText(editor.selection);

      const lang = vscode.workspace.getConfiguration('myai').get<string>('explainLanguage', 'Hinglish');
      const langRule =
        lang === 'Hinglish'
          ? 'Explain in simple Hinglish (Hindi written in Roman/English letters, mixed with English technical words).'
          : 'Explain in simple English.';

      const text = await runWithProgress('AI code samajh raha hai...', signal =>
        getBackend().chat(
          [
            {
              role: 'system',
              content:
                `You are a patient programming teacher. ${langRule} ` +
                'Structure: 1) Short summary of what the code does. 2) Step-by-step logic. ' +
                '3) Any bugs, edge cases or improvements you notice (say "koi bug nahi mila" / "no bugs found" if none).'
            },
            { role: 'user', content: `Language: ${doc.languageId}\n\nCode:\n${code}` }
          ],
          signal
        )
      );
      if (text === undefined) {
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        'myaiExplain',
        'Code Explanation',
        vscode.ViewColumn.Beside,
        {}
      );
      panel.webview.html = `<!DOCTYPE html>
<html><body style="padding:12px;">
<pre style="white-space:pre-wrap;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);line-height:1.5;">${escapeHtml(text)}</pre>
</body></html>`;
    })
  );
}
