(function () {
  const vscode = acquireVsCodeApi();
  const chat = document.getElementById('chat');
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('send');
  const stopBtn = document.getElementById('stop');

  let busy = false;
  let cur = null;       // abhi stream hone wala jawab
  let lastUser = null;  // last user message element

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function inline(s) {
    return esc(s)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function applyLabel(mode) {
    return mode === 'newfile' ? 'New file' : mode === 'insert' ? 'Insert' : 'Apply';
  }

  // Chhota markdown renderer: ```code blocks``` + inline code + bold
  function render(text, mode) {
    const parts = text.split('```');
    let html = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        let code = parts[i];
        const nl = code.indexOf('\n');
        code = nl >= 0 ? code.slice(nl + 1) : '';
        code = code.replace(/\n$/, '');
        html +=
          '<div class="code"><div class="bar">' +
          '<button data-act="copy">Copy</button>' +
          '<button data-act="apply">' + applyLabel(mode) + '</button>' +
          '</div><pre><code>' + esc(code) + '</code></pre></div>';
      } else if (parts[i].trim()) {
        html += '<div class="text">' + inline(parts[i].trim()) + '</div>';
      }
    }
    return html;
  }

  function scrollDown() {
    chat.scrollTop = chat.scrollHeight;
  }

  function welcome() {
    const d = document.createElement('div');
    d.className = 'welcome';
    d.textContent =
      'Namaste! Editor me code kholo, phir sawal puchho ya /explain, /fix, /tests use karo. ' +
      'Code select kiya ho to wahi use hota hai, warna poori file.';
    chat.appendChild(d);
  }

  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    el.appendChild(b);
    chat.appendChild(el);
    lastUser = el;
    scrollDown();
  }

  function addError(message) {
    const el = document.createElement('div');
    el.className = 'msg error';
    el.textContent = '⚠ ' + message;
    chat.appendChild(el);
    scrollDown();
  }

  function setBusy(b) {
    busy = b;
    sendBtn.hidden = b;
    stopBtn.hidden = !b;
  }

  function send() {
    const t = input.value.trim();
    if (!t || busy) { return; }
    addUser(t);
    input.value = '';
    setBusy(true);
    vscode.postMessage({ type: 'send', text: t });
  }

  sendBtn.addEventListener('click', send);
  stopBtn.addEventListener('click', () => vscode.postMessage({ type: 'stop' }));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  document.getElementById('chips').addEventListener('click', e => {
    const b = e.target.closest('button[data-cmd]');
    if (!b) { return; }
    input.value = b.dataset.cmd;
    input.focus();
  });
  chat.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) { return; }
    const msg = btn.closest('.msg');
    const code = btn.closest('.code').querySelector('code').textContent;
    vscode.postMessage({ type: btn.dataset.act, turn: Number(msg.dataset.turn), code: code });
  });

  window.addEventListener('message', e => {
    const m = e.data;
    switch (m.type) {
      case 'start': {
        if (lastUser && m.label) {
          const n = document.createElement('div');
          n.className = 'ctxnote';
          n.textContent = '📎 ' + m.label;
          lastUser.appendChild(n);
        }
        const el = document.createElement('div');
        el.className = 'msg bot';
        el.dataset.turn = String(m.turn);
        chat.appendChild(el);
        cur = { el: el, text: '', mode: m.mode };
        scrollDown();
        break;
      }
      case 'token':
        if (cur) {
          cur.text += m.text;
          cur.el.innerHTML = render(cur.text, cur.mode);
          scrollDown();
        }
        break;
      case 'done':
        if (cur && !cur.text) { cur.el.textContent = '(khali jawab)'; }
        cur = null;
        setBusy(false);
        break;
      case 'error':
        addError(m.message);
        setBusy(false);
        break;
      case 'clear':
        chat.innerHTML = '';
        cur = null;
        setBusy(false);
        welcome();
        break;
    }
  });

  welcome();
})();
