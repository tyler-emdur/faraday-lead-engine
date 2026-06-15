/**
 * Anna Widget v2 — Faraday Construction
 * Embed on any partner website:
 *   <script src="https://leads.faradaysun.com/anna-widget.js" data-partner="your-slug"></script>
 *
 * Config (optional, set before script loads):
 *   window.AnnaConfig = { greeting: "Custom greeting", accentColor: "#f59e0b" }
 */
(function () {
  "use strict";

  const ENDPOINT = "https://leads.faradaysun.com/api/widget/chat";
  const STORAGE_KEY = "anna_session_id";
  const partner = document.currentScript?.dataset?.partner || window.AnnaConfig?.partner || "widget";
  const accentColor = window.AnnaConfig?.accentColor || "#f59e0b";
  const greeting = window.AnnaConfig?.greeting ||
    "Hi! I'm Anna from Faraday Construction 👋 Has your home been checked for hail damage? I can help you find out if you're covered.";

  // ── Session ID ──────────────────────────────────────────────────────────────
  let sessionId = localStorage.getItem(STORAGE_KEY);
  if (!sessionId) {
    sessionId = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #anna-widget-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 60px; height: 60px; border-radius: 50%;
      background: ${accentColor}; color: #000; border: none; cursor: pointer;
      font-size: 26px; box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #anna-widget-btn:hover { transform: scale(1.05); box-shadow: 0 6px 28px rgba(0,0,0,0.3); }
    #anna-widget-badge {
      position: absolute; top: -4px; right: -4px; width: 18px; height: 18px;
      background: #ef4444; border-radius: 50%; border: 2px solid #fff;
      display: none; align-items: center; justify-content: center;
      font-size: 10px; font-weight: bold; color: #fff;
    }
    #anna-widget-panel {
      position: fixed; bottom: 96px; right: 24px; z-index: 99998;
      width: 360px; max-height: 560px; border-radius: 20px;
      background: #111827; border: 1px solid #374151;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      display: none; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #anna-widget-panel.anna-open { display: flex; }
    @media (max-width: 480px) {
      #anna-widget-panel {
        width: calc(100vw - 32px); right: 16px; bottom: 90px;
        max-height: calc(100vh - 120px);
      }
    }
    .anna-header {
      background: #1f2937; padding: 14px 16px;
      display: flex; align-items: center; gap-10px; gap: 10px;
      border-bottom: 1px solid #374151; flex-shrink: 0;
    }
    .anna-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: ${accentColor}; display: flex; align-items: center;
      justify-content: center; font-size: 18px; flex-shrink: 0;
    }
    .anna-header-info { flex: 1; }
    .anna-name { color: #fff; font-weight: 700; font-size: 14px; }
    .anna-status { color: #6ee7b7; font-size: 11px; }
    .anna-close {
      background: none; border: none; cursor: pointer;
      color: #6b7280; font-size: 20px; padding: 0 4px;
      line-height: 1; transition: color 0.15s;
    }
    .anna-close:hover { color: #d1d5db; }
    .anna-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex;
      flex-direction: column; gap: 10px;
    }
    .anna-msg {
      max-width: 80%; border-radius: 16px; padding: 10px 14px;
      font-size: 13px; line-height: 1.5; word-break: break-word;
    }
    .anna-msg.anna { background: #1f2937; color: #e5e7eb; border-radius: 4px 16px 16px 16px; align-self: flex-start; }
    .anna-msg.user { background: ${accentColor}; color: #000; font-weight: 500; border-radius: 16px 4px 16px 16px; align-self: flex-end; }
    .anna-msg-time { font-size: 10px; opacity: 0.5; margin-top: 3px; }
    .anna-typing {
      display: none; align-self: flex-start;
      background: #1f2937; border-radius: 4px 16px 16px 16px;
      padding: 12px 16px; align-items: center; gap: 5px;
    }
    .anna-typing.show { display: flex; }
    .anna-dot {
      width: 7px; height: 7px; border-radius: 50%; background: #9ca3af;
      animation: anna-bounce 1.2s infinite ease-in-out;
    }
    .anna-dot:nth-child(2) { animation-delay: 0.2s; }
    .anna-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes anna-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
      40% { transform: translateY(-6px); opacity: 1; }
    }
    .anna-input-area {
      border-top: 1px solid #374151; padding: 12px; display: flex;
      gap: 8px; align-items: flex-end; flex-shrink: 0;
    }
    .anna-input {
      flex: 1; background: #1f2937; border: 1px solid #374151; border-radius: 12px;
      color: #e5e7eb; font-size: 13px; padding: 10px 14px; resize: none;
      font-family: inherit; outline: none; max-height: 80px; line-height: 1.4;
      transition: border-color 0.15s;
    }
    .anna-input:focus { border-color: ${accentColor}55; }
    .anna-input::placeholder { color: #6b7280; }
    .anna-send {
      background: ${accentColor}; border: none; border-radius: 10px;
      width: 38px; height: 38px; cursor: pointer; display: flex;
      align-items: center; justify-content: center; flex-shrink: 0;
      font-size: 16px; transition: opacity 0.15s;
    }
    .anna-send:disabled { opacity: 0.4; cursor: default; }
    .anna-branding {
      text-align: center; padding: 6px; font-size: 10px; color: #4b5563;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);

  // ── DOM ─────────────────────────────────────────────────────────────────────
  const btn = document.createElement("button");
  btn.id = "anna-widget-btn";
  btn.setAttribute("aria-label", "Chat with Anna");
  btn.innerHTML = `💬<span id="anna-widget-badge" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:#ef4444;border-radius:50%;border:2px solid #fff;display:none;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:#fff;"></span>`;
  btn.style.position = "relative";

  const panel = document.createElement("div");
  panel.id = "anna-widget-panel";
  panel.innerHTML = `
    <div class="anna-header">
      <div class="anna-avatar">🏠</div>
      <div class="anna-header-info">
        <div class="anna-name">Anna · Faraday Construction</div>
        <div class="anna-status">● Online now</div>
      </div>
      <button class="anna-close" id="anna-close-btn" aria-label="Close chat">×</button>
    </div>
    <div class="anna-messages" id="anna-messages"></div>
    <div class="anna-input-area">
      <textarea class="anna-input" id="anna-input" placeholder="Type your message..." rows="1"></textarea>
      <button class="anna-send" id="anna-send-btn" disabled aria-label="Send">➤</button>
    </div>
    <div class="anna-branding">Powered by Faraday AI · (720) 766-1518</div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector("#anna-messages");
  const inputEl = panel.querySelector("#anna-input");
  const sendBtn = panel.querySelector("#anna-send-btn");
  const closeBtn = panel.querySelector("#anna-close-btn");
  const badge = btn.querySelector("#anna-widget-badge");

  // ── State ───────────────────────────────────────────────────────────────────
  let isOpen = false;
  let isSending = false;
  let opened = false;
  let unread = 0;

  function setUnread(n) {
    unread = n;
    if (badge) {
      badge.textContent = String(n);
      badge.style.display = n > 0 ? "flex" : "none";
    }
  }

  // ── Message rendering ────────────────────────────────────────────────────────
  function addMessage(role, text) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = role === "anna" ? "flex-start" : "flex-end";
    const msg = document.createElement("div");
    msg.className = `anna-msg ${role}`;
    msg.textContent = text;
    const time = document.createElement("div");
    time.className = "anna-msg-time";
    time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    wrapper.appendChild(msg);
    wrapper.appendChild(time);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (!isOpen && role === "anna") setUnread(unread + 1);
  }

  const typingEl = document.createElement("div");
  typingEl.className = "anna-typing";
  typingEl.innerHTML = '<div class="anna-dot"></div><div class="anna-dot"></div><div class="anna-dot"></div>';
  messagesEl.appendChild(typingEl);

  function showTyping(show) {
    typingEl.classList.toggle("show", show);
    if (show) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── API call ─────────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (isSending || !text.trim()) return;
    isSending = true;
    sendBtn.disabled = true;
    addMessage("user", text);
    inputEl.value = "";
    inputEl.style.height = "auto";
    showTyping(true);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, partnerSlug: partner }),
      });
      const data = await res.json();
      showTyping(false);
      if (data.reply) addMessage("anna", data.reply);
    } catch {
      showTyping(false);
      addMessage("anna", "Sorry, I had a connection issue. Call us at (720) 766-1518 anytime!");
    } finally {
      isSending = false;
      sendBtn.disabled = !inputEl.value.trim();
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  btn.addEventListener("click", () => {
    isOpen = !isOpen;
    panel.classList.toggle("anna-open", isOpen);
    btn.innerHTML = isOpen
      ? `<span style="font-size:22px">✕</span>`
      : `💬<span id="anna-widget-badge" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:#ef4444;border-radius:50%;border:2px solid #fff;display:none;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:#fff;"></span>`;

    if (isOpen) {
      setUnread(0);
      inputEl.focus();
      // Show greeting on first open
      if (!opened) {
        opened = true;
        setTimeout(() => {
          showTyping(true);
          setTimeout(() => {
            showTyping(false);
            addMessage("anna", greeting);
          }, 1200);
        }, 400);
      }
    }
  });

  closeBtn.addEventListener("click", () => {
    isOpen = false;
    panel.classList.remove("anna-open");
    btn.innerHTML = `💬`;
  });

  inputEl.addEventListener("input", () => {
    sendBtn.disabled = !inputEl.value.trim() || isSending;
    // Auto-resize
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + "px";
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value);
    }
  });

  sendBtn.addEventListener("click", () => sendMessage(inputEl.value));

  // ── Auto-open after 30 seconds if not already opened ──────────────────────
  const autoOpenDelay = window.AnnaConfig?.autoOpenDelay ?? 30000;
  if (autoOpenDelay > 0) {
    setTimeout(() => {
      if (!opened && !isOpen) {
        setUnread(1);
        // Show badge as hint without auto-opening (less intrusive)
      }
    }, autoOpenDelay);
  }
})();
