/**
 * SiteAgent — Embed Script
 *
 * Renders a modern chat widget directly in the host page using Shadow DOM.
 * All API calls go to the same origin as this script.
 *
 * Usage:
 *   <script src="https://your-agent.edgeone.app/embed.js" async></script>
 *
 * Options (data-* attributes):
 *   data-color    — Accent color (default: #6366f1)
 *   data-position — "bottom-right" (default) or "bottom-left"
 *   data-name     — Assistant display name
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.__chatAssistantLoaded) return;
  window.__chatAssistantLoaded = true;

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('embed.js') !== -1) return scripts[i];
    }
    return null;
  })();

  // ─── Configuration ───────────────────────────────────────────────────────
  var origin = '';
  if (script && script.src) {
    try { origin = new URL(script.src).origin; } catch (e) {}
  }
  if (!origin) return;

  var color = (script && script.getAttribute('data-color')) || '#6366f1';
  var position = (script && script.getAttribute('data-position')) || 'bottom-right';
  var assistantName = (script && script.getAttribute('data-name')) || '';
  var isLeft = position === 'bottom-left';
  var side = isLeft ? 'left' : 'right';

  // ─── I18n ────────────────────────────────────────────────────────────────
  var isZh = navigator.language && navigator.language.startsWith('zh');
  var t = {
    title: assistantName || (isZh ? 'AI 助手' : 'AI Assistant'),
    online: isZh ? '在线' : 'Online',
    placeholder: isZh ? '输入你的问题…' : 'Ask anything…',
    send: isZh ? '发送' : 'Send',
    stop: isZh ? '停止' : 'Stop',
    welcome: isZh ? '你好！有什么可以帮你的吗？' : 'Hi! How can I help you today?',
    thinking: isZh ? '思考中…' : 'Thinking…',
    clear: isZh ? '清空' : 'Clear',
    calling: isZh ? '正在查询' : 'Querying',
  };

  // ─── Extract page context ────────────────────────────────────────────────
  function getPageContext() {
    var el = document.querySelector('article') || document.querySelector('[role="main"]') || document.querySelector('main') || document.querySelector('.post-content') || document.querySelector('.entry-content');
    var content = el ? el.innerText : document.body.innerText;
    return {
      title: document.title || '',
      url: location.href || '',
      content: (content || '').slice(0, 6000)
    };
  }

  // ─── Conversation ID ─────────────────────────────────────────────────────
  var cid = '';
  try {
    var key = '__ca_cid';
    cid = localStorage.getItem(key) || '';
    if (!cid) {
      cid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
      localStorage.setItem(key, cid);
    }
  } catch (e) {}

  // ─── Markdown rendering ──────────────────────────────────────────────────
  function renderMd(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  // ─── Create Shadow DOM ───────────────────────────────────────────────────
  var host = document.createElement('div');
  host.id = '__site-agent-host';
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'closed' });

  // ─── Styles ──────────────────────────────────────────────────────────────
  var styles = document.createElement('style');
  styles.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .bubble {
      position: fixed; bottom: 24px; ${side}: 24px; z-index: 2147483647;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, ${color}, ${color}dd);
      cursor: pointer; border: none; outline: none;
      box-shadow: 0 8px 24px ${color}44, 0 2px 8px rgba(0,0,0,.1);
      display: flex; align-items: center; justify-content: center;
      transition: all .3s cubic-bezier(.4,0,.2,1);
    }
    .bubble:hover {
      transform: scale(1.1) translateY(-2px);
      box-shadow: 0 12px 32px ${color}55, 0 4px 12px rgba(0,0,0,.15);
    }
    .bubble:active { transform: scale(0.95); }
    .bubble svg { width: 28px; height: 28px; fill: #fff; transition: transform .3s; }
    .bubble.open svg { transform: rotate(90deg); }

    .panel {
      position: fixed; bottom: 100px; ${side}: 24px; z-index: 2147483647;
      width: 420px; height: 640px;
      max-height: calc(100vh - 120px); max-width: calc(100vw - 48px);
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04);
      background: #fff;
      display: none; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      overflow: hidden;
      animation: slideUp .3s cubic-bezier(.4,0,.2,1);
    }
    .panel.open { display: flex; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px) scale(.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (max-width: 480px) {
      .panel { width: 100vw; height: 100vh; max-height: 100vh; bottom: 0; ${side}: 0; border-radius: 0; }
      .bubble { bottom: 16px; ${side}: 16px; }
    }

    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; background: linear-gradient(135deg, ${color}, ${color}ee);
      color: #fff;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 36px; height: 36px; border-radius: 12px;
      background: rgba(255,255,255,.2); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700;
    }
    .header-name { font-size: 15px; font-weight: 600; }
    .header-status {
      font-size: 11px; opacity: .85; display: flex; align-items: center; gap: 5px; margin-top: 1px;
    }
    .header-status::before {
      content: ''; width: 7px; height: 7px; border-radius: 50%;
      background: #4ade80; box-shadow: 0 0 6px #4ade80;
    }
    .header-actions { display: flex; gap: 6px; }
    .header-btn {
      padding: 5px 10px; font-size: 11px; border-radius: 8px;
      background: rgba(255,255,255,.15); backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,.2);
      color: #fff; cursor: pointer; transition: all .2s;
    }
    .header-btn:hover { background: rgba(255,255,255,.25); }

    .messages {
      flex: 1; overflow-y: auto; padding: 20px;
      display: flex; flex-direction: column; gap: 16px;
      scroll-behavior: smooth;
    }
    .messages::-webkit-scrollbar { width: 4px; }
    .messages::-webkit-scrollbar-track { background: transparent; }
    .messages::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }

    .msg-row { display: flex; gap: 10px; max-width: 100%; animation: fadeIn .3s; }
    .msg-row.user { flex-direction: row-reverse; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

    .msg-avatar {
      width: 30px; height: 30px; border-radius: 10px;
      background: linear-gradient(135deg, ${color}, ${color}cc);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0;
    }
    .msg-bubble {
      border-radius: 16px; padding: 12px 16px; max-width: 80%;
      font-size: 14px; line-height: 1.65; word-break: break-word;
    }
    .msg-row.assistant .msg-bubble {
      background: #f4f4f5; color: #1f2937; border-top-left-radius: 4px;
    }
    .msg-row.user .msg-bubble {
      background: linear-gradient(135deg, ${color}, ${color}dd);
      color: #fff; border-top-right-radius: 4px;
    }
    .msg-bubble p { margin: 0.3em 0; }
    .msg-bubble h2, .msg-bubble h3, .msg-bubble h4 { margin: 0.6em 0 0.2em; font-weight: 600; }
    .msg-bubble h3 { font-size: 0.95em; }
    .msg-bubble h4 { font-size: 0.9em; }
    .msg-bubble code {
      background: rgba(0,0,0,.06); padding: 2px 6px; border-radius: 4px;
      font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.85em;
    }
    .msg-bubble pre {
      background: #1e293b; color: #e2e8f0; padding: 14px 16px;
      border-radius: 12px; overflow-x: auto; margin: 10px 0; font-size: 0.82em;
    }
    .msg-bubble pre code { background: none; padding: 0; color: inherit; }
    .msg-bubble ul, .msg-bubble ol { padding-left: 1.3em; margin: 0.3em 0; }
    .msg-bubble li { margin: 0.15em 0; }
    .msg-bubble strong { font-weight: 600; }

    .thinking {
      font-size: 13px; color: #9ca3af; display: flex; align-items: center; gap: 8px;
    }
    .dot-pulse { display: flex; gap: 4px; }
    .dot-pulse span {
      width: 5px; height: 5px; border-radius: 50%; background: ${color};
      animation: dotBounce .6s infinite alternate;
    }
    .dot-pulse span:nth-child(2) { animation-delay: .2s; }
    .dot-pulse span:nth-child(3) { animation-delay: .4s; }
    @keyframes dotBounce { from { opacity: .3; transform: translateY(0); } to { opacity: 1; transform: translateY(-4px); } }

    .tool-indicator {
      font-size: 12px; color: #6366f1; background: #eef2ff;
      padding: 6px 12px; border-radius: 10px; margin: 6px 0;
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid #e0e7ff;
    }
    .tool-indicator svg { width: 14px; height: 14px; fill: currentColor; animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    .input-area {
      padding: 16px 20px; border-top: 1px solid #f4f4f5;
      display: flex; gap: 10px; align-items: flex-end; background: #fafafa;
    }
    .input-area textarea {
      flex: 1; resize: none; border-radius: 14px; border: 1.5px solid #e5e7eb;
      background: #fff; padding: 12px 16px; font-size: 14px; outline: none;
      font-family: inherit; line-height: 1.4; transition: border-color .2s;
      min-height: 44px; max-height: 120px;
    }
    .input-area textarea:focus { border-color: ${color}; box-shadow: 0 0 0 3px ${color}15; }
    .input-area textarea::placeholder { color: #a1a1aa; }
    .send-btn {
      width: 44px; height: 44px; border-radius: 14px;
      background: linear-gradient(135deg, ${color}, ${color}dd);
      color: #fff; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all .2s; flex-shrink: 0;
    }
    .send-btn:hover { transform: scale(1.05); box-shadow: 0 4px 12px ${color}44; }
    .send-btn:active { transform: scale(0.95); }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
    .send-btn svg { width: 20px; height: 20px; fill: currentColor; }
    .send-btn.stop { background: linear-gradient(135deg, #ef4444, #dc2626); }
  `;
  shadow.appendChild(styles);

  // ─── Icons ───────────────────────────────────────────────────────────────
  var chatIcon = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>';
  var closeIcon = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
  var sendIcon = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  var stopIcon = '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  var spinIcon = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z"/></svg>';

  // ─── Bubble ──────────────────────────────────────────────────────────────
  var bubble = document.createElement('button');
  bubble.className = 'bubble';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.innerHTML = chatIcon;
  shadow.appendChild(bubble);

  // ─── Panel ───────────────────────────────────────────────────────────────
  var panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML =
    '<div class="header">' +
      '<div class="header-left">' +
        '<div class="avatar">AI</div>' +
        '<div><div class="header-name">' + t.title + '</div><div class="header-status">' + t.online + '</div></div>' +
      '</div>' +
      '<div class="header-actions"><button class="header-btn clear-btn" style="display:none">' + t.clear + '</button></div>' +
    '</div>' +
    '<div class="messages"></div>' +
    '<div class="input-area">' +
      '<textarea rows="1" placeholder="' + t.placeholder + '"></textarea>' +
      '<button class="send-btn" disabled>' + sendIcon + '</button>' +
    '</div>';
  shadow.appendChild(panel);

  var messagesEl = panel.querySelector('.messages');
  var textarea = panel.querySelector('textarea');
  var sendBtn = panel.querySelector('.send-btn');
  var clearBtn = panel.querySelector('.clear-btn');
  var isOpen = false;
  var isStreaming = false;
  var abortController = null;
  var messages = [];

  function showWelcome() {
    messagesEl.innerHTML =
      '<div class="msg-row assistant">' +
        '<div class="msg-avatar">AI</div>' +
        '<div class="msg-bubble"><p>' + t.welcome + '</p></div>' +
      '</div>';
  }
  showWelcome();

  // ─── Toggle ──────────────────────────────────────────────────────────────
  bubble.addEventListener('click', function () {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    bubble.classList.toggle('open', isOpen);
    bubble.innerHTML = isOpen ? closeIcon : chatIcon;
    if (isOpen) textarea.focus();
  });

  // ─── Clear ───────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', function () {
    messages = [];
    showWelcome();
    clearBtn.style.display = 'none';
    try { localStorage.removeItem('__ca_cid'); } catch (e) {}
    cid = '';
  });

  // ─── Input ───────────────────────────────────────────────────────────────
  var composing = false;
  textarea.addEventListener('compositionstart', function () { composing = true; });
  textarea.addEventListener('compositionend', function () { composing = false; });
  textarea.addEventListener('input', function () {
    sendBtn.disabled = !textarea.value.trim() || isStreaming;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });
  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !composing) {
      e.preventDefault();
      doSend();
    }
  });
  sendBtn.addEventListener('click', function () {
    if (isStreaming) { doStop(); } else { doSend(); }
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function addUserMsg(text) {
    var row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = '<div class="msg-bubble">' + escHtml(text) + '</div>';
    messagesEl.appendChild(row);
    scrollBottom();
  }

  function addAssistantMsg() {
    var row = document.createElement('div');
    row.className = 'msg-row assistant';
    row.innerHTML =
      '<div class="msg-avatar">AI</div>' +
      '<div class="msg-bubble"><div class="thinking"><div class="dot-pulse"><span></span><span></span><span></span></div></div></div>';
    messagesEl.appendChild(row);
    scrollBottom();
    return row.querySelector('.msg-bubble');
  }

  function addToolIndicator(container, toolName) {
    var el = document.createElement('div');
    el.className = 'tool-indicator';
    el.innerHTML = spinIcon + ' ' + t.calling + ' ' + toolName;
    container.appendChild(el);
    scrollBottom();
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }

  function scrollBottom() {
    requestAnimationFrame(function () {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // ─── Send ────────────────────────────────────────────────────────────────
  function doSend() {
    var text = textarea.value.trim();
    if (!text || isStreaming) return;
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;
    isStreaming = true;
    sendBtn.innerHTML = stopIcon;
    sendBtn.className = 'send-btn stop';
    clearBtn.style.display = 'inline-block';

    if (messages.length === 0) messagesEl.innerHTML = '';

    addUserMsg(text);
    messages.push({ role: 'user', content: text });

    var bubbleEl = addAssistantMsg();
    var assistantText = '';

    abortController = new AbortController();

    fetch(origin + '/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'makers-conversation-id': cid,
      },
      body: JSON.stringify({
        message: text,
        conversation_id: cid,
        pageContext: getPageContext(),
      }),
      signal: abortController.signal,
    }).then(function (res) {
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function readChunk() {
        return reader.read().then(function (result) {
          if (result.done) { finish(); return; }
          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (!line.startsWith('data: ')) continue;
            var payload = line.slice(6).trim();
            if (payload === '[DONE]') { finish(); return; }
            try {
              var event = JSON.parse(payload);
              if (event.type === 'text_delta' && event.delta) {
                assistantText += event.delta;
                bubbleEl.innerHTML = renderMd(assistantText);
                scrollBottom();
              } else if (event.type === 'tool_call' && event.tool) {
                addToolIndicator(bubbleEl, event.tool);
              } else if (event.type === 'error_message') {
                assistantText += '\n\u26a0\ufe0f ' + (event.content || 'Error');
                bubbleEl.innerHTML = renderMd(assistantText);
              }
            } catch (e) {}
          }
          return readChunk();
        });
      }
      return readChunk();
    }).catch(function (err) {
      if (err && err.name !== 'AbortError') {
        bubbleEl.innerHTML = '<p>\u26a0\ufe0f Failed to connect.</p>';
      }
      finish();
    });

    function finish() {
      isStreaming = false;
      abortController = null;
      sendBtn.innerHTML = sendIcon;
      sendBtn.className = 'send-btn';
      sendBtn.disabled = !textarea.value.trim();
      if (assistantText) messages.push({ role: 'assistant', content: assistantText });
    }
  }

  // ─── Stop ────────────────────────────────────────────────────────────────
  function doStop() {
    if (abortController) abortController.abort();
    fetch(origin + '/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: cid }),
    }).catch(function () {});
  }
})();
