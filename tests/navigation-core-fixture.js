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
  let virtualQuestions = [];
  let lastWindowStart = -1;
  let virtualized = false;

  window.chrome = window.chrome || {
    runtime: {
      lastError: null,
      sendMessage(_message, callback) {
        callback?.({ ok: true });
      }
    }
  };

  history.replaceState(
    {},
    "",
    `/c/navigation-fixture-${encodeURIComponent(fixtureGroup)}-${encodeURIComponent(fixtureRun)}?scenario=${encodeURIComponent(scenario)}&fixtureRun=${encodeURIComponent(fixtureRun)}`
  );

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
    if (scenario === "basic") expectedChecks = 7;
    if (scenario === "virtualized") expectedChecks = 4;
    if (scenario === "restore") expectedChecks = 3;

    if (scenario === "basic") await runBasic();
    else if (scenario === "virtualized") await runVirtualized();
    else if (scenario === "restore") await runRestore();
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
