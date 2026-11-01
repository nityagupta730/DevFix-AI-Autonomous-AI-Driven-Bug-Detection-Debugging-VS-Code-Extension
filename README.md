# My Copilot (Phase 1)

Features: AI Fix (lightbulb) + diff + Apply, Explain Code (Hinglish), Review File.

## Setup (ek baar)
1. Node.js install karo (nodejs.org, LTS).
2. Ollama install karo (ollama.com), phir terminal me:
   ollama pull qwen2.5-coder:7b
   (slow lage to: ollama pull qwen2.5-coder:3b aur VS Code settings me myai.ollama.model badlo)
3. Is folder ko VS Code me kholo, terminal me: npm install
4. F5 dabao -> naya "Extension Development Host" window khulega.

## Test
- Ctrl+Shift+P -> "AI: Test Model Connection"
- Koi file kholo jisme error ho -> error par cursor rakho -> 💡 -> "✨ AI Fix"
- Code select karo -> right click -> "AI: Explain Code"
- Ctrl+Shift+P -> "AI: Review File"

## Phase 2: Chat panel
- Left activity bar me "My Copilot" icon -> Chat panel
- Sawal puchho, ya /explain, /fix, /tests use karo
- Code select kiya ho to wahi use hota hai, warna poori file
- Jawab ke code block par Apply (diff dikhata hai) / New file / Copy button
- Ctrl+Shift+P -> "AI: Clear Chat" se nayi chat
