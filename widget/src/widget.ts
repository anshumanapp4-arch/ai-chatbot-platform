// ============================================
// Embeddable Chat Widget — Self-contained JS
// Uses Shadow DOM for style isolation
// ============================================

(function () {
  // Find the script tag to read config
  const script = document.currentScript as HTMLScriptElement;
  const tenant = script?.getAttribute('data-tenant') || '';
  const serverUrl = script?.getAttribute('data-server') || window.location.origin;
  const position = script?.getAttribute('data-position') || 'right';
  const primaryColor = script?.getAttribute('data-color') || '#6c63ff';

  if (!tenant) {
    console.error('[ChatBot Widget] Missing data-tenant attribute');
    return;
  }

  // Create widget container
  const container = document.createElement('div');
  container.id = 'chatbot-widget-container';
  document.body.appendChild(container);

  // Attach Shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: 'open' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --primary: ${primaryColor};
      --primary-dark: color-mix(in srgb, ${primaryColor} 80%, black);
      --bg: #1a1a2e;
      --bg-light: #242442;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --border: rgba(255,255,255,0.1);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .widget-fab {
      position: fixed;
      bottom: 24px;
      ${position}: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 60%, #c084fc));
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(108, 99, 255, 0.4);
      transition: all 0.3s ease;
      z-index: 99999;
      font-size: 26px;
    }
    .widget-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 30px rgba(108, 99, 255, 0.5);
    }

    .widget-window {
      position: fixed;
      bottom: 96px;
      ${position}: 24px;
      width: 380px;
      max-width: calc(100vw - 48px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      z-index: 99999;
      animation: widgetSlideUp 0.3s ease;
    }

    @keyframes widgetSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .widget-header {
      padding: 16px 20px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .widget-header-title {
      color: white;
      font-weight: 700;
      font-size: 15px;
    }
    .widget-header-sub {
      color: rgba(255,255,255,0.7);
      font-size: 12px;
    }
    .widget-close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .widget-close:hover { background: rgba(255,255,255,0.3); }

    .widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .widget-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .widget-msg--bot {
      align-self: flex-start;
      background: var(--bg-light);
      color: var(--text);
      border-bottom-left-radius: 4px;
    }
    .widget-msg--user {
      align-self: flex-end;
      background: var(--primary);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .widget-typing {
      align-self: flex-start;
      padding: 10px 14px;
      background: var(--bg-light);
      border-radius: 14px;
      display: flex;
      gap: 4px;
    }
    .widget-typing span {
      width: 6px;
      height: 6px;
      background: var(--text-muted);
      border-radius: 50%;
      animation: typingBounce 1.4s infinite;
    }
    .widget-typing span:nth-child(2) { animation-delay: 0.2s; }
    .widget-typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    .widget-input-area {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .widget-input {
      flex: 1;
      padding: 10px 14px;
      background: var(--bg-light);
      border: 1px solid var(--border);
      border-radius: 12px;
      color: var(--text);
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .widget-input:focus {
      border-color: var(--primary);
    }
    .widget-input::placeholder { color: var(--text-muted); }

    .widget-send {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--primary);
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .widget-send:hover { transform: scale(1.05); }
    .widget-send:disabled { opacity: 0.5; cursor: not-allowed; }

    .widget-messages::-webkit-scrollbar { width: 4px; }
    .widget-messages::-webkit-scrollbar-track { background: transparent; }
    .widget-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
  `;
  shadow.appendChild(style);

  // State
  let isOpen = false;
  let conversationId: string | null = null;
  let isLoading = false;

  // Create FAB button
  const fab = document.createElement('button');
  fab.className = 'widget-fab';
  fab.innerHTML = '💬';
  fab.onclick = () => toggleWidget();
  shadow.appendChild(fab);

  // Create chat window (hidden initially)
  const chatWindow = document.createElement('div');
  chatWindow.className = 'widget-window';
  chatWindow.style.display = 'none';
  chatWindow.innerHTML = `
    <div class="widget-header">
      <div>
        <div class="widget-header-title">Chat with us</div>
        <div class="widget-header-sub">We typically reply within minutes</div>
      </div>
      <button class="widget-close">✕</button>
    </div>
    <div class="widget-messages">
      <div class="widget-msg widget-msg--bot">
        👋 Hi there! How can I help you today?
      </div>
    </div>
    <div class="widget-input-area">
      <input class="widget-input" placeholder="Type your message..." />
      <button class="widget-send">➤</button>
    </div>
  `;
  shadow.appendChild(chatWindow);

  // Event handlers
  const closeBtn = chatWindow.querySelector('.widget-close') as HTMLButtonElement;
  const messagesDiv = chatWindow.querySelector('.widget-messages') as HTMLDivElement;
  const input = chatWindow.querySelector('.widget-input') as HTMLInputElement;
  const sendBtn = chatWindow.querySelector('.widget-send') as HTMLButtonElement;

  closeBtn.onclick = () => toggleWidget();

  sendBtn.onclick = () => sendMessage();
  input.onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  function toggleWidget() {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? 'flex' : 'none';
    fab.innerHTML = isOpen ? '✕' : '💬';
    if (isOpen) {
      input.focus();
    }
  }

  function addMessage(content: string, isUser: boolean) {
    const msg = document.createElement('div');
    msg.className = `widget-msg widget-msg--${isUser ? 'user' : 'bot'}`;
    msg.textContent = content;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'widget-typing';
    typing.id = 'widget-typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messagesDiv.appendChild(typing);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function hideTyping() {
    const typing = shadow.getElementById('widget-typing-indicator');
    if (typing) typing.remove();
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    addMessage(text, true);
    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const response = await fetch(`${serverUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          tenant_slug: tenant,
        }),
      });

      const data = await response.json();

      if (data.success) {
        conversationId = data.data.conversation_id;
        hideTyping();
        addMessage(data.data.message, false);
      } else {
        hideTyping();
        addMessage('Sorry, something went wrong. Please try again.', false);
      }
    } catch (error) {
      hideTyping();
      addMessage('Unable to connect. Please check your internet connection.', false);
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
    }
  }
})();
