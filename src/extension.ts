import * as vscode from 'vscode';
import { AIFixProvider, registerFix } from './features/quickFix';
import { registerDiffProvider } from './features/applyEdit';
import { registerExplain } from './features/explain';
import { registerReview } from './features/review';
import { ChatViewProvider } from './features/chatView';
import { getBackend } from './llm/backend';
import { runWithProgress } from './util';

export function activate(context: vscode.ExtensionContext) {
  registerDiffProvider(context);
  registerFix(context);
  registerExplain(context);
  registerReview(context);

  const chat = new ChatViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chat, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand('myai.openChat', () =>
      vscode.commands.executeCommand('myai.chatView.focus')
    ),
    vscode.commands.registerCommand('myai.clearChat', () => chat.clear()),
    vscode.languages.registerCodeActionsProvider(
      [{ scheme: 'file' }, { scheme: 'untitled' }],
      new AIFixProvider(),
      { providedCodeActionKinds: AIFixProvider.kinds }
    ),

    vscode.commands.registerCommand('myai.testConnection', async () => {
      const reply = await runWithProgress('Model se connect ho raha hai...', signal =>
        getBackend().chat([{ role: 'user', content: 'Reply with just the word OK.' }], signal)
      );
      if (reply !== undefined) {
        vscode.window.showInformationMessage(`Model connected ✅ Jawab: ${reply.trim().slice(0, 60)}`);
      }
    })
  );
}

export function deactivate() {}
