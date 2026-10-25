(function () {
  const TURN_HEIGHT = 122;
  const WINDOW_SIZE = 12;
  const searchParams = new URLSearchParams(location.search);
  const scenario = searchParams.get("scenario") || "basic";
  const fixtureRun = searchParams.get("fixtureRun") || "default";
  const fixtureGroup = scenario === "restore" ? "virtualized" : scenario;
  const chatScroll = document.getElementById("chat-scroll");
  const conversation = document.getElementById("conversation");
  const status = document.getElementById("fixture-status");
  const results = document.getElementById("fixture-results");
  const originalConsoleError = console.error.bind(console);
  const uncaughtErrors = [];
  const runtimeMessages = [];
  let officialNavigation = null;
  let virtualQuestions = [];
  let lastWindowStart = -1;
  let virtualized = false;

  window.chrome = window.chrome || {};
  window.chrome.runtime = window.chrome.runtime || {
    lastError: null,
    sendMessage(_message, callback) {
      runtimeMessages.push(_message);
      callback?.({ ok: true });
    }
  };

  history.replaceState(
    {},
    "",
    `/c/navigation-fixture-${encodeURIComponent(fixtureGroup)}-${encodeURIComponent(fixtureRun)}?scenario=${encodeURIComponent(scenario)}&fixtureRun=${encodeURIComponent(fixtureRun)}`
  );

  if (scenario === "modern-cache") {
    const conversationId = location.pathname.split('/').pop();
    localStorage.setItem(`cqr_questions_v3_${conversationId}`, JSON.stringify({
      cacheVersion: 3,
      conversationId,
      updatedAt: Date.now(),
      questions: [{
        id: `${conversationId}:legacy:1`, conversationId, index: 1,
        text: "请每周出些题，帮助我复习 GPU 教材。", hash: "legacy", elementKey: "legacy:0"
      }]
    }));
  }

  window.addEventListener("error", (event) => {
    uncaughtErrors.push(event.message || "Unknown window error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    uncaughtErrors.push(String(event.reason || "Unknown rejection"));
  });

  console.error = (...args) => {
    uncaughtErrors.push(args.map(String).join(" "));
    originalConsoleError(...args);
  };

  function questionText(index) {
    return `Question ${String(index + 1).padStart(2, "0")} unique navigation fixture text`;
  }

  function answerText(index) {
    return `Assistant answer for question ${index + 1}. The final conclusion identifies navigation target ${index + 1}.`;
  }

  function buildQuestions(count) {
    return Array.from({ length: count }, (_, index) => questionText(index));
  }

  function buildVirtualizedQuestions(count) {
    const questions = buildQuestions(count);
    if (count > 29) {
      questions[5] = "Repeated virtualized question text";
      questions[29] = "Repeated virtualized question text";
    }
    return questions;
  }

  function turnNumberForQuestion(index) {
    return index * 2 + 1;
  }

  function createTurn(role, text, turnNumber, top) {
    const turn = document.createElement("article");
    turn.dataset.testid = `conversation-turn-${turnNumber}`;
    turn.setAttribute("data-testid", `conversation-turn-${turnNumber}`);
    turn.style.top = `${top}px`;

    const message = document.createElement("div");
    message.setAttribute("data-message-author-role", role);
    message.textContent = text;
    turn.append(message);
    return turn;
  }

  function renderQuestionIndexes(indexes) {
    conversation.textContent = "";
    indexes.forEach((questionIndex) => {
      const userTop = questionIndex * TURN_HEIGHT * 2;
      conversation.append(
        createTurn("user", virtualQuestions[questionIndex], turnNumberForQuestion(questionIndex), userTop),
        createTurn("assistant", answerText(questionIndex), turnNumberForQuestion(questionIndex) + 1, userTop + TURN_HEIGHT)
      );
    });
  }

  function renderWindow(start) {
    const clamped = Math.max(0, Math.min(virtualQuestions.length - WINDOW_SIZE, start));
    if (clamped === lastWindowStart) return;
    lastWindowStart = clamped;
    const indexes = Array.from({ length: Math.min(WINDOW_SIZE, virtualQuestions.length - clamped) }, (_, offset) => clamped + offset);
    renderQuestionIndexes(indexes);
  }

  function handleVirtualScroll() {
    if (!virtualized) return;
    const approximateIndex = Math.floor(chatScroll.scrollTop / (TURN_HEIGHT * 2));
    renderWindow(Math.max(0, approximateIndex - 2));
  }

  chatScroll.addEventListener("scroll", handleVirtualScroll, { passive: true });

  function configureConversation(questions, options = {}) {
    virtualQuestions = questions.slice();
    virtualized = Boolean(options.virtualized);
    lastWindowStart = -1;
    conversation.style.height = `${Math.max(1, questions.length) * TURN_HEIGHT * 2}px`;

    if (virtualized) {
      renderWindow(options.start || 0);
      chatScroll.scrollTop = (options.start || 0) * TURN_HEIGHT * 2;
      return;
    }

    renderQuestionIndexes(questions.map((_question, index) => index));
    chatScroll.scrollTop = options.scrollTop || 0;
  }

  function clearOfficialQuestionNavigation() {
    officialNavigation?.remove();
    officialNavigation = null;
  }

  function renderOfficialQuestionNavigation(questions) {
    clearOfficialQuestionNavigation();
    officialNavigation = document.createElement("nav");
    officialNavigation.dataset.testid = "official-question-navigation";
    officialNavigation.setAttribute("data-testid", "official-question-navigation");
    officialNavigation.setAttribute("aria-label", "Conversation question navigation");
    officialNavigation.style.cssText = [
      "position:fixed",
      "z-index:20",
      "right:8px",
      "top:88px",
      "display:grid",
      "gap:6px",
      "padding:6px",
      "background:transparent"
    ].join(";");

    questions.forEach((question, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Question ${index + 1}: ${question}`);
      button.style.cssText = [
        "width:46px",
        "height:8px",
        "padding:0",
        "border:0",
        "border-radius:999px",
        "background:#94a3b8"
      ].join(";");
      officialNavigation.append(button);
    });

    document.body.append(officialNavigation);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitFor(predicate, message, timeoutMs = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (predicate()) return;
      await wait(50);
    }
    throw new Error(message);
  }

  function record(name, passed, detail = "") {
    const item = document.createElement("li");
    item.dataset.status = passed ? "PASS" : "FAIL";
    item.textContent = `${passed ? "PASS" : "FAIL"} - ${name}${detail ? `: ${detail}` : ""}`;
    results.append(item);
    return passed;
  }

  async function check(name, test) {
    try {
      await test();
      record(name, true);
      return true;
    } catch (error) {
      record(name, false, error.message || String(error));
      return false;
    }
  }

  function railDots() {
    return Array.from(document.querySelectorAll(".cqr-dot"));
  }

  function requireNoPluginLineMarkers(label) {
    requireEqual(document.querySelectorAll(".cqr-dot").length, 0, `${label} cqr-dot count`);
    requireEqual(document.querySelectorAll(".cqr-question-line").length, 0, `${label} cqr-question-line count`);
    requireEqual(document.querySelectorAll(".cqr-rail-track").length, 0, `${label} cqr-rail-track count`);
  }

  function openDirectory() {
    const button = document.querySelector(".cqr-menu-button");
    if (!button) throw new Error("Directory button is missing");
    if (document.querySelector(".cqr-directory")?.hidden) button.click();
  }

  function findDirectoryTab(label) {
    return Array.from(document.querySelectorAll(".cqr-tab"))
      .find((button) => button.textContent.trim() === label);
  }

  function openDirectoryTab() {
    openDirectory();
    const tab = findDirectoryTab("目录");
    if (!tab) throw new Error("Directory tab is missing");
    if (tab.getAttribute("aria-selected") !== "true") tab.click();
  }

  function openExportPanel() {
    openDirectory();
    const tab = findDirectoryTab("导出");
    if (!tab) throw new Error("Export tab is missing");
    if (tab.getAttribute("aria-selected") !== "true") tab.click();
  }

  function directoryItems() {
    openDirectoryTab();
    return Array.from(document.querySelectorAll(".cqr-directory-item"));
  }

  function exportChoices() {
    openExportPanel();
    return Array.from(document.querySelectorAll(".cqr-export-choice"));
  }

  function requireEqual(actual, expected, label) {
    if (actual !== expected) {
      throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
  }

  function requireTruthy(value, label) {
    if (!value) throw new Error(label);
  }

  function targetVisible(questionIndex) {
    const turn = document.querySelector(`[data-testid="conversation-turn-${turnNumberForQuestion(questionIndex)}"]`);
    if (!turn) return false;
    const targetRect = turn.getBoundingClientRect();
    const containerRect = chatScroll.getBoundingClientRect();
    return targetRect.bottom > containerRect.top && targetRect.top < containerRect.bottom;
  }

  async function runBasic() {
    const sharedPrefix = "P".repeat(320);
    const questions = [
      "First ordinary question",
      "Repeated question text",
      "Repeated question text",
      `${sharedPrefix} ending A`,
      `${sharedPrefix} ending B`,
      "Final ordinary question"
    ];
    configureConversation(questions);

    await waitFor(() => document.querySelector(".cqr-menu-button"), "Voyager menu button did not initialize");
    await waitFor(
      () => directoryItems().length === questions.length,
      "ordinary conversation did not initialize"
    );

    await check("ordinary conversation and repeated text preserve every directory question", async () => {
      requireEqual(directoryItems().length, questions.length, "directory count");
      requireNoPluginLineMarkers("ordinary conversation");
    });

    await check("question export uses every recorded directory question", async () => {
      requireEqual(exportChoices().length, questions.length, "question export count");
      const selectedMode = Array.from(document.querySelectorAll(".cqr-export-mode-button"))
        .find((button) => button.textContent.trim() === "问题");
      requireTruthy(selectedMode, "question export mode is missing");
      requireEqual(selectedMode.getAttribute("aria-selected"), "true", "default export mode");
    });

    await check("question export PDF and image buttons stay enabled in question mode", async () => {
      openExportPanel();
      const pdfButton = Array.from(document.querySelectorAll(".cqr-export-button"))
        .find((button) => button.textContent.trim() === "导出 PDF");
      const imageButton = Array.from(document.querySelectorAll(".cqr-export-button"))
        .find((button) => button.textContent.trim() === "导出图片");
      requireTruthy(pdfButton, "PDF export button is missing");
      requireTruthy(imageButton, "image export button is missing");
      requireEqual(pdfButton.disabled, false, "question PDF export disabled state");
      requireEqual(imageButton.disabled, false, "question image export disabled state");
    });

    await check("plugin menu stays available without duplicate line markers", async () => {
      requireTruthy(document.querySelector(".cqr-menu-button"), "menu button is missing");
      requireTruthy(document.querySelector(".cqr-menu-trigger"), "menu trigger is missing");
      requireNoPluginLineMarkers("menu-only navigation");
    });

    await check("directory click brings final question into view", async () => {
      const items = directoryItems();
      items[items.length - 1].click();
      await waitFor(() => targetVisible(questions.length - 1), "final question did not enter viewport", 4000);
    });

    await check("DOM replacement does not create a duplicate index", async () => {
      const turnNumber = turnNumberForQuestion(1);
      const oldTurn = document.querySelector(`[data-testid="conversation-turn-${turnNumber}"]`);
      const replacement = createTurn("user", questions[1], turnNumber, TURN_HEIGHT * 2);
      oldTurn.replaceWith(replacement);
      await waitFor(() => directoryItems().length === questions.length, "directory count changed after replacement");
      requireNoPluginLineMarkers("after replacement");
    });

    await check("new user question is captured in real time", async () => {
      const nextIndex = virtualQuestions.length;
      virtualQuestions.push("Live appended question");
      conversation.style.height = `${virtualQuestions.length * TURN_HEIGHT * 2}px`;
      conversation.append(
        createTurn("user", virtualQuestions[nextIndex], turnNumberForQuestion(nextIndex), nextIndex * TURN_HEIGHT * 2),
        createTurn("assistant", answerText(nextIndex), turnNumberForQuestion(nextIndex) + 1, nextIndex * TURN_HEIGHT * 2 + TURN_HEIGHT)
      );
      await waitFor(() => directoryItems().length === virtualQuestions.length, "live question was not added to directory");
      requireNoPluginLineMarkers("after live append");
    });

    await check("plugin does not render its own scrollable rail on long conversations", async () => {
      const manyQuestions = buildQuestions(48);
      configureConversation(manyQuestions);
      await waitFor(() => directoryItems().length === manyQuestions.length, "long directory did not render every question");
      requireNoPluginLineMarkers("long conversation");
    });

    await check("idle menu-only navigation does not recreate duplicate markers", async () => {
      await wait(1400);
      requireNoPluginLineMarkers("idle navigation");
    });

    await check("question export imports readable official navigation entries", async () => {
      const officialQuestions = buildQuestions(48).concat([
        "Official navigation-only question 49",
        "Official navigation-only question 50"
      ]);
      renderOfficialQuestionNavigation(officialQuestions);
      await waitFor(() => exportChoices().length === officialQuestions.length, "official navigation questions were not imported", 4000);
      requireTruthy(
        Array.from(document.querySelectorAll(".cqr-export-text"))
          .some((node) => node.textContent === "Official navigation-only question 50"),
        "official navigation question text is missing from export"
      );
      requireTruthy(
        /官方导航/.test(document.querySelector(".cqr-export-status-text")?.textContent || ""),
        "official navigation sync status is missing"
      );
      clearOfficialQuestionNavigation();
    });
  }

  function conversationExportChoices() {
    openExportPanel();
    const mode = Array.from(document.querySelectorAll(".cqr-export-mode-button"))
      .find((button) => button.textContent === "对话");
    if (mode.getAttribute("aria-selected") !== "true") mode.click();
    return Array.from(document.querySelectorAll(".cqr-export-choice"));
  }

  async function runCompatibility() {
    const questions = ["Explain ChatGPT export", "Repeated compatibility question", "Repeated compatibility question"];
    configureConversation(questions);
    const turns = Array.from(conversation.children);
    turns.slice(0, 4).forEach((turn, index) => {
      const role = index % 2 ? "assistant" : "user";
      turn.setAttribute("data-turn", role);
      const message = turn.firstElementChild;
      message.removeAttribute("data-message-author-role");
      message.className = role === "user" ? "user-message-bubble" : "markdown";
      const heading = document.createElement("h5");
      heading.className = "sr-only";
      heading.textContent = role === "user" ? "You said:" : "ChatGPT said:";
      const action = document.createElement("button");
      action.textContent = "Copy";
      turn.prepend(heading);
      turn.append(action);
    });
    // A test-id body can coexist with both new and legacy role attributes.
    turns[4].firstElementChild.removeAttribute("data-message-author-role");
    turns[4].firstElementChild.setAttribute("data-testid", "user-message");
    turns[5].firstElementChild.removeAttribute("data-message-author-role");
    turns[5].firstElementChild.setAttribute("data-testid", "assistant-message");
    const thinking = document.createElement("div");
    thinking.setAttribute("data-testid", "thinking");
    thinking.innerHTML = '<div class="markdown">Private reasoning placeholder</div>';
    turns[1].prepend(thinking);
    const composer = document.createElement("form");
    composer.setAttribute("data-testid", "composer");
    composer.innerHTML = '<div data-message-author-role="user">Unsent draft</div>';
    document.body.append(composer);

    await check("mixed role structures preserve repeated directory questions", async () => {
      await waitFor(() => directoryItems().length === 3, "mixed directory count did not reach 3");
      requireEqual(directoryItems()[0].querySelector(".cqr-directory-text").textContent, questions[0], "first question body");
    });
    await check("conversation export collects user and assistant bodies without UI text", async () => {
      const choices = conversationExportChoices();
      requireEqual(choices.length, 6, "mixed message count");
      choices.forEach((choice, index) => {
        requireEqual(choice.querySelector(".cqr-export-text").textContent,
          index % 2 ? answerText(Math.floor(index / 2)) : questions[index / 2], "message body");
        requireTruthy(choice.querySelector(".cqr-export-role").textContent.startsWith(index % 2 ? "Assistant" : "User"), "message role");
      });
    });
    await check("assistant streaming refreshes the open export panel", async () => {
      conversationExportChoices();
      const body = turns[5].firstElementChild;
      body.firstChild.nodeValue = "Updated streamed answer with a final conclusion.";
      await waitFor(() => Array.from(document.querySelectorAll(".cqr-export-text"))
        .some((node) => node.textContent === body.textContent), "streamed answer stayed stale");
    });
    await check("Markdown export contains selected user and assistant content", async () => {
      const choices = conversationExportChoices();
      choices[2].querySelector("input").click();
      try {
        Array.from(document.querySelectorAll(".cqr-export-button"))
          .find((button) => button.textContent === "导出 Markdown").click();
        const request = runtimeMessages.filter((message) => message.type === "download-markdown").pop();
        requireTruthy(request, "Markdown download request is missing");
        requireTruthy(request.markdown.includes(questions[0]) && request.markdown.includes(answerText(0)), "exported question or answer is missing");
        requireEqual((request.markdown.match(/## User /g) || []).length, 2, "selected user count");
        requireEqual((request.markdown.match(/## Assistant /g) || []).length, 3, "selected answer count");
        requireTruthy(!/Unsent draft|Private reasoning placeholder|You said:|ChatGPT said:/.test(request.markdown), "Markdown includes non-message text");
      } finally {
        choices[2].querySelector("input").click();
      }
    });
    await check("PDF preview receives complete collected question and answer bodies", async () => {
      conversationExportChoices();
      const originalOpen = window.open;
      const previewDocument = document.implementation.createHTMLDocument("PDF fixture");
      window.open = () => ({ document: previewDocument, focus() {}, print() {} });
      try {
        Array.from(document.querySelectorAll(".cqr-export-button"))
          .find((button) => button.textContent === "导出 PDF").click();
        requireEqual(previewDocument.querySelectorAll(".message").length, 6, "PDF message count");
        requireTruthy(previewDocument.body.textContent.includes(questions[0]), "PDF question is missing");
        requireTruthy(previewDocument.body.textContent.includes(answerText(0)), "PDF answer is missing");
        requireTruthy(!/Unsent draft|Private reasoning placeholder|You said:|ChatGPT said:/.test(previewDocument.body.textContent), "PDF includes non-message text");
      } finally {
        window.open = originalOpen;
      }
    });
    await check("role hydration attributes trigger message collection", async () => {
      const turn = createTurn("user", "Hydrated question", 7, TURN_HEIGHT * 6);
      turn.firstElementChild.removeAttribute("data-message-author-role");
      turn.firstElementChild.style.width = "20px";
      conversation.append(turn);
      await wait(700);
      requireEqual(directoryItems().length, 3, "unmarked pending turn count");
      turn.setAttribute("data-turn", "user");
      turn.firstElementChild.className = "user-message-bubble";
      await waitFor(() => directoryItems().length === 4, "hydrated user was not collected");
    });
    await check("legacy explicit user text mentioning ChatGPT remains a question", async () => {
      conversation.append(createTurn("user", "How does ChatGPT export work?", 9, TURN_HEIGHT * 8));
      await waitFor(() => directoryItems().length === 5, "explicit user text was rejected");
    });
    composer.remove();
  }

  async function runAnswerPairing() {
    const prompt = "我觉得你刚才下面出现的隐形提示很好，每周出些题，让我复习 GPU 教材并检查自己的理解。";
    const prompts = [prompt, "完全相同的重复提问", "完全相同的重复提问"];
    configureConversation(prompts);
    const turns = Array.from(conversation.children);
    // The directory already recognizes this bubble without any role attribute.
    turns[0].firstElementChild.removeAttribute("data-message-author-role");
    turns[0].firstElementChild.className = "user-message-bubble";
    turns[1].firstElementChild.removeAttribute("data-message-author-role");
    turns[1].firstElementChild.className = "markdown prose";
    turns[1].firstElementChild.textContent = "每周复习应按章节出题。最终建议使用周测检查 GPU 知识。";
    turns[3].firstElementChild.textContent = "第一次重复提问的最终结论是选择苹果。";
    turns[5].firstElementChild.textContent = "第二次重复提问的最终结论是选择香蕉。";
    const outside = document.createElement("aside");
    outside.innerHTML = '<div class="markdown">Sidebar content must not become an answer.</div>';
    document.body.append(outside);
    await check("role-free directory question is paired with its markdown answer", async () => {
      await waitFor(() => directoryItems().some((item) => item.querySelector(".cqr-directory-text").textContent.startsWith("我觉得")), "question is missing");
      const item = directoryItems().find((item) => item.querySelector(".cqr-directory-text").textContent.startsWith("我觉得"));
      requireTruthy(item.querySelector(".cqr-directory-answer-overview").textContent.includes("GPU"), "directory still reports an unrecognized answer");
    });
    await check("role-free messages are included in conversation export", async () => {
      const choices = conversationExportChoices();
      requireEqual(choices.length, 6, "role-free message count");
      requireEqual(choices[0].querySelector(".cqr-export-text").textContent, prompt, "canonical question body");
      requireTruthy(choices[1].querySelector(".cqr-export-text").textContent.includes("GPU"), "assistant body missing");
    });
    await check("repeated questions receive their own turn-specific answer", async () => {
      const items = directoryItems();
      requireTruthy(items[1].querySelector(".cqr-directory-answer-overview").textContent.includes("苹果"), "first answer mismatch");
      requireTruthy(items[2].querySelector(".cqr-directory-answer-overview").textContent.includes("香蕉"), "repeated question got another turn's answer");
    });
    await check("same-turn user and assistant bodies remain independently collected", async () => {
      turns[4].append(turns[5].firstElementChild);
      turns[4].setAttribute("data-turn", "user");
      turns[5].remove();
      await wait(800);
      const choices = conversationExportChoices();
      requireEqual(choices.length, 6, "shared-turn message count");
      const item = directoryItems().find((node) => node.dataset.turnNumber === "5");
      requireTruthy(item?.querySelector(".cqr-directory-answer-overview").textContent.includes("香蕉"), "shared-turn answer mismatch");
    });
    await check("attachment wrapper does not prevent directory answer matching", async () => {
      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-message-author-role", "user");
      const filename = document.createElement("span");
      filename.textContent = "GPU教材.pdf";
      turns[0].firstElementChild.replaceWith(wrapper);
      wrapper.append(filename);
      const bubble = document.createElement("div");
      bubble.className = "user-message-bubble";
      bubble.textContent = prompt;
      wrapper.append(bubble);
      await wait(800);
      const item = directoryItems().find((node) => node.dataset.turnNumber === "1");
      requireTruthy(item?.querySelector(".cqr-directory-answer-overview").textContent.includes("GPU"), "attachment wrapper broke matching");
      requireEqual(conversationExportChoices()[0].querySelector(".cqr-export-text").textContent, prompt, "directory and export user body differ");
    });
    await check("multipart answer bodies are joined without collecting reasoning", async () => {
      const part = document.createElement("div");
      part.className = "markdown";
      part.textContent = "最后建议使用错题记录来安排下一周复习。";
      const thinking = document.createElement("div");
      thinking.setAttribute("data-testid", "thinking");
      thinking.innerHTML = '<div class="markdown">Reasoning must never appear in the answer.</div>';
      turns[1].append(thinking, part);
      await wait(800);
      const item = directoryItems().find((node) => node.dataset.turnNumber === "1");
      requireTruthy(item?.querySelector(".cqr-directory-answer-overview").textContent.includes("错题"), "last answer part missing");
      const choices = conversationExportChoices();
      requireEqual(choices.length, 7, "multipart message count");
      requireTruthy(!choices.some((choice) => choice.textContent.includes("Reasoning must")), "reasoning exported");
      choices[1].querySelector("input").click();
      Array.from(document.querySelectorAll(".cqr-export-button"))
        .find((button) => button.textContent === "导出 Markdown").click();
      const request = runtimeMessages.filter((message) => message.type === "download-markdown").pop();
      requireTruthy(!request.markdown.includes("最终建议使用周测"), "deselected answer part was exported");
      requireTruthy(request.markdown.includes("错题"), "selecting one answer part deselected another");
    });
    outside.remove();
  }

  async function runAnswerIdentity() {
    configureConversation(["相同提问没有数字回合编号", "相同提问没有数字回合编号"]);
    Array.from(conversation.children).forEach((turn, index) => {
      turn.setAttribute("data-testid", `conversation-turn-custom-${index}`);
      if (index % 2) turn.firstElementChild.textContent = index === 1
        ? "第一个回答最终建议使用红色。"
        : "第二个回答最终建议使用蓝色。";
    });
    await check("nonnumeric turn identities pair repeated questions by source node", async () => {
      await waitFor(() => directoryItems().length === 2, "custom turns did not initialize");
      const items = directoryItems();
      requireTruthy(items[0].querySelector(".cqr-directory-answer-overview").textContent.includes("红色"), "first custom answer mismatch");
      requireTruthy(items[1].querySelector(".cqr-directory-answer-overview").textContent.includes("蓝色"), "second custom answer mismatch");
    });
  }

  async function runModernChat() {
    conversation.textContent = "";
    const createMessage = (role, key, id, text) => {
      const block = document.createElement("div");
      block.setAttribute("data-chatgpt-search-unit-key", `${key}:${role}`);
      block.setAttribute("data-chatgpt-search-message-ids", `${id} ${id}`);
      block.style.marginBottom = "24px";
      const heading = document.createElement("h4");
      heading.className = "sr-only";
      heading.textContent = role === "user" ? "你说：" : "ChatGPT 说：";
      const body = document.createElement("div");
      body.setAttribute("data-content-search-unit-key", `${key}:${role}`);
      if (role === "user") {
        const bubble = document.createElement("div");
        bubble.setAttribute("data-user-message-bubble", "true");
        bubble.className = "bg-user-message text-user-message";
        bubble.textContent = text;
        body.append(bubble);
      } else {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        body.append(paragraph);
      }
      block.append(heading, body);
      return block;
    };
    const prompt = "请每周出些题，帮助我复习 GPU 教材。";
    conversation.append(
      createMessage("user", "fallback-turn-0:0", "user-message-a", prompt),
      createMessage("assistant", "fallback-turn-0:2", "answer-message-a", "已经安排每周复习题，最终建议用主动回忆和错题复盘掌握 GPU 知识。"),
      createMessage("assistant", "scheduled-turn:0", "answer-message-b", "第二期复习重点是 Warp 分支发散、内存合并访问和 Tiling。")
    );
    await check("modern semantic message units expose the real question and replies", async () => {
      await waitFor(() => {
        const items = directoryItems();
        return items.length === 1 && !items[0].classList.contains("is-unloaded");
      }, "modern loaded directory count mismatch");
      requireTruthy(directoryItems()[0].querySelector(".cqr-directory-answer-overview").textContent.includes("GPU"), "modern assistant reply is unrecognized");
      const choices = conversationExportChoices();
      requireEqual(choices.length, 3, "modern question and scheduled reply count");
      requireEqual(choices[0].querySelector(".cqr-export-text").textContent, prompt, "modern user body");
      requireTruthy(!choices.some((choice) => /你说：|ChatGPT 说：/.test(choice.querySelector(".cqr-export-text").textContent)), "modern role headings leaked into text");
    });
    await check("semantic message IDs keep repeated questions stable across DOM replacement", async () => {
      conversation.append(
        createMessage("user", "new-turn:0", "user-message-b", prompt),
        createMessage("assistant", "new-turn:1", "answer-message-c", "这是第二次提问，最终建议重点练习线程同步。")
      );
      await waitFor(() => directoryItems().length === 2, "repeated semantic user was merged");
      requireTruthy(directoryItems()[1].querySelector(".cqr-directory-answer-overview").textContent.includes("线程同步"), "semantic repeated answer mismatch");
      const old = conversation.querySelector('[data-chatgpt-search-message-ids="user-message-b user-message-b"]');
      old.replaceWith(createMessage("user", "new-turn:0", "user-message-b", prompt));
      await wait(800);
      requireEqual(directoryItems().length, 2, "semantic replacement duplicated a question");
    });
  }

  async function runRealSnapshot() {
    const html = await (await fetch("../output/.export-repair-work/real-chat-main.html")).text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    parsed.querySelectorAll("script,style,link,iframe,img,source,video,audio,form").forEach((node) => node.remove());
    conversation.textContent = "";
    conversation.append(...Array.from(parsed.body.childNodes));
    await check("saved real ChatGPT DOM pairs the GPU question with its assistant content", async () => {
      await waitFor(() => directoryItems().length === 1, "real snapshot directory question missing");
      requireTruthy(!directoryItems()[0].querySelector(".cqr-directory-answer-overview").classList.contains("is-empty"), "real snapshot answer overview is empty");
      const choices = conversationExportChoices();
      requireEqual(choices.length, 3, "real snapshot question and assistant message count");
      requireTruthy(choices[1].textContent.includes("已经帮你设置好了"), "real first assistant content missing");
      requireTruthy(choices[2].textContent.includes("第 2 期"), "real scheduled assistant content missing");
    });
  }

  async function runVirtualized() {
    const questions = buildVirtualizedQuestions(60);
    configureConversation(questions, { virtualized: true, start: 24 });

    await waitFor(() => directoryItems().length === WINDOW_SIZE, "middle virtual window did not initialize");

    await check("entering from the middle indexes the loaded window", async () => {
      requireEqual(directoryItems().length, WINDOW_SIZE, "initial middle directory count");
      requireNoPluginLineMarkers("middle virtual window");
    });

    await check("scrolling upward merges earlier virtualized questions", async () => {
      chatScroll.scrollTop = 0;
      chatScroll.dispatchEvent(new Event("scroll", { bubbles: true }));
      await waitFor(() => directoryItems().length >= WINDOW_SIZE * 2, "earlier questions were not merged", 6000);
    });

    await check("deep capture collects the complete virtualized conversation", async () => {
      openDirectory();
      const captureButton = Array.from(document.querySelectorAll(".cqr-scan-button"))
        .find((button) => button.textContent.includes("深度采集"));
      requireTruthy(captureButton, "deep capture button is missing");
      captureButton.click();
      await waitFor(() => directoryItems().length === questions.length, "deep capture did not collect all questions", 45000);
      await waitFor(() => !Array.from(document.querySelectorAll(".cqr-scan-button"))
        .some((button) => button.textContent.includes("取消深度采集")), "deep capture did not finish", 45000);
      requireNoPluginLineMarkers("after deep capture");
    });

    await check("question export includes every deeply captured question", async () => {
      requireEqual(exportChoices().length, questions.length, "deep question export count");
    });

    localStorage.setItem("voyager_fixture_virtualized_count", String(questions.length));
  }

  async function runRestore() {
    const total = Number(localStorage.getItem("voyager_fixture_virtualized_count") || 60);
    const questions = buildVirtualizedQuestions(total);
    configureConversation(questions, { virtualized: true, start: 24 });

    await check("cache restore keeps all recorded directory entries", async () => {
      await waitFor(() => directoryItems().length === total, "cached directory did not restore", 10000);
      requireNoPluginLineMarkers("cache restore");
      requireEqual(
        Array.from(document.querySelectorAll(".cqr-directory-text"))
          .filter((node) => node.textContent === "Repeated virtualized question text")
          .length,
        2,
        "cached repeated question count"
      );
    });

    await check("cached question export keeps every recorded question", async () => {
      requireEqual(exportChoices().length, total, "cached question export count");
    });

    await check("clicking cached first item loads and reveals its question", async () => {
      const items = directoryItems();
      items[0].click();
      await waitFor(() => targetVisible(0), "cached first question was not loaded and revealed", 15000);
    });
  }

  async function run() {
    let expectedChecks = 0;
    if (scenario === "basic") expectedChecks = 10;
    if (scenario === "virtualized") expectedChecks = 4;
    if (scenario === "restore") expectedChecks = 3;
    if (scenario === "compatibility") expectedChecks = 7;
    if (scenario === "answer-pairing") expectedChecks = 6;
    if (scenario === "answer-identity") expectedChecks = 1;
    if (scenario === "modern-chat") expectedChecks = 2;
    if (scenario === "modern-cache") expectedChecks = 2;
    if (scenario === "real-snapshot") expectedChecks = 1;

    if (scenario === "basic") await runBasic();
    else if (scenario === "virtualized") await runVirtualized();
    else if (scenario === "restore") await runRestore();
    else if (scenario === "compatibility") await runCompatibility();
    else if (scenario === "answer-pairing") await runAnswerPairing();
    else if (scenario === "answer-identity") await runAnswerIdentity();
    else if (scenario === "modern-chat" || scenario === "modern-cache") await runModernChat();
    else if (scenario === "real-snapshot") await runRealSnapshot();
    else record("known scenario", false, `Unsupported scenario ${scenario}`);

    await wait(100);
    if (uncaughtErrors.length > 0) {
      record("no uncaught runtime errors", false, uncaughtErrors.join(" | "));
    } else {
      record("no uncaught runtime errors", true);
    }

    const failures = results.querySelectorAll('[data-status="FAIL"]').length;
    const passes = results.querySelectorAll('[data-status="PASS"]').length;
    const complete = failures === 0 && passes === expectedChecks + 1;
    status.textContent = complete ? "PASS" : "FAIL";
    status.dataset.status = complete ? "PASS" : "FAIL";
    document.documentElement.dataset.fixtureComplete = "true";
    document.documentElement.dataset.fixtureStatus = complete ? "PASS" : "FAIL";
  }

  window.VoyagerNavigationFixture = {
    run
  };
})();
