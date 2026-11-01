My Copilot

A GitHub Copilot-style AI assistant for VS Code that runs locally using Ollama. No internet, API key or subscription needed, and your code never leaves your computer.

Features
AI Fix: click the lightbulb on an error, review the diff, and apply the fix
Explain Code: get a step-by-step explanation of selected code
Review File: find logic bugs and mark them as warnings
Chat panel: ask questions with /explain, /fix and /tests commands
Requirements
VS Code
Node.js (LTS)
Ollama, with the qwen2.5-coder:7b model
Setup
Install the model:
   ollama pull qwen2.5-coder:7b
Install dependencies:
   npm install
Open the folder in VS Code and press F5.
In the new [Extension Development Host] window, press Ctrl+Shift+P and run AI: Test Model Connection.
Usage
Fix an error: put the cursor on the error, press Ctrl+., choose AI Fix, then click Apply.
Explain code: select code, right-click, choose AI: Explain Code.
Review a file: run AI: Review File from the Command Palette.
Chat: open the My Copilot icon in the Activity Bar
