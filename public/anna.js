/**
 * Anna Widget — Faraday Construction AI chat
 * Embed on any partner website with:
 *   <script src="https://leads.faradaysun.com/anna.js"></script>
 *
 * Optional configuration (set before the script tag):
 *   <script>window.AnnaConfig = { primaryColor: '#f59e0b', position: 'right', greeting: 'Custom greeting...' }</script>
 */
(function () {
  'use strict';

  var API_BASE = 'https://leads.faradaysun.com';
  var cfg = window.AnnaConfig || {};
  var color = cfg.primaryColor || '#f59e0b';
  var position = cfg.position === 'left' ? 'left' : 'right';
  var greeting = cfg.greeting || "Hi! I'm Anna 👋 Are you a homeowner in Colorado? I can check if recent hail storms hit your area.";
  var sessionId = 'anna_' + Math.random().toString(36).slice(2);
  var messages = [];
  var isOpen = false;

  // ── Styles ────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#anna-bubble{position:fixed;bottom:20px;' + position + ':20px;width:56px;height:56px;border-radius:50%;background:' + color + ';cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:999999;border:none;transition:transform .2s}',
    '#anna-bubble:hover{transform:scale(1.08)}',
    '#anna-bubble svg{width:28px;height:28px;fill:#000}',
    '#anna-panel{position:fixed;bottom:88px;' + position + ':20px;width:320px;height:440px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;z-index:999998;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
    '#anna-panel.open{display:flex}',
    '#anna-header{background:' + color + ';padding:14px 16px;display:flex;align-items:center;gap:10px}',
    '#anna-header .anna-avatar{width:36px;height:36px;border-radius:50%;background:#000;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}',
    '#anna-header .anna-info strong{display:block;font-size:14px;font-weight:700;color:#000}',
    '#anna-header .anna-info span{font-size:11px;color:rgba(0,0,0,.6)}',
    '#anna-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}',
    '.anna-msg{max-width:82%;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.5;word-break:break-word}',
    '.anna-msg.anna{background:#f3f4f6;color:#111;align-self:flex-start;border-radius:4px 14px 14px 14px}',
    '.anna-msg.user{background:' + color + ';color:#000;align-self:flex-end;border-radius:14px 14px 4px 14px}',
    '.anna-typing{display:flex;gap:4px;padding:10px 13px;background:#f3f4f6;border-radius:4px 14px 14px 14px;align-self:flex-start;width:44px}',
    '.anna-typing span{width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:anna-bounce .8s infinite}',
    '.anna-typing span:nth-child(2){animation-delay:.15s}.anna-typing span:nth-child(3){animation-delay:.3s}',
    '@keyframes anna-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}',
    '#anna-input-row{padding:10px;border-top:1px solid #f3f4f6;display:flex;gap:8px}',
    '#anna-input{flex:1;border:1px solid #e5e7eb;border-radius:20px;padding:8px 14px;font-size:13px;outline:none;font-family:inherit}',
    '#anna-input:focus{border-color:' + color + '}',
    '#anna-send{background:' + color + ';border:none;border-radius:50%;width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '#anna-send svg{width:16px;height:16px;fill:#000}',
    '#anna-powered{text-align:center;font-size:10px;color:#9ca3af;padding:4px 0 8px}',
    '#anna-powered a{color:#9ca3af;text-decoration:none}',
  ].join('');
  document.head.appendChild(style);

  // ── DOM ───────────────────────────────────────────────────────────────────
  var bubble = document.createElement('button');
  bubble.id = 'anna-bubble';
  bubble.setAttribute('aria-label', 'Chat with Anna');
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

  var panel = document.createElement('div');
  panel.id = 'anna-panel';
  panel.innerHTML = [
    '<div id="anna-header">',
    '  <div class="anna-avatar">🤖</div>',
    '  <div class="anna-info"><strong>Anna</strong><span>Faraday Construction · AI Assistant</span></div>',
    '</div>',
    '<div id="anna-messages"></div>',
    '<div id="anna-input-row">',
    '  <input id="anna-input" type="text" placeholder="Type a message..." autocomplete="off" />',
    '  <button id="anna-send" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button>',
    '</div>',
    '<div id="anna-powered"><a href="https://faradaysun.com" target="_blank">Powered by Faraday AI</a></div>',
  ].join('');

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  var messagesEl = panel.querySelector('#anna-messages');
  var inputEl = panel.querySelector('#anna-input');
  var sendEl = panel.querySelector('#anna-send');

  // ── Helpers ───────────────────────────────────────────────────────────────
  function addMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'anna-msg ' + role;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    var dot = document.createElement('div');
    dot.className = 'anna-typing';
    dot.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(dot);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return dot;
  }

  async function sendMessage(userText) {
    if (!userText.trim()) return;
    messages.push({ role: 'user', content: userText });
    addMessage('user', userText);
    inputEl.value = '';

    var typingEl = showTyping();

    try {
      var res = await fetch(API_BASE + '/api/widget/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          session_id: sessionId,
          referrer: window.location.hostname,
        }),
      });

      var data = await res.json();
      typingEl.remove();

      var reply = data.reply || "Sorry, I'm having trouble connecting. Call us at (720) 766-1518!";
      messages.push({ role: 'assistant', content: reply });
      addMessage('anna', reply);
    } catch {
      typingEl.remove();
      addMessage('anna', "Sorry, can't connect right now. Call us at (720) 766-1518 for a free roof inspection!");
    }
  }

  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    if (messages.length === 0) {
      messages.push({ role: 'assistant', content: greeting });
      addMessage('anna', greeting);
    }
    setTimeout(function () { inputEl.focus(); }, 100);
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
  }

  // ── Events ────────────────────────────────────────────────────────────────
  bubble.addEventListener('click', function () {
    if (isOpen) closePanel(); else openPanel();
  });

  sendEl.addEventListener('click', function () {
    sendMessage(inputEl.value);
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage(inputEl.value);
  });

  // Auto-open after 30 seconds if user hasn't interacted
  if (!cfg.noAutoOpen) {
    setTimeout(function () {
      if (!isOpen) openPanel();
    }, 30000);
  }
})();
