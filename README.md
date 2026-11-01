My Copilot

A GitHub Copilot-style AI coding assistant for Visual Studio Code that runs entirely on your own machine. It uses Ollama to run an open-source code model locally, so it needs no internet connection, no API key and no subscription, and your code never leaves your computer.

Table of Contents
Features
How It Works
Requirements
Getting Started
Usage
Commands
Settings
Project Structure
Troubleshooting
Limitations
Roadmap
Team
Features
Feature	Description
AI Fix	Click the lightbulb on any error and choose AI Fix. The extension reads the error and the code around it, asks the model for a corrected version, and shows a side-by-side diff.
Diff preview and Apply	No change is made without your approval. Apply replaces the code through VS Code's edit API, so Ctrl+Z undo works.
Explain Code	Select code and run AI: Explain Code for a step-by-step explanation in plain language: what the code does, how the logic flows, and any bugs or improvements.
Review File	Scans a file for logic bugs that compilers do not report (for example division by zero) and marks them as warnings in the editor. Each warning can be fixed with AI Fix.
Chat panel	A sidebar chat with streaming responses. It automatically attaches the selected code (or the whole file) and the file's diagnostics.
Slash commands	/explain, /fix and /tests in the chat. Code blocks in answers have Copy and Apply buttons.
Ghost text (inline completion)	Grey inline suggestions while you type, accepted with Tab. Uses a small fill-in-the-middle model for speed.
Local and private	All inference happens on your machine through Ollama.
How It Works
VS Code editor
   │  (VS Code API: read code, errors, selection)
   ▼
My Copilot extension  (TypeScript, Node.js)
   │  builds a prompt from the code and error context
   │  HTTP request to localhost:11434
   ▼
Ollama  (local model server)
   │
   ▼
Qwen2.5-Coder model  (runs on your CPU or GPU)
   │
   ▼
Extension cleans the answer
   │  (VS Code API: diff view, WorkspaceEdit)
   ▼
You review the diff and click Apply

Key design decisions

Pluggable backend. All model calls go through a small LLMBackend interface (chat and chatStream). Ollama is the default implementation, and another provider can be added by writing one new file.
Minimal context. Only the code around an error is sent, not the whole project, which keeps responses faster.
Human in the loop. AI output is always shown as a diff before anything is applied.
Separate models for separate jobs. A larger model handles chat and fixes, and a small fill-in-the-middle model handles ghost text so typing stays responsive.
Requirements
Requirement	Details
VS Code	Version 1.90 or newer
Node.js	LTS version (nodejs.org)
Ollama	Installed and running (ollama.com)
Models	qwen2.5-coder:7b (about 4.7 GB) for chat and fixes; qwen2.5-coder:1.5b-base (about 1 GB) for ghost text
Memory	16 GB RAM recommended. 8 GB works with the smaller qwen2.5-coder:3b model.

A dedicated GPU is optional but makes responses much faster. Without one, the model runs on the CPU and responses take longer.

Getting Started

1. Clone the repository

bash
git clone https://github.com/<your-username>/my-copilot.git
cd my-copilot

2. Install dependencies

bash
npm install

3. Download the models

bash
ollama pull qwen2.5-coder:7b
ollama pull qwen2.5-coder:1.5b-base

If responses feel slow, use the smaller model for chat and fixes:

bash
ollama pull qwen2.5-coder:3b

and set myai.ollama.model to qwen2.5-coder:3b in VS Code settings.

4. Run the extension

Open the folder in VS Code and press F5. A second window titled [Extension Development Host] opens. Use the extension in that window.

5. Verify the connection

Press Ctrl+Shift+P and run AI: Test Model Connection. You should see "Model connected".

Usage
Fix an error
Place the cursor on a line with an error.
Press Ctrl+. or click the lightbulb.
Choose AI Fix.
Review the diff and click Apply.
Explain code

Select code, right-click, and choose AI: Explain Code. With no selection, the whole file is explained.

Review a file

Run AI: Review File from the Command Palette. Suspected bugs appear as yellow warnings.

Chat

Open the My Copilot icon in the Activity Bar.

