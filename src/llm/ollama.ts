import * as vscode from 'vscode';
import type { ChatMessage, LLMBackend } from './backend';

export class OllamaBackend implements LLMBackend {
  name = 'Ollama';

  private async request(
    messages: ChatMessage[],
    stream: boolean,
    signal?: AbortSignal
  ): Promise<Response> {
    const cfg = vscode.workspace.getConfiguration('myai');
    const url = cfg.get<string>('ollama.url', 'http://localhost:11434');
    const model = cfg.get<string>('ollama.model', 'qwen2.5-coder:7b');

    let res: Response;
    try {
      res = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream,
          options: { temperature: 0.1 }
        }),
        signal
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw e;
      }
      throw new Error(
        `Ollama se connect nahi ho paya (${url}). Ollama chal raha hai? Terminal me "ollama serve" try karo.`
      );
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Ollama error ${res.status}: ${body}. Model "${model}" download kiya hai? (ollama pull ${model})`
      );
    }
    return res;
  }

  async chat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
    const res = await this.request(messages, false, signal);
    const data = (await res.json()) as any;
    return data.message?.content ?? '';
  }

  async chatStream(
    messages: ChatMessage[],
    onToken: (text: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await this.request(messages, true, signal);
    if (!res.body) {
      throw new Error('Ollama ne streaming jawab nahi diya.');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) {
          continue;
        }
        try {
          const obj = JSON.parse(line);
          const t = obj.message?.content;
          if (t) {
            onToken(t);
          }
        } catch {
          /* adhoora line, ignore */
        }
      }
    }
  }
}
