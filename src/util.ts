import * as vscode from 'vscode';

/** Model ke jawab se ```markdown fences hatata hai. */
export function stripFences(text: string): string {
  const t = text.trim();
  const m = t.match(/```[\w+#.-]*\r?\n([\s\S]*?)```/);
  if (m) {
    return m[1].replace(/\r?\n$/, '');
  }
  return t;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Cancel button wala progress notification. Error aaye to message dikhata hai. */
export async function runWithProgress<T>(
  title: string,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T | undefined> {
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title, cancellable: true },
    async (_progress, token) => {
      const ac = new AbortController();
      token.onCancellationRequested(() => ac.abort());
      try {
        return await fn(ac.signal);
      } catch (e: any) {
        if (ac.signal.aborted || e?.name === 'AbortError') {
          return undefined;
        }
        vscode.window.showErrorMessage(`My Copilot: ${e?.message ?? e}`);
        return undefined;
      }
    }
  );
}
