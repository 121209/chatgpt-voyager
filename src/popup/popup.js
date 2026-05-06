(async function () {
  const store = window.ChatGPTVoyagerStore;
  let state = await store.readState();

  const foldersEl = document.getElementById("folders");
  const folderForm = document.getElementById("folderForm");
  const folderName = document.getElementById("folderName");
  const panelOpen = document.getElementById("panelOpen");
  const autoRefresh = document.getElementById("autoRefresh");
  const exportFormat = document.getElementById("exportFormat");
  let activeChat = null;

  async function getActiveChat() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.url || !/https:\/\/(chatgpt|chat\.openai)\.com\//.test(tab.url)) {
          resolve(null);
          return;
        }

        const parsed = new URL(tab.url);
        const match = parsed.pathname.match(/\/c\/([^/?#]+)/);
        resolve({
          id: match ? match[1] : parsed.pathname || "new-chat",
          title: (tab.title || "ChatGPT conversation").replace(/\s+-\s+ChatGPT\s*$/i, ""),
          url: tab.url
        });
      });
    });
  }

  function randomColor() {
    const colors = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function renderFolders() {
    foldersEl.textContent = "";
    state.folders.forEach((folder) => {
      const row = document.createElement("div");
      row.className = "folder";

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = folder.color;

      const name = document.createElement("span");
      name.textContent = folder.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.danger = "true";
      remove.title = "Delete folder";
      remove.textContent = "x";
      remove.addEventListener("click", async () => {
        state.folders = state.folders.filter((item) => item.id !== folder.id);
        await store.set({ folders: state.folders });
        renderFolders();
      });

      const save = document.createElement("button");
      save.type = "button";
      save.dataset.secondary = "true";
      save.title = "Save current chat to this folder";
      save.textContent = activeChat && folder.chats?.some((chat) => chat.id === activeChat.id) ? "Saved" : "Save";
      save.disabled = !activeChat;
      save.addEventListener("click", async () => {
        if (!activeChat) return;
        folder.chats = (folder.chats || []).filter((chat) => chat.id !== activeChat.id);
        folder.chats.unshift({ ...activeChat, savedAt: new Date().toISOString() });
        await store.set({ folders: state.folders });
        renderFolders();
      });

      row.append(swatch, name, save, remove);
      foldersEl.append(row);
    });
  }

  function renderSettings() {
    panelOpen.checked = Boolean(state.settings.panelOpen);
    autoRefresh.checked = Boolean(state.settings.autoRefresh);
    exportFormat.value = state.settings.exportFormat || "markdown";
  }

  async function saveSettings() {
    state.settings = {
      ...state.settings,
      panelOpen: panelOpen.checked,
      autoRefresh: autoRefresh.checked,
      exportFormat: exportFormat.value
    };
    await store.set({ settings: state.settings });
  }

  folderForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = folderName.value.trim();
    if (!name) return;

    state.folders.push({
      id: `${Date.now()}`,
      name,
      color: randomColor(),
      chats: []
    });
    folderName.value = "";
    await store.set({ folders: state.folders });
    renderFolders();
  });

  [panelOpen, autoRefresh, exportFormat].forEach((input) => {
    input.addEventListener("change", saveSettings);
  });

  activeChat = await getActiveChat();
  renderFolders();
  renderSettings();
})();
