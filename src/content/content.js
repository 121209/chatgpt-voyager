(function () {
  const APP_ID = "cgpt-question-rail";
  const USER_MESSAGE_SELECTOR = '[data-message-author-role="user"]';

  let rail = null;
  let directory = null;
  let directoryButton = null;
  let directoryButtonTrigger = null;
  let tooltip = null;
  let questions = [];
  let observer = null;
  let refreshTimer = null;
  let activeIndex = -1;
  let searchQuery = "";
  let activeTab = "directory";
  let exportSelectionReady = false;
  let selectedMessageKeys = new Set();
  let knownMessageKeys = new Set();
  let hideDirectoryButtonTimer = null;
  let directoryResizeState = null;

  function getUserMessages() {
    return Array.from(document.querySelectorAll(USER_MESSAGE_SELECTOR))
      .filter((node) => !node.closest(`#${APP_ID}`));
  }

  function getMessageText(node) {
    return (node.innerText || node.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function padDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function currentTimestampForFile() {
    const now = new Date();
    return [
      now.getFullYear(),
      padDatePart(now.getMonth() + 1),
      padDatePart(now.getDate())
    ].join("-") + "-" + [
      padDatePart(now.getHours()),
      padDatePart(now.getMinutes()),
      padDatePart(now.getSeconds())
    ].join("-");
  }

  function getLoadedMessages() {
    return Array.from(document.querySelectorAll("[data-message-author-role]"))
      .filter((node) => !node.closest(`#${APP_ID}`))
      .map((node, index) => ({
        role: node.getAttribute("data-message-author-role") || "message",
        text: getMessageText(node),
        node,
        index,
        key: `${node.getAttribute("data-message-author-role") || "message"}-${index}`
      }))
      .filter((message) => message.text.length > 0);
  }

  function syncExportSelection(messages) {
    const nextKeys = new Set(messages.map((message) => message.key));

    if (!exportSelectionReady) {
      selectedMessageKeys = new Set(nextKeys);
      exportSelectionReady = true;
    } else {
      messages.forEach((message) => {
        if (!knownMessageKeys.has(message.key)) {
          selectedMessageKeys.add(message.key);
        }
      });

      selectedMessageKeys = new Set(
        Array.from(selectedMessageKeys).filter((key) => nextKeys.has(key))
      );
    }

    knownMessageKeys = nextKeys;
  }

  function getSelectedMessages() {
    const messages = getLoadedMessages();
    syncExportSelection(messages);
    return messages.filter((message) => selectedMessageKeys.has(message.key));
  }

  function roleHeading(role) {
    if (role === "user") return "User";
    if (role === "assistant") return "Assistant";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  function buildMarkdownExport() {
    const counters = {};
    const sections = getSelectedMessages().map((message) => {
      const heading = roleHeading(message.role);
      counters[heading] = (counters[heading] || 0) + 1;
      return `## ${heading} ${counters[heading]}\n\n${message.text}`;
    });

    return [
      "# ChatGPT Conversation Export",
      "",
      `Exported at: ${new Date().toLocaleString()}`,
      `Source: ${location.href}`,
      "",
      sections.join("\n\n---\n\n")
    ].join("\n");
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function appendTextSegment(segments, content) {
    if (!content) return;

    const previous = segments[segments.length - 1];
    if (previous?.type === "text") {
      previous.content += content;
    } else {
      segments.push({
        type: "text",
        content
      });
    }
  }

  function appendNewline(segments) {
    const previous = segments[segments.length - 1];
    if (!previous || previous.type !== "text" || !/\n\s*$/.test(previous.content)) {
      appendTextSegment(segments, "\n");
    }
  }

  function isPdfBlockElement(element) {
    return [
      "ADDRESS",
      "ARTICLE",
      "ASIDE",
      "BLOCKQUOTE",
      "DIV",
      "FIGURE",
      "FOOTER",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "HEADER",
      "LI",
      "MAIN",
      "OL",
      "P",
      "PRE",
      "SECTION",
      "TABLE",
      "TR",
      "UL"
    ].includes(element.tagName);
  }

  function languageFromCode(code) {
    const className = code?.className || "";
    const match = String(className).match(/language-([^\s]+)/);
    return match ? match[1] : "";
  }

  function shouldSkipPdfElement(element) {
    if (element.matches("button, [role='button'], svg, style, script")) return true;

    const selector = [
      "[data-testid*='reasoning' i]",
      "[data-testid*='thinking' i]",
      "[data-testid*='thought' i]",
      "[aria-label*='思考']",
      "[aria-label*='推理']",
      "[aria-label*='thinking' i]",
      "[aria-label*='reasoning' i]",
      "[class*='reasoning' i]",
      "[class*='thinking' i]",
      "[class*='thought' i]"
    ].join(",");

    if (element.matches(selector) || element.closest(selector)) return true;

    const compactText = (element.innerText || element.textContent || "")
      .replace(/\s+/g, "");
    return /^(已)?思考(中|完成)?(.*)?(展开|收起)?$/.test(compactText)
      || /^(展开|收起)$/.test(compactText);
  }

  function extractRichMessageContent(messageElement) {
    const segments = [];
    const visitedFormulas = new Set();

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        appendTextSegment(segments, node.nodeValue || "");
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const element = node;
      if (element.closest(`#${APP_ID}`)) return;
      if (shouldSkipPdfElement(element)) return;

      const formulaElement = window.CQRFormulaExtract?.findFormulaElement?.(element);
      if (formulaElement && formulaElement === element && !visitedFormulas.has(formulaElement)) {
        const formula = window.CQRFormulaExtract.extractFormulaData(formulaElement);
        visitedFormulas.add(formulaElement);
        if (formula?.latex) {
          segments.push({
            type: "formula",
            latex: formula.latex,
            mathml: formula.mathml,
            display: formula.isDisplay,
            isFallback: formula.isFallback
          });
        }
        return;
      }

      if (element.matches("pre")) {
        const code = element.querySelector("code") || element;
        segments.push({
          type: "code",
          content: code.innerText || code.textContent || "",
          language: languageFromCode(code)
        });
        return;
      }

      if (element.matches("br")) {
        appendNewline(segments);
        return;
      }

      const isBlock = isPdfBlockElement(element);
      if (isBlock && segments.length > 0) appendNewline(segments);
      Array.from(element.childNodes).forEach(walk);
      if (isBlock) appendNewline(segments);
    }

    walk(messageElement);

    return segments
      .map((segment) => {
        if (segment.type !== "text") return segment;
        return {
          ...segment,
          content: segment.content
            .replace(/\u00a0/g, " ")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
        };
      })
      .filter((segment) => segment.type !== "text" || segment.content.trim().length > 0);
  }

  function getSelectedRichMessages() {
    return getSelectedMessages().map((message) => ({
      role: message.role,
      index: message.index,
      segments: extractRichMessageContent(message.node)
    })).filter((message) => message.segments.length > 0);
  }

  function stripMathDelimitersForPdf(latex) {
    return window.CQRFormulaClipboard?.stripMathDelimiters?.(latex)
      || String(latex || "").trim()
        .replace(/^\\\[\s*([\s\S]*?)\s*\\\]$/, "$1")
        .replace(/^\\\(\s*([\s\S]*?)\s*\\\)$/, "$1")
        .replace(/^\$\$\s*([\s\S]*?)\s*\$\$$/, "$1")
        .replace(/^\$\s*([\s\S]*?)\s*\$$/, "$1")
        .trim();
  }

  function renderFormulaToHtml(segment) {
    const latex = stripMathDelimitersForPdf(segment.latex);
    const fallback = `<span class="formula-fallback">${escapeHtml(latex)}</span>`;

    if (!segment.isFallback && segment.mathml) {
      const mathml = window.CQRFormulaClipboard?.ensureMathMLNamespace
        ? window.CQRFormulaClipboard.ensureMathMLNamespace(segment.mathml)
        : segment.mathml;
      return mathml || fallback;
    }

    return fallback;
  }

  function renderRichSegmentsToHtml(segments) {
    return segments.map((segment) => {
      if (segment.type === "code") {
        const language = segment.language
          ? `<div class="code-language">${escapeHtml(segment.language)}</div>`
          : "";
        return `<pre>${language}<code>${escapeHtml(segment.content)}</code></pre>`;
      }

      if (segment.type === "formula") {
        const formulaHtml = renderFormulaToHtml(segment);
        if (segment.display) {
          return `<div class="formula formula-display">${formulaHtml}</div>`;
        }

        return `<span class="formula formula-inline">${formulaHtml}</span>`;
      }

      return `<span class="content-text">${escapeHtml(segment.content)}</span>`;
    }).join("");
  }

  function generatePrintHtml(messages, sourceUrl) {
    const exportedAt = new Date().toLocaleString();
    const counters = {};
    const messageHtml = messages.map((message) => {
      const heading = roleHeading(message.role);
      counters[heading] = (counters[heading] || 0) + 1;

      return `
        <section class="message">
          <div class="role">${escapeHtml(`${heading} ${counters[heading]}`)}</div>
          <div class="content">${renderRichSegmentsToHtml(message.segments)}</div>
        </section>
      `;
    }).join("");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ChatGPT Conversation Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      background: #f6f7f9;
      color: #111827;
      margin: 0;
      padding: 32px;
    }

    .page {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    }

    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }

    .print-button {
      padding: 10px 16px;
      border: 1px solid #d0d7de;
      border-radius: 10px;
      background: #ffffff;
      color: #111827;
      cursor: pointer;
      font-size: 14px;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.25;
    }

    .meta {
      color: #64748b;
      font-size: 13px;
      line-height: 1.7;
      margin-bottom: 18px;
      word-break: break-all;
    }

    .message {
      border-top: 1px solid #e5e7eb;
      padding: 14px 0;
      break-inside: auto;
      page-break-inside: auto;
    }

    .role {
      color: #334155;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .content {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 15px;
      line-height: 1.65;
    }

    .content-text {
      white-space: pre-wrap;
    }

    .formula {
      color: #111827;
    }

    .formula-inline {
      display: inline;
      white-space: normal;
    }

    .formula-display {
      display: block;
      margin: 10px 0;
      overflow-x: auto;
      text-align: center;
      white-space: normal;
    }

    .formula math {
      font-size: 1.08em;
      max-width: 100%;
    }

    .formula-inline math {
      display: inline math;
      vertical-align: middle;
    }

    .formula-display math {
      display: block math;
      margin: 0 auto;
    }

    .formula-fallback {
      border-radius: 6px;
      background: #f8fafc;
      padding: 0 4px;
      color: #334155;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      white-space: pre-wrap;
    }

    pre,
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }

    pre {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 10px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .code-language {
      margin: 0 0 8px;
      color: #64748b;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    }

    @page {
      size: A4;
      margin: 14mm;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }

      .page {
        max-width: none;
        box-shadow: none;
        border-radius: 0;
        padding: 0;
      }

      .toolbar {
        display: none;
      }

      .message {
        break-inside: auto;
        page-break-inside: auto;
      }

      .formula-display {
        overflow: visible;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <button id="cqr-print-button" class="print-button" type="button">打印 / 保存为 PDF</button>
    </div>
    <h1>ChatGPT Conversation Export</h1>
    <div class="meta">
      <div>Exported at: ${escapeHtml(exportedAt)}</div>
      <div>Source: ${escapeHtml(sourceUrl)}</div>
      <div>Messages: ${messages.length}</div>
    </div>
    ${messageHtml}
  </div>
  <script>window.focus();<\/script>
</body>
</html>`;
  }

  function openPdfPreview(messages) {
    const preview = window.open("", "_blank");
    if (!preview) {
      showToast("无法打开 PDF 预览页", true);
      return;
    }

    preview.document.open();
    preview.document.write(generatePrintHtml(messages, location.href));
    preview.document.close();
    preview.focus();

    window.setTimeout(() => {
      const printButton = preview.document.getElementById("cqr-print-button");
      const printPreview = () => {
        preview.focus();
        window.setTimeout(() => preview.print(), 50);
      };

      if (printButton) {
        printButton.addEventListener("click", printPreview);
      }

      printPreview();
    }, 100);
  }

  function handleExportPdf() {
    const messages = getSelectedRichMessages();
    if (messages.length === 0) {
      showToast("请至少选择一条消息", true);
      return;
    }

    openPdfPreview(messages);
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function startDirectoryResize(event, direction) {
    if (!directory) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = directory.getBoundingClientRect();
    directoryResizeState = {
      direction,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };

    directory.style.left = `${Math.round(rect.left)}px`;
    directory.style.top = `${Math.round(rect.top)}px`;
    directory.style.right = "auto";
    directory.style.width = `${Math.round(rect.width)}px`;
    directory.style.height = `${Math.round(rect.height)}px`;
    directory.style.transform = "none";
    directory.classList.add("is-resizing");

    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", handleDirectoryResizeMove, true);
    window.addEventListener("pointerup", stopDirectoryResize, true);
    window.addEventListener("pointercancel", stopDirectoryResize, true);
  }

  function handleDirectoryResizeMove(event) {
    if (!directoryResizeState || !directory) return;

    event.preventDefault();

    const state = directoryResizeState;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const minWidth = 320;
    const minHeight = 280;
    const maxWidth = Math.max(minWidth, window.innerWidth - 24);
    const maxHeight = Math.max(minHeight, window.innerHeight - 24);

    let nextLeft = state.left;
    let nextTop = state.top;
    let nextWidth = state.width;
    let nextHeight = state.height;

    if (state.direction.includes("e")) {
      nextWidth = state.width + dx;
    }

    if (state.direction.includes("s")) {
      nextHeight = state.height + dy;
    }

    if (state.direction.includes("w")) {
      nextWidth = state.width - dx;
      nextLeft = state.left + dx;
    }

    if (state.direction.includes("n")) {
      nextHeight = state.height - dy;
      nextTop = state.top + dy;
    }

    nextWidth = clampNumber(nextWidth, minWidth, maxWidth);
    nextHeight = clampNumber(nextHeight, minHeight, maxHeight);

    if (state.direction.includes("w")) {
      nextLeft = state.left + state.width - nextWidth;
    }

    if (state.direction.includes("n")) {
      nextTop = state.top + state.height - nextHeight;
    }

    nextLeft = clampNumber(nextLeft, 12, window.innerWidth - nextWidth - 12);
    nextTop = clampNumber(nextTop, 12, window.innerHeight - nextHeight - 12);

    directory.style.left = `${Math.round(nextLeft)}px`;
    directory.style.top = `${Math.round(nextTop)}px`;
    directory.style.width = `${Math.round(nextWidth)}px`;
    directory.style.height = `${Math.round(nextHeight)}px`;
  }

  function stopDirectoryResize(event) {
    if (!directoryResizeState) return;

    if (event?.pointerId === directoryResizeState.pointerId) {
      event.target?.releasePointerCapture?.(event.pointerId);
    }

    directoryResizeState = null;
    directory?.classList.remove("is-resizing");
    window.removeEventListener("pointermove", handleDirectoryResizeMove, true);
    window.removeEventListener("pointerup", stopDirectoryResize, true);
    window.removeEventListener("pointercancel", stopDirectoryResize, true);
  }

  function ensureDirectoryResizeHandles() {
    if (!directory) return;

    ["n", "e", "s", "w", "ne", "se", "sw", "nw"].forEach((direction) => {
      if (directory.querySelector(`.cqr-resize-handle[data-direction="${direction}"]`)) return;

      const handle = document.createElement("div");
      handle.className = `cqr-resize-handle is-${direction}`;
      handle.dataset.direction = direction;
      handle.setAttribute("aria-hidden", "true");
      handle.addEventListener("pointerdown", (event) => startDirectoryResize(event, direction));
      directory.append(handle);
    });
  }

  function ensureRail() {
    if (rail) return rail;

    rail = document.createElement("nav");
    rail.id = APP_ID;
    rail.className = "cqr-rail";
    rail.setAttribute("aria-label", "ChatGPT user questions");
    document.documentElement.append(rail);

    directory = document.createElement("aside");
    directory.className = "cqr-directory";
    directory.setAttribute("aria-label", "All user questions");
    directory.hidden = true;
    document.documentElement.append(directory);

    directoryButtonTrigger = document.createElement("div");
    directoryButtonTrigger.className = "cqr-menu-trigger";
    document.documentElement.append(directoryButtonTrigger);

    directoryButton = document.createElement("button");
    directoryButton.type = "button";
    directoryButton.className = "cqr-menu-button";
    directoryButton.title = "Questions";
    directoryButton.setAttribute("aria-label", "Open question directory");
    directoryButton.innerHTML = "<span></span><span></span><span></span>";
    directoryButton.addEventListener("click", () => toggleDirectory());
    document.documentElement.append(directoryButton);

    tooltip = document.createElement("div");
    tooltip.className = "cqr-tooltip";
    tooltip.hidden = true;
    document.documentElement.append(tooltip);

    directoryButtonTrigger.addEventListener("mouseenter", showDirectoryButton);
    directoryButtonTrigger.addEventListener("mouseleave", scheduleHideDirectoryButton);
    directoryButton.addEventListener("mouseenter", showDirectoryButton);
    directoryButton.addEventListener("mouseleave", scheduleHideDirectoryButton);

    rail.addEventListener("click", (event) => {
      if (event.target.closest(".cqr-dot")) return;
      toggleDirectory();
    });

    return rail;
  }

  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `cqr-toast${isError ? " is-error" : ""}`;
    toast.textContent = message;
    document.documentElement.append(toast);
    window.setTimeout(() => toast.remove(), 2400);
  }

  function toggleDirectory(forceOpen) {
    if (!directory || questions.length === 0) return;

    const shouldOpen = forceOpen ?? directory.hidden;
    directory.hidden = !shouldOpen;
    directoryButton?.classList.toggle("is-active", shouldOpen);
    if (shouldOpen) {
      showDirectoryButton();
    } else {
      scheduleHideDirectoryButton();
    }
  }

  function showDirectoryButton() {
    window.clearTimeout(hideDirectoryButtonTimer);
    directoryButton?.classList.add("is-visible");
  }

  function scheduleHideDirectoryButton() {
    window.clearTimeout(hideDirectoryButtonTimer);
    hideDirectoryButtonTimer = window.setTimeout(() => {
      if (!directory || !directory.hidden) return;
      directoryButton?.classList.remove("is-visible");
    }, 260);
  }

  function showTooltip(dot, text) {
    if (!tooltip) return;

    const rect = dot.getBoundingClientRect();
    tooltip.textContent = text || dot.getAttribute("aria-label") || "";
    tooltip.hidden = false;
    tooltip.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    tooltip.style.right = `${Math.round(window.innerWidth - rect.left + 13)}px`;
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  function scrollToQuestion(index) {
    const question = questions[index];
    if (!question) return;

    question.node.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function setActiveDot(index) {
    if (activeIndex === index) return;

    activeIndex = index;
    rail?.querySelectorAll(".cqr-dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
      dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
    });
    directory?.querySelectorAll(".cqr-directory-item").forEach((item) => {
      const isActive = Number(item.dataset.index) === index;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  function updateActiveDot() {
    if (questions.length === 0) {
      setActiveDot(-1);
      return;
    }

    const anchorY = Math.min(window.innerHeight * 0.35, 260);
    let nextIndex = 0;

    questions.forEach((question, index) => {
      if (question.node.getBoundingClientRect().top <= anchorY) {
        nextIndex = index;
      }
    });

    setActiveDot(nextIndex);
  }

  function renderRail() {
    const root = ensureRail();
    questions = getUserMessages().map((node, index) => ({
      node,
      index,
      text: getMessageText(node)
    }));

    root.textContent = "";
    root.hidden = questions.length === 0;
    if (directoryButton) directoryButton.hidden = questions.length === 0;
    if (directoryButtonTrigger) directoryButtonTrigger.hidden = questions.length === 0;
    if (directory) {
      directory.hidden = directory.hidden || questions.length === 0;
      directory.textContent = "";
      renderDirectory();
    }

    questions.forEach((question, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "cqr-dot";
      dot.title = question.text || `Question ${index + 1}`;
      dot.dataset.question = question.text || `Question ${index + 1}`;
      dot.setAttribute("aria-label", `Question ${index + 1}`);
      dot.addEventListener("mouseenter", () => showTooltip(dot, question.text));
      dot.addEventListener("focus", () => showTooltip(dot, question.text));
      dot.addEventListener("mouseleave", hideTooltip);
      dot.addEventListener("blur", hideTooltip);
      dot.addEventListener("click", (event) => {
        event.stopPropagation();
        scrollToQuestion(index);
      });
      root.append(dot);
    });

    activeIndex = -1;
    updateActiveDot();
  }

  function questionMatchesSearch(question) {
    return !searchQuery || question.text.toLowerCase().includes(searchQuery.toLowerCase());
  }

  function renderDirectory(keepSearchFocus = false) {
    if (!directory) return;

    directory.textContent = "";

    const tabs = document.createElement("div");
    tabs.className = "cqr-tabs";

    const directoryTab = document.createElement("button");
    directoryTab.type = "button";
    directoryTab.className = "cqr-tab";
    directoryTab.textContent = "目录";
    directoryTab.setAttribute("aria-selected", String(activeTab === "directory"));
    directoryTab.addEventListener("click", () => {
      activeTab = "directory";
      renderDirectory();
      updateActiveDot();
    });

    const exportTab = document.createElement("button");
    exportTab.type = "button";
    exportTab.className = "cqr-tab";
    exportTab.textContent = "导出";
    exportTab.setAttribute("aria-selected", String(activeTab === "export"));
    exportTab.addEventListener("click", () => {
      activeTab = "export";
      renderDirectory();
    });

    tabs.append(directoryTab, exportTab);
    directory.append(tabs);

    if (activeTab === "export") {
      renderExportPanel();
      ensureDirectoryResizeHandles();
      return;
    }

    const search = document.createElement("input");
    search.className = "cqr-directory-search";
    search.type = "search";
    search.placeholder = "搜索...";
    search.value = searchQuery;
    search.addEventListener("input", () => {
      searchQuery = search.value.trim();
      renderDirectory(true);
      updateActiveDot();
    });

    const list = document.createElement("div");
    list.className = "cqr-directory-list";

    questions
      .filter(questionMatchesSearch)
      .forEach((question, visibleIndex) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "cqr-directory-item";
        item.dataset.index = String(question.index);
        item.setAttribute("aria-current", question.index === activeIndex ? "true" : "false");
        item.classList.toggle("is-active", question.index === activeIndex);

        const number = document.createElement("span");
        number.className = "cqr-directory-number";
        number.textContent = String(question.index + 1);

        const text = document.createElement("span");
        text.className = "cqr-directory-text";
        text.textContent = question.text || `Question ${visibleIndex + 1}`;

        item.append(number, text);
        item.addEventListener("click", () => {
          scrollToQuestion(question.index);
          toggleDirectory(false);
        });
        list.append(item);
      });

    directory.append(search, list);
    ensureDirectoryResizeHandles();

    if (keepSearchFocus) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  }

  async function copyMarkdown() {
    if (getSelectedMessages().length === 0) {
      showToast("请先选择要导出的对话", true);
      return;
    }

    const markdown = buildMarkdownExport();

    try {
      await navigator.clipboard.writeText(markdown);
      showToast("已复制 Markdown");
    } catch (error) {
      console.error("Failed to copy Markdown", error);
      showToast("复制 Markdown 失败", true);
    }
  }

  function downloadMarkdown() {
    if (getSelectedMessages().length === 0) {
      showToast("请先选择要导出的对话", true);
      return;
    }

    const markdown = buildMarkdownExport();
    const filename = `chatgpt-conversation-${currentTimestampForFile()}.md`;

    chrome.runtime.sendMessage({
      type: "download-markdown",
      filename,
      markdown
    }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        console.error("Failed to export Markdown", chrome.runtime.lastError || response?.error);
        showToast("导出 Markdown 失败", true);
        return;
      }

      showToast("已导出 Markdown");
    });
  }

  function shouldRemoveFromImageExport(element) {
    if (!(element instanceof Element)) return false;
    if (element.closest(`#${APP_ID}`)) return true;
    if (element.matches("script, style, link, textarea, input, select")) return true;
    if (element.matches("button, [role='button']")) return true;

    const selector = [
      "[data-testid*='copy' i]",
      "[data-testid*='reasoning' i]",
      "[data-testid*='thinking' i]",
      "[data-testid*='thought' i]",
      "[aria-label*='复制']",
      "[aria-label*='copy' i]",
      "[aria-label*='思考']",
      "[aria-label*='推理']",
      "[aria-label*='thinking' i]",
      "[aria-label*='reasoning' i]",
      "[class*='reasoning' i]",
      "[class*='thinking' i]",
      "[class*='thought' i]"
    ].join(",");

    if (element.matches(selector) || element.closest(selector)) return true;

    const compactText = (element.innerText || element.textContent || "")
      .replace(/\s+/g, "");
    return /^(已)?思考(中|完成)?(.*)?(展开|收起)?$/.test(compactText)
      || /^(展开|收起)$/.test(compactText);
  }

  function sanitizeImageExportClone(root) {
    Array.from(root.querySelectorAll("*")).forEach((element) => {
      if (shouldRemoveFromImageExport(element)) element.remove();
    });
  }

  function cloneMessageForImageExport(message) {
    const clone = message.node.cloneNode(true);
    sanitizeImageExportClone(clone);

    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    clone.style.animation = "none";
    clone.style.transition = "none";
    clone.style.maxWidth = "none";
    clone.style.width = "100%";

    const wrapper = document.createElement("section");
    wrapper.className = "cqr-image-message";
    wrapper.dataset.role = message.role;
    wrapper.style.cssText = [
      "display:block",
      "width:100%",
      "margin:0",
      "padding:0",
      "color:#111827",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif"
    ].join(";");

    const content = document.createElement("div");
    content.className = "cqr-image-message-content";
    content.style.cssText = [
      "display:block",
      "width:100%",
      "margin:0",
      "padding:0"
    ].join(";");
    content.append(clone);
    wrapper.append(content);

    return wrapper;
  }

  function createImageExportDocument(messages) {
    const width = Math.min(1080, Math.max(320, window.innerWidth - 32));
    const stage = document.createElement("div");
    stage.className = "cqr-image-export-stage";
    stage.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "inset:0",
      "overflow:hidden",
      "background:#ffffff",
      "pointer-events:none"
    ].join(";");

    const root = document.createElement("div");
    root.className = "cqr-image-export-root";
    root.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:0",
      `width:${width}px`,
      "box-sizing:border-box",
      "padding:42px 52px",
      "background:#ffffff",
      "color:#111827",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif",
      "line-height:1.5",
      "transform:translateX(-50%)"
    ].join(";");

    const title = document.createElement("div");
    title.style.cssText = [
      "margin:0 0 8px",
      "font-size:26px",
      "font-weight:700",
      "line-height:1.25",
      "color:#111827"
    ].join(";");
    title.textContent = "ChatGPT Conversation Export";

    const meta = document.createElement("div");
    meta.style.cssText = [
      "margin:0 0 30px",
      "font-size:14px",
      "line-height:1.7",
      "color:#64748b"
    ].join(";");
    meta.textContent = `导出时间：${new Date().toLocaleString()} · 已选消息：${messages.length}`;

    const list = document.createElement("div");
    list.style.cssText = [
      "display:grid",
      "gap:26px",
      "width:100%"
    ].join(";");

    messages.forEach((message) => {
      list.append(cloneMessageForImageExport(message));
    });

    root.append(title, meta, list);
    stage.append(root);
    document.documentElement.append(stage);

    return {
      stage,
      root,
      width
    };
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Failed to encode PNG"));
      }, "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.documentElement.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function requestVisibleTabCapture() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: "capture-visible-tab"
      }, (response) => {
        if (chrome.runtime.lastError || !response?.ok || !response.url) {
          reject(new Error(chrome.runtime.lastError?.message || response?.error || "Failed to capture tab"));
          return;
        }

        resolve(response.url);
      });
    });
  }

  async function captureVisibleTabPng() {
    let lastError = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await requestVisibleTabCapture();
      } catch (error) {
        lastError = error;
        if (!/capture|quota|rate|activeTab|permission|invoked|visible/i.test(error?.message || "")) {
          break;
        }
        await delay(900 + attempt * 400);
      }
    }

    throw lastError || new Error("Failed to capture tab");
  }

  async function renderMessagesToPngBlob(messages) {
    const exportDocument = createImageExportDocument(messages);

    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const width = Math.ceil(exportDocument.width);
      const height = Math.ceil(exportDocument.root.scrollHeight);
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const viewportHeight = window.innerHeight;
      const rootLeft = Math.round((window.innerWidth - width) / 2);

      if (height * scale > 30000) {
        throw new Error("Image export is too tall");
      }

      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      for (let offset = 0; offset < height; offset += viewportHeight) {
        const segmentHeight = Math.min(viewportHeight, height - offset);
        exportDocument.root.style.transform = `translateX(-50%) translateY(-${offset}px)`;

        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const captureUrl = await captureVisibleTabPng();
        const image = await loadImageFromUrl(captureUrl);
        const imageScale = image.width / window.innerWidth;

        ctx.drawImage(
          image,
          rootLeft * imageScale,
          0,
          width * imageScale,
          segmentHeight * imageScale,
          0,
          offset,
          width,
          segmentHeight
        );

        if (offset + viewportHeight < height) {
          await delay(650);
        }
      }

      return canvasToPngBlob(canvas);
    } finally {
      exportDocument.stage.remove();
    }
  }

  async function handleExportImage() {
    const messages = getSelectedMessages();
    if (messages.length === 0) {
      showToast("请先选择要导出的对话", true);
      return;
    }

    let blob = null;
    try {
      showToast("正在导出图片...");
      blob = await renderMessagesToPngBlob(messages);
    } catch (error) {
      console.error("Failed to render PNG", error);
      const message = error?.message === "Image export is too tall"
        ? "图片过长，请少选几条消息后再导出"
        : `导出图片失败：${error?.message || "请稍后重试"}`;
      showToast(message, true);
      return;
    }

    downloadBlob(blob, `chatgpt-conversation-${currentTimestampForFile()}.png`);
    showToast("已导出图片");
  }

  function renderExportPanel() {
    if (!directory) return;

    const messages = getLoadedMessages();
    syncExportSelection(messages);

    const panel = document.createElement("div");
    panel.className = "cqr-export-panel";

    const selectionActions = document.createElement("div");
    selectionActions.className = "cqr-export-actions";

    const selectAllButton = document.createElement("button");
    selectAllButton.type = "button";
    selectAllButton.className = "cqr-export-mini-button";
    selectAllButton.textContent = "全选";
    selectAllButton.addEventListener("click", () => {
      selectedMessageKeys = new Set(messages.map((message) => message.key));
      renderDirectory();
    });

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "cqr-export-mini-button";
    clearButton.textContent = "清空";
    clearButton.addEventListener("click", () => {
      selectedMessageKeys.clear();
      renderDirectory();
    });

    selectionActions.append(selectAllButton, clearButton);

    const selectionList = document.createElement("div");
    selectionList.className = "cqr-export-list";

    messages.forEach((message) => {
      const label = document.createElement("label");
      label.className = "cqr-export-choice";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selectedMessageKeys.has(message.key);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedMessageKeys.add(message.key);
        } else {
          selectedMessageKeys.delete(message.key);
        }
      });

      const role = document.createElement("span");
      role.className = "cqr-export-role";
      role.textContent = `${roleHeading(message.role)} ${message.index + 1}`;

      const text = document.createElement("span");
      text.className = "cqr-export-text";
      text.textContent = message.text;

      label.append(checkbox, role, text);
      selectionList.append(label);
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "cqr-export-button";
    copyButton.textContent = "复制 Markdown";
    copyButton.addEventListener("click", copyMarkdown);

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "cqr-export-button";
    downloadButton.textContent = "导出 Markdown";
    downloadButton.addEventListener("click", downloadMarkdown);

    const pdfButton = document.createElement("button");
    pdfButton.type = "button";
    pdfButton.className = "cqr-export-button";
    pdfButton.textContent = "导出 PDF";
    pdfButton.addEventListener("click", handleExportPdf);

    const imageButton = document.createElement("button");
    imageButton.type = "button";
    imageButton.className = "cqr-export-button";
    imageButton.textContent = "导出图片";
    imageButton.addEventListener("click", handleExportImage);

    const exportButtonGrid = document.createElement("div");
    exportButtonGrid.className = "cqr-export-button-grid";
    exportButtonGrid.append(copyButton, downloadButton, pdfButton, imageButton);

    panel.append(selectionActions, selectionList, exportButtonGrid);
    directory.append(panel);
  }

  function scheduleRender() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(renderRail, 150);
  }

  function initFormulaCopyFallback() {
    if (window.__CQRFormulaCopyPrimaryReady) return;
    if (window.__CQRFormulaCopyFallbackReady) return;
    window.__CQRFormulaCopyFallbackReady = true;

    let toolbar = null;
    let menu = null;
    let activeFormula = null;
    let hideTimer = null;

    function findFormulaElement(target) {
      if (!(target instanceof Element)) return null;
      return target.closest(".katex-display")
        || target.closest(".katex")
        || target.closest("math");
    }

    function extractLatex(root) {
      const selectionText = window.getSelection?.().toString().trim() || "";
      const annotation = root?.querySelector?.("annotation[encoding='application/x-tex']")
        || root?.closest?.(".katex-display, .katex")?.querySelector?.("annotation[encoding='application/x-tex']");
      const latex = annotation?.textContent?.trim()
        || root?.getAttribute?.("data-math")?.trim()
        || root?.getAttribute?.("aria-label")?.trim()
        || selectionText
        || root?.textContent?.trim()
        || "";

      return {
        latex,
        display: Boolean(root?.closest?.(".katex-display") || root?.matches?.(".katex-display"))
      };
    }

    function stripDelimiters(latex) {
      return String(latex || "")
        .trim()
        .replace(/^\\\[\s*([\s\S]*?)\s*\\\]$/, "$1")
        .replace(/^\\\(\s*([\s\S]*?)\s*\\\)$/, "$1")
        .replace(/^\$\$\s*([\s\S]*?)\s*\$\$$/, "$1")
        .replace(/^\$\s*([\s\S]*?)\s*\$$/, "$1")
        .trim();
    }

    function markdownLatex(formula) {
      const body = stripDelimiters(formula.latex);
      return formula.display ? `\\[\n${body}\n\\]` : `\\( ${body} \\)`;
    }

    function showFormulaToast(message, isError = false) {
      const toast = document.createElement("div");
      toast.textContent = message;
      toast.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "top:24px",
        "right:52px",
        "max-width:360px",
        "padding:9px 12px",
        "border-radius:8px",
        "box-shadow:0 12px 30px rgba(15,23,42,.18)",
        `background:${isError ? "#fef2f2" : "#f0fdf4"}`,
        `color:${isError ? "#991b1b" : "#166534"}`,
        `border:1px solid ${isError ? "rgba(239,68,68,.34)" : "rgba(34,197,94,.34)"}`,
        "font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      ].join(";");
      document.body.append(toast);
      window.setTimeout(() => toast.remove(), 2400);
    }

    function ensureToolbar() {
      if (toolbar) return;

      toolbar = document.createElement("div");
      toolbar.id = "cqr-formula-copy-toolbar-fallback";
      toolbar.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "display:none",
        "gap:4px",
        "padding:6px",
        "border:1px solid rgba(37,99,235,.42)",
        "border-radius:10px",
        "background:rgba(255,255,255,.98)",
        "box-shadow:0 10px 30px rgba(15,23,42,.28)",
        "font:12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      ].join(";");

      const main = document.createElement("button");
      main.type = "button";
      main.textContent = "复制公式";
      main.style.cssText = "padding:6px 10px;border:0;border-radius:7px;background:#eff6ff;color:#1e3a8a;cursor:pointer;font-weight:700;";
      main.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        menu.style.display = menu.style.display === "grid" ? "none" : "grid";
      });

      menu = document.createElement("div");
      menu.style.cssText = "display:none;gap:3px;margin-top:4px;padding-top:4px;border-top:1px solid rgba(148,163,184,.35);";

      [
        ["Markdown LaTeX", () => markdownLatex(activeFormula)],
        ["WPS LaTeX", () => stripDelimiters(activeFormula?.latex)]
      ].forEach(([label, getter]) => {
        const item = document.createElement("button");
        item.type = "button";
        item.textContent = label;
        item.style.cssText = "padding:6px 10px;border:0;border-radius:7px;background:transparent;color:#111827;cursor:pointer;text-align:left;";
        item.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const text = getter();
          if (!text) {
            showFormulaToast("未识别到可靠 LaTeX 源码", true);
            return;
          }
          await navigator.clipboard.writeText(text);
          showFormulaToast(`已复制 ${label}`);
          hideToolbar();
        });
        menu.append(item);
      });

      toolbar.append(main, menu);
      toolbar.addEventListener("mouseenter", () => window.clearTimeout(hideTimer));
      toolbar.addEventListener("mouseleave", scheduleHide);
      document.body.append(toolbar);
    }

    function showToolbar(rect, formula) {
      ensureToolbar();
      activeFormula = formula;
      toolbar.style.display = "grid";
      menu.style.display = "none";
      const top = Math.min(
        window.innerHeight - toolbar.offsetHeight - 8,
        Math.max(8, rect.top + rect.height / 2 - toolbar.offsetHeight / 2)
      );
      const preferredLeft = rect.right + 10;
      const left = preferredLeft + toolbar.offsetWidth <= window.innerWidth - 8
        ? preferredLeft
        : Math.max(8, rect.left - toolbar.offsetWidth - 10);
      toolbar.style.top = `${Math.round(top)}px`;
      toolbar.style.left = `${Math.round(left)}px`;
      console.log("[FormulaCopy] toolbar shown");
    }

    function hideToolbar() {
      if (toolbar) toolbar.style.display = "none";
      if (menu) menu.style.display = "none";
      activeFormula = null;
    }

    function scheduleHide() {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hideToolbar, 300);
    }

    document.addEventListener("pointermove", (event) => {
      if (toolbar?.contains(event.target)) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const root = findFormulaElement(target);
      if (!root) return;
      const formula = extractLatex(root);
      console.log("[FormulaCopy] formula detected", formula);
      showToolbar(root.getBoundingClientRect(), formula);
    }, true);

    document.addEventListener("mouseup", () => {
      window.setTimeout(() => {
        const selection = window.getSelection?.();
        const text = selection?.toString().trim() || "";
        if (!text) return;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) return;
        if (!/[=+\-*/^_{}×÷±]|\\[a-zA-Z]+|cos|sin|tan|θ|π|λ|Gain|Bias|DN/.test(text)) return;
        console.log("[FormulaCopy] formula detected", { latex: text, source: "selection" });
        showToolbar(rect, { latex: text, display: /\n/.test(text) });
      }, 30);
    }, true);

    console.log("[FormulaCopy] initialized");
  }

  function boot() {
    renderRail();
    window.initFormulaCopy?.();
    initFormulaCopyFallback();

    observer = new MutationObserver(scheduleRender);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener("scroll", updateActiveDot, { passive: true, capture: true });
    window.addEventListener("resize", updateActiveDot);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
