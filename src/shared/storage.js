(function () {
  const DEFAULTS = {
    settings: {
      panelOpen: true,
      showTimeline: true,
      showPromptDock: true,
      autoRefresh: true,
      exportFormat: "markdown",
      panelPosition: null
    },
    folders: [
      { id: "work", name: "Work", color: "#2563eb", chats: [] },
      { id: "study", name: "Study", color: "#059669", chats: [] },
      { id: "ideas", name: "Ideas", color: "#d97706", chats: [] }
    ],
    prompts: [
      {
        id: "summarize",
        title: "Summarize",
        text: "Summarize this conversation into decisions, open questions, and next actions."
      },
      {
        id: "debug",
        title: "Debug Partner",
        text: "Act as a senior debugging partner. Ask for missing context only when it changes the fix."
      },
      {
        id: "rewrite",
        title: "Rewrite Clearly",
        text: "Rewrite the following in clear, direct language while preserving all important details."
      }
    ],
    chatMeta: {}
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => resolve(result || {}));
    });
  }

  function set(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, resolve);
    });
  }

  async function ensureDefaults() {
    const stored = await get(Object.keys(DEFAULTS));
    const patch = {};

    Object.entries(DEFAULTS).forEach(([key, value]) => {
      if (stored[key] === undefined) {
        patch[key] = clone(value);
      }
    });

    if (Object.keys(patch).length > 0) {
      await set(patch);
      return { ...stored, ...patch };
    }

    return stored;
  }

  async function readState() {
    const state = await ensureDefaults();
    return {
      settings: { ...DEFAULTS.settings, ...(state.settings || {}) },
      folders: state.folders || clone(DEFAULTS.folders),
      prompts: state.prompts || clone(DEFAULTS.prompts),
      chatMeta: state.chatMeta || {}
    };
  }

  window.ChatGPTVoyagerStore = {
    DEFAULTS,
    get,
    set,
    readState
  };
})();
