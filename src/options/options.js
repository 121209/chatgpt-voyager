(async function () {
  const store = window.ChatGPTVoyagerStore;
  const state = await store.readState();
  const promptsEl = document.getElementById("prompts");
  const promptForm = document.getElementById("promptForm");
  const promptTitle = document.getElementById("promptTitle");
  const promptText = document.getElementById("promptText");

  function renderPrompts() {
    promptsEl.textContent = "";

    state.prompts.forEach((prompt) => {
      const row = document.createElement("article");
      row.className = "prompt";

      const title = document.createElement("strong");
      title.textContent = prompt.title;

      const text = document.createElement("p");
      text.textContent = prompt.text;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.danger = "true";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        state.prompts = state.prompts.filter((item) => item.id !== prompt.id);
        await store.set({ prompts: state.prompts });
        renderPrompts();
      });

      row.append(title, text, remove);
      promptsEl.append(row);
    });
  }

  promptForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = promptTitle.value.trim();
    const text = promptText.value.trim();
    if (!title || !text) return;

    state.prompts.push({
      id: `${Date.now()}`,
      title,
      text
    });
    promptTitle.value = "";
    promptText.value = "";
    await store.set({ prompts: state.prompts });
    renderPrompts();
  });

  renderPrompts();
})();
