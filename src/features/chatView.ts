import * as vscode from 'vscode';
import { getBackend } from '../llm/backend';
import type { ChatMessage } from '../llm/backend';
import { previewAndApply } from './applyEdit';

type Mode = 'replace' | 'insert' | 'newfile';

interface Target {
  mode: Mode;
  uri?: vscode.Uri;
  range?: vscode.Range;
  version?: number;
  languageId?: string;
}

const FENCE = '```';
const MAX_CHARS = 12000;
const MAX_FULL_FIX_LINES = 300;

export class ChatViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'myai.chatView';

  private view?: vscode.WebviewView;
  private history: ChatMessage[] = [];
  private abort?: AbortController;
  private lastDocUri?: string;
  private targets = new Map<number, Target>();
  private turn = 0;

  constructor(private readonly ctx: vscode.ExtensionContext) {
    const active = vscode.window.activeTextEditor;
    if (active && this.isReal(active.document)) {
      this.lastDocUri = active.document.uri.toString();
    }
    ctx.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(e => {
        if (e && this.isReal(e.document)) {
          this.lastDocUri = e.document.uri.toString();
        }
      })
    );
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    const media = vscode.Uri.joinPath(this.ctx.extensionUri, 'media');
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    view.webview.html = this.html(view.webview, media);

    view.webview.onDidReceiveMessage(async msg => {
      switch (msg.type) {
        case 'send':
          await this.handleSend(String(msg.text ?? ''));
          break;
        case 'stop':
          this.abort?.abort();
          break;
        case 'apply':
          await this.handleApply(Number(msg.turn), String(msg.code ?? ''));
          break;
        case 'copy':
          await vscode.env.clipboard.writeText(String(msg.code ?? ''));
          vscode.window.setStatusBarMessage('Code copy ho gaya', 2000);
          break;
      }
    });
  }

  clear() {
    this.abort?.abort();
    this.history = [];
    this.targets.clear();
    this.post({ type: 'clear' });
  }

  private post(msg: unknown) {
    this.view?.webview.postMessage(msg);
  }

  private isReal(doc: vscode.TextDocument) {
    return doc.uri.scheme === 'file' || doc.uri.scheme === 'untitled';
  }

  /** Chat panel me focus hone par bhi last kholi hui code file dhundhta hai. */
  private getEditor(): vscode.TextEditor | undefined {
    const active = vscode.window.activeTextEditor;
    if (active && this.isReal(active.document)) {
      return active;
    }
    if (this.lastDocUri) {
      const found = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === this.lastDocUri
      );
      if (found) {
        return found;
      }
    }
    return vscode.window.visibleTextEditors.find(e => this.isReal(e.document));
  }

  private async handleSend(text: string) {
    const m = text.match(/^\/(explain|fix|tests)\b\s*([\s\S]*)$/);
    const cmd = m ? (m[1] as 'explain' | 'fix' | 'tests') : undefined;
    const question = (m ? m[2] : text).trim();
    const editor = this.getEditor();
    const turn = ++this.turn;

    if (cmd && !editor) {
      this.post({ type: 'error', message: `Pehle koi code file kholo, phir /${cmd} chalao.` });
      return;
    }

    let codeBlock = '';
    let diagText = '';
    let label = '';
    let target: Target = { mode: 'newfile' };
    let langId = '';

    if (editor) {
      const doc = editor.document;
      const sel = editor.selection;
      const hasSel = !sel.isEmpty;
      const fullRange = new vscode.Range(
        0,
        0,
        doc.lineCount - 1,
        doc.lineAt(doc.lineCount - 1).text.length
      );
      const range = hasSel ? new vscode.Range(sel.start, sel.end) : fullRange;
      let code = doc.getText(range);
      langId = doc.languageId;

      if (cmd === 'fix' && !hasSel && doc.lineCount > MAX_FULL_FIX_LINES) {
        this.post({
          type: 'error',
          message: `File badi hai (${doc.lineCount} lines). Jo hissa fix karna hai use select karo, phir /fix chalao.`
        });
        return;
      }
      let truncated = false;
      if (code.length > MAX_CHARS) {
        if (cmd === 'fix') {
          this.post({
            type: 'error',
            message: 'Code bahut bada hai. Chhota hissa select karke /fix chalao.'
          });
          return;
        }
        code = code.slice(0, MAX_CHARS);
        truncated = true;
      }

      const diags = vscode.languages
        .getDiagnostics(doc.uri)
        .filter(d => !hasSel || range.intersection(d.range))
        .slice(0, 15)
        .map(d => `line ${d.range.start.line + 1}: ${d.message.split('\n')[0]}`);
      if (diags.length) {
        diagText = `\n\nEditor errors/warnings (file line numbers):\n${diags.join('\n')}`;
      }

      const name = doc.fileName.split(/[\\/]/).pop();
      label = hasSel
        ? `${name} (lines ${sel.start.line + 1}-${sel.end.line + 1} selected)`
        : `${name} (poori file${truncated ? ', shuru ka hissa' : ''})`;
      codeBlock = `\n\nFile: ${name}\n${FENCE}${langId}\n${code}\n${FENCE}`;

      if (cmd === 'tests') {
        target = { mode: 'newfile', languageId: langId };
      } else if (cmd === 'fix' || (hasSel && !truncated)) {
        target = { mode: 'replace', uri: doc.uri, range, version: doc.version, languageId: langId };
      } else {
        target = {
          mode: 'insert',
          uri: doc.uri,
          range: new vscode.Range(sel.active, sel.active),
          version: doc.version,
          languageId: langId
        };
      }
    }

    const cfg = vscode.workspace.getConfiguration('myai');
    const lang = cfg.get<string>('explainLanguage', 'Hinglish');
    const langRule =
      lang === 'Hinglish'
        ? 'Reply in simple Hinglish (Hindi written in Roman letters mixed with English technical words). Keep code, identifiers and code comments in English.'
        : 'Reply in simple English.';
    const system =
      `You are My Copilot, an expert programming assistant inside VS Code. ${langRule} ` +
      `Be concise. Always put code inside fenced markdown code blocks with the language name.`;

    let task: string;
    const extra = question ? ` Extra instructions from the user: ${question}` : '';
    switch (cmd) {
      case 'explain':
        task =
          'Explain this code step by step: what it does, how the logic flows, and any bugs or improvements you notice.' +
          extra;
        break;
      case 'fix':
        task =
          'Fix the errors and bugs in this code. First give a 1-2 line explanation of what was wrong, then ONE code block ' +
          'with the complete corrected code (same scope as given, nothing omitted).' +
          extra;
        break;
      case 'tests':
        task =
          'Write unit tests for this code using the standard test framework for the language ' +
          '(pytest for Python, jest for JavaScript/TypeScript, JUnit for Java, etc). Give ONE code block with the full test file.' +
          extra;
        break;
      default:
        task = question;
    }

    const userContent = task + codeBlock + diagText;
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...this.history.slice(-6),
      { role: 'user', content: userContent }
    ];

    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.targets.set(turn, target);
    this.post({ type: 'start', turn, mode: target.mode, label });

    let reply = '';
    try {
      await getBackend().chatStream(
        messages,
        t => {
          reply += t;
          this.post({ type: 'token', text: t });
        },
        signal
      );
      this.history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
      if (this.history.length > 12) {
        this.history.splice(0, this.history.length - 12);
      }
    } catch (e: any) {
      if (!(signal.aborted || e?.name === 'AbortError')) {
        this.post({ type: 'error', message: e?.message ?? String(e) });
      }
    } finally {
      this.abort = undefined;
      this.post({ type: 'done' });
    }
  }

  private async handleApply(turn: number, code: string) {
    const t = this.targets.get(turn);
    if (!t) {
      vscode.window.showWarningMessage('Ye jawab pehle hi apply ho chuka hai ya purana ho gaya.');
      return;
    }

    if (t.mode === 'newfile') {
      const d = await vscode.workspace.openTextDocument({ content: code, language: t.languageId });
      await vscode.window.showTextDocument(d, vscode.ViewColumn.Beside);
      return;
    }

    const doc = await vscode.workspace.openTextDocument(t.uri!);
    if (doc.version !== t.version) {
      vscode.window.showWarningMessage(
        'File sawal puchne ke baad badal gayi hai. Dobara sawal bhejo, phir Apply karo.'
      );
      return;
    }
    const ok = await previewAndApply(doc, t.range!, code, 'Chat');
    if (ok) {
      this.targets.delete(turn);
    }
  }

  private html(webview: vscode.Webview, media: vscode.Uri): string {
    const js = webview.asWebviewUri(vscode.Uri.joinPath(media, 'chat.js'));
    const css = webview.asWebviewUri(vscode.Uri.joinPath(media, 'chat.css'));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${css}">
</head>
<body>
  <div id="chat"></div>
  <div id="chips">
    <button data-cmd="/explain ">/explain</button>
    <button data-cmd="/fix ">/fix</button>
    <button data-cmd="/tests ">/tests</button>
  </div>
  <div id="inputRow">
    <textarea id="input" rows="2" placeholder="Kuch puchho... (Enter = bhejo, Shift+Enter = nayi line)"></textarea>
    <button id="send">Send</button>
    <button id="stop" hidden>Stop</button>
  </div>
  <script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
  }
}