Input	Result
A question	Answers using the selected code or current file as context
/explain	Explains the selected code or file
/fix	Returns a corrected version with an Apply button
/tests	Generates unit tests and opens them in a new file
Ghost text

Pause while typing and a grey suggestion appears. Press Tab to accept it. Click My AI in the status bar to turn it on or off.

Commands
Command	Purpose
AI: Explain Code	Explain selected code or the current file
AI: Review File	Find logic bugs and mark them as warnings
AI: Clear Review Markers	Remove review warnings
AI: Open Chat	Focus the chat panel
AI: Clear Chat	Start a new conversation
AI: Toggle Ghost Text Suggestions	Turn inline suggestions on or off
AI: Test Model Connection	Check that Ollama and the model respond
Settings

Open Settings (Ctrl+,) and search for myai.

Setting	Default	Description
myai.ollama.url	http://localhost:11434	Address of the Ollama server
myai.ollama.model	qwen2.5-coder:7b	Model used for chat, fixes, explain and review
myai.ollama.keepAlive	30m	How long the model stays loaded in memory
myai.ollama.preload	true	Load models in the background when VS Code starts
myai.explainLanguage	Hinglish	Language of explanations and chat replies (Hinglish or English). Set to English for English output.
myai.fixContextLines	10	Lines of context above and below an error
myai.inline.enabled	true	Enable ghost text suggestions
myai.inline.model	qwen2.5-coder:1.5b-base	Model used for ghost text
myai.inline.debounceMs	400	Pause (ms) after typing before requesting a suggestion
myai.inline.maxTokens	64	Maximum length of one suggestion
Project Structure
my-copilot/
├── package.json              Extension manifest: commands, settings, views
├── tsconfig.json
├── README.md
├── .vscode/                  Launch and build configuration for F5
├── media/
│   ├── chat.js               Chat panel front end
│   ├── chat.css              Chat panel styles
│   └── icon.svg              Activity Bar icon
└── src/
    ├── extension.ts          Entry point: registers all features
    ├── util.ts               Output cleanup and progress helpers
    ├── llm/
    │   ├── backend.ts        LLMBackend interface (swappable model provider)
    │   └── ollama.ts         Ollama implementation: chat, streaming, completion
    └── features/
        ├── quickFix.ts       Lightbulb AI Fix flow
        ├── applyEdit.ts      Diff preview and Apply
        ├── explain.ts        Explain Code command
        ├── review.ts         Review File command
        ├── chatView.ts       Chat panel (webview) logic
        └── inlineCompletion.ts   Ghost text provider
Troubleshooting
Problem	Solution
Cannot connect to Ollama	Make sure Ollama is running (check the taskbar icon), or run ollama serve.
Model not found	Run ollama pull <model name> for the model set in settings.
First response is very slow	The model is loading into memory. Run AI: Test Model Connection first to warm it up.
Responses are slow in general	Use qwen2.5-coder:3b, plug in the charger, close heavy applications.
Extension does not appear	Use the [Extension Development Host] window that opens after F5, not the original window.
No red error lines for Python	Install the Microsoft Python extension so VS Code can report Python errors.
Review File finds nothing	Small models sometimes return malformed output. Run it again or use a larger model.
Limitations
Without a GPU, a 7B model runs on the CPU and is noticeably slower than cloud-based assistants.
Local 7B models are less capable than large cloud models, especially on complex bugs.
Context is limited to the current file and its diagnostics, not the whole project.
AI output can be wrong. Always review the diff before applying.
Chat history is kept in memory only and is cleared when the window closes.
Roadmap
 AI Fix with diff preview and Apply
 Explain Code and Review File
 Chat panel with streaming and slash commands
 Ghost text inline completion
 Project-wide context (related files, imports, search)
 Agent mode (read files, edit, re-check errors in a loop)
 Additional backends (cloud API, vscode.lm)
 Package and publish as a .vsix
Team
Name	Responsibility
Member 1	Extension core, LLM backend
Member 2	AI Fix, Explain, Review
Member 3	Chat panel
Acknowledgements
Ollama for local model serving
Qwen2.5-Coder by the Qwen team for the open-source code models
The VS Code Extension API
