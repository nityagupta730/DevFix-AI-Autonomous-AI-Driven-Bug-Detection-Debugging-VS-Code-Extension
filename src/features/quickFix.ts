import * as vscode from 'vscode';
import { getBackend } from '../llm/backend';
import { previewAndApply } from './applyEdit';
import { runWithProgress, stripFences } from '../util';

/** Error par lightbulb me "AI Fix" dikhata hai. */
export class AIFixProvider implements vscode.CodeActionProvider {
  static readonly kinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    ctx: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    return ctx.diagnostics
      .filter(d => d.severity <= vscode.DiagnosticSeverity.Warning)
      .map(diag => {
        const short = diag.message.split('\n')[0].slice(0, 60);
        const action = new vscode.CodeAction(`✨ AI Fix: ${short}`, vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diag];
        action.command = {
          command: 'myai.applyFix',
          title: 'AI Fix',
          arguments: [document.uri, diag.range, diag.message]
        };
        return action;
      });
  }
}

export function registerFix(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'myai.applyFix',
      async (uri: vscode.Uri, errRange: vscode.Range, message: string) => {
        const doc = await vscode.workspace.openTextDocument(uri);
        const n = vscode.workspace.getConfiguration('myai').get<number>('fixContextLines', 10);

        // Error ke aaspaas ke lines (poori file nahi bhejte)
        const startLine = Math.max(0, errRange.start.line - n);
        const endLine = Math.min(doc.lineCount - 1, errRange.end.line + n);
        const ctxRange = new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length);
        const original = doc.getText(ctxRange);
        const errLineInSnippet = errRange.start.line - startLine + 1;

        const fixed = await runWithProgress('AI fix soch raha hai...', async signal => {
          const reply = await getBackend().chat(
            [
              {
                role: 'system',
                content:
                  `You are an expert ${doc.languageId} developer. You fix errors in code. ` +
                  'Return ONLY the corrected version of the given code snippet: same lines, minimal changes, ' +
                  'keep indentation and everything unrelated untouched. No explanations. No markdown fences.'
              },
              {
                role: 'user',
                content:
                  `Language: ${doc.languageId}\n` +
                  `Error (around line ${errLineInSnippet} of the snippet): ${message}\n\n` +
                  `Code snippet:\n${original}`
              }
            ],
            signal
          );
          return stripFences(reply);
        });

        if (fixed === undefined) {
          return;
        }
        if (!fixed.trim() || fixed === original) {
          vscode.window.showInformationMessage('AI ko koi change suggest karne layak nahi mila.');
          return;
        }
        await previewAndApply(doc, ctxRange, fixed, 'AI Fix');
      }
    )
  );
}
