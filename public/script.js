document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chat-form");
  const userInput = document.getElementById("user-input");
  const chatContainer = document.getElementById("chat-container");
  const sendBtn = document.getElementById("send-btn");
  const modelSelect = document.getElementById("model-select");

  // Settings Modal Elements
  const settingsBtn = document.getElementById("settings-btn");
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsBtn = document.getElementById("close-settings-btn");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  
  const inputGeminiKey = document.getElementById("setting-gemini-key");
  const inputNotionKey = document.getElementById("setting-notion-key");
  const inputNotionPage = document.getElementById("setting-notion-page");
  const inputOllamaUrl = document.getElementById("setting-ollama-url");

  // Load Settings from LocalStorage
  function loadSettings() {
    inputGeminiKey.value = localStorage.getItem("NA_GEMINI_KEY") || "";
    inputNotionKey.value = localStorage.getItem("NA_NOTION_KEY") || "";
    inputNotionPage.value = localStorage.getItem("NA_NOTION_PAGE") || "";
    inputOllamaUrl.value = localStorage.getItem("NA_OLLAMA_URL") || "http://localhost:11434/api/chat";
  }

  // Save Settings to LocalStorage
  function saveSettings() {
    localStorage.setItem("NA_GEMINI_KEY", inputGeminiKey.value.trim());
    localStorage.setItem("NA_NOTION_KEY", inputNotionKey.value.trim());
    localStorage.setItem("NA_NOTION_PAGE", inputNotionPage.value.trim());
    localStorage.setItem("NA_OLLAMA_URL", inputOllamaUrl.value.trim());
    closeModal();
    appendMessage("✅ Settings saved successfully!", "agent");
  }

  loadSettings();

  // Modal interactions
  settingsBtn.addEventListener("click", () => settingsModal.classList.add("active"));
  closeSettingsBtn.addEventListener("click", closeModal);
  settingsModal.addEventListener("click", (e) => {
    if(e.target === settingsModal) closeModal();
  });
  saveSettingsBtn.addEventListener("click", saveSettings);
  
  function closeModal() {
    settingsModal.classList.remove("active");
  }

  // Chat Submission Core
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    // Add user message
    appendMessage(text, "user");
    userInput.value = "";
    
    // Add loading state
    const loadingId = appendLoading();
    userInput.disabled = true;
    sendBtn.disabled = true;

    // Compile dynamic API Keys from UI
    const requestPayload = {
      message: text,
      model: modelSelect.value,
      keys: {
        GEMINI_API_KEY: localStorage.getItem("NA_GEMINI_KEY") || "",
        NOTION_API_KEY: localStorage.getItem("NA_NOTION_KEY") || "",
        NOTION_TARGET_PAGE_ID: localStorage.getItem("NA_NOTION_PAGE") || "",
        OLLAMA_API_URL: localStorage.getItem("NA_OLLAMA_URL") || "http://localhost:11434/api/chat"
      }
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json();
      removeLoading(loadingId);
      
      if (data.error && !data.reply) {
         appendMessage(`Error: ${data.error}`, "agent");
      } else {
         appendMessage(data.reply, "agent", data.toolsUsed, data.provider);
      }

    } catch (error) {
      removeLoading(loadingId);
      appendMessage("Connection error: Unable to reach the agent server.", "agent", []);
    } finally {
      userInput.disabled = false;
      sendBtn.disabled = false;
      userInput.focus();
    }
  });

  function appendMessage(text, sender, toolsUsed = [], provider = null) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender === 'user' ? 'user-message' : 'support-message'}`;
    
    const avatar = sender === 'user' ? '👤' : '🤖';
    
    let metaHtml = '';
    if (sender === 'agent') {
        let toolsText = '';
        if (toolsUsed && toolsUsed.length > 0) {
            toolsText = `<span class="tools-used">🔧 Tools Used: ${toolsUsed.join(', ')}</span>`;
        }
        let providerTag = '';
        if (provider) {
            providerTag = `<span class="provider-badge">${provider.toUpperCase()}</span>`;
        }
        metaHtml = `${toolsText} ${providerTag}`;
    }

    // Format newlines
    const formattedText = text.replace(/\n/g, '<br>');

    msgDiv.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="bubble">
        ${formattedText}
        ${metaHtml}
      </div>
    `;
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function appendLoading() {
    const id = "loading-" + Date.now();
    const msgDiv = document.createElement("div");
    msgDiv.className = "message support-message";
    msgDiv.id = id;
    
    msgDiv.innerHTML = `
      <div class="avatar">🤖</div>
      <div class="bubble">
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return id;
  }

  function removeLoading(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
});
