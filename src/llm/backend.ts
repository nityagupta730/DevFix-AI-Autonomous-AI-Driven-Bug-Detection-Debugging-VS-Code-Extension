import { OllamaBackend } from './ollama';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMBackend {
  name: string;
  /** Poora jawab ek saath */
  chat(messages: ChatMessage[], signal?: AbortSignal): Promise<string>;
  /** Jawab word-by-word (streaming) */
  chatStream(
    messages: ChatMessage[],
    onToken: (text: string) => void,
    signal?: AbortSignal
  ): Promise<void>;
}

// Baad me yahan se backend badal sakte ho (Claude API, vscode.lm, ...)
export function getBackend(): LLMBackend {
  return new OllamaBackend();
}
