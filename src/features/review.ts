import * as vscode from 'vscode';
import { getBackend } from '../llm/backend';
import { runWithProgress } from '../util';

const MAX_LINES = 400;
let collection: vscode.DiagnosticCollection;

interface Issue {
  line: number;
  problem: string;
}

function parseIssues(raw: string): Issue[] {
  const s = raw.indexOf('[');
  const e = raw.lastIndexOf(']');
  if (s < 0 || e < s) {
    return [];
  }
  try {
    const arr = JSON.parse(raw.slice(s, e + 1));
    return Array.isArray(arr)
      ? arr.filter(i => typeof i?.line === 'number' && typeof i?.problem === 'string')
      : [];
  } catch {
    return [];
  }
}

export function registerReview(context: vscode.ExtensionContext) {
  collection = vscode.languages.createDiagnosticCollection('ai-review');
  context.subscriptions.push(collection);

  // File edit hone par line numbers badal jaate hain, isliye purane markers hata do
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => collection.delete(e.document.uri)),
    vscode.workspace.onDidCloseTextDocument(d => collection.delete(d.uri))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('myai.clearReview', () => collection.clear()),

    vscode.commands.registerCommand('myai.reviewFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Pehle koi file kholo.');
        return;
      }
      const doc = editor.document;
      const total = doc.lineCount;
      const used = Math.min(total, MAX_LINES);
      const numbered: string[] = [];
      for (let i = 0; i < used; i++) {
        numbered.push(`${i + 1}: ${doc.lineAt(i).text}`);
      }
      if (total > MAX_LINES) {
        vscode.window.showInformationMessage(
          `File badi hai, sirf pehli ${MAX_LINES} lines review hongi.`
        );
      }

      const raw = await runWithProgress('AI file review kar raha hai...', signal =>
        getBackend().chat(
          [
            {
              role: 'system',
              content:
                'You are a strict code reviewer. Find real bugs, logic errors and risky code. ' +
                'Respond with ONLY a JSON array, no markdown, no extra text: ' +
                '[{"line": <line number>, "problem": "<short description>"}]. ' +
                'If there are no problems respond with []. Maximum 10 items.'
            },
            {
              role: 'user',
              content: `Language: ${doc.languageId}\nCode (each line is prefixed with its line number):\n${numbered.join('\n')}`
            }
          ],
          signal
        )
      );
      if (raw === undefined) {
        return;
      }

      const issues = parseIssues(raw).filter(i => i.line >= 1 && i.line <= doc.lineCount);
      if (issues.length === 0) {
        collection.delete(doc.uri);
        vscode.window.showInformationMessage('AI review: koi problem nahi mili (ya model ka jawab samajh nahi aaya).');
        return;
      }

      collection.set(
        doc.uri,
        issues.map(i => {
          const d = new vscode.Diagnostic(
            doc.lineAt(i.line - 1).range,
            i.problem,
            vscode.DiagnosticSeverity.Warning
          );
          d.source = 'AI Review';
          return d;
        })
      );
      vscode.window.showInformationMessage(
        `AI review: ${issues.length} issue(s) mile. Peeli lakeer par 💡 dabao aur AI Fix chalao.`
      );
    })
  );
}
