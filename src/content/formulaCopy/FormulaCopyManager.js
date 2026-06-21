(function () {
  const FORMULA_COPY_DEBUG = true;

  let toolbar = null;
  let menu = null;
  let activeRoot = null;
  let activeFormula = null;
  let hideTimer = null;
  let initialized = false;

  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `cfc-toast${isError ? " is-error" : ""}`;
    toast.textContent = message;
    document.documentElement.append(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  function ensureUi() {
    if (toolbar && menu) return;

    toolbar = document.createElement("div");
    toolbar.id = "cqr-formula-copy-toolbar";
    toolbar.className = "cfc-toolbar";
    toolbar.hidden = true;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "cfc-copy-button";
    copyButton.textContent = "复制公式";
    copyButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (FORMULA_COPY_DEBUG) console.log("[FormulaCopy] copy clicked");
      toggleMenu();
    });

    menu = document.createElement("div");
    menu.className = "cfc-menu";
    menu.hidden = true;

    [
      ["Word UnicodeMath 推荐", copyWordUnicodeMath],
      ["WPS LaTeX", copyWpsLatex],
      ["Markdown LaTeX", copyMarkdownLatex],
      ["原始 LaTeX", copyRawLatex]
    ].forEach(([label, handler]) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "cfc-menu-item";
      item.textContent = label;
      item.addEventListener("click", handler);
      menu.append(item);
    });

    toolbar.append(copyButton, menu);
    toolbar.addEventListener("mouseenter", cancelHide);
    toolbar.addEventListener("mouseleave", scheduleHide);
    toolbar.addEventListener("mousedown", (event) => event.preventDefault());
    (document.body || document.documentElement).append(toolbar);
  }

  function cancelHide() {
    window.clearTimeout(hideTimer);
  }

  function scheduleHide() {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideToolbar, 300);
  }

  function hideToolbar() {
    activeRoot?.classList?.remove?.("cfc-formula-active");
    activeRoot = null;
    activeFormula = null;

    if (toolbar) {
      toolbar.classList.remove("is-visible");
      toolbar.hidden = true;
    }

    if (menu) {
      menu.classList.remove("is-visible");
      menu.hidden = true;
    }
  }

  function looksLikeFormulaSelection(text) {
    return /\\\s*[a-zA-Z]+|[=+\-*/^_{}×÷±≤≥≈]|[A-Za-z]\s*[=+\-*/^_{}×÷]|θ|λ|π|∫|√|Σ|Δ|α|β|γ|cos|sin|tan|Gain|Bias|DN/.test(String(text || ""));
  }

  function formulaDataFromRoot(root) {
    const formula = window.CQRFormulaExtract.extractFormulaData(root);
    if (formula) return formula;

    return {
      latex: "",
      mathml: "",
      isDisplay: false,
      source: "text-fallback",
      isFallback: true,
      isReliableLatex: false,
      selectorMatched: ""
    };
  }

  function positionToolbarFromRect(rect, preferBelow = false) {
    if (!toolbar || toolbar.hidden) return;

    const top = preferBelow
      ? Math.min(window.innerHeight - toolbar.offsetHeight - 8, rect.bottom + 8)
      : Math.min(
        window.innerHeight - toolbar.offsetHeight - 8,
        Math.max(8, rect.top + rect.height / 2 - toolbar.offsetHeight / 2)
      );
    const desiredLeft = preferBelow ? rect.left : rect.right + 8;
    const left = Math.min(
      window.innerWidth - toolbar.offsetWidth - 8,
      Math.max(8, desiredLeft)
    );

    toolbar.style.top = `${Math.round(top)}px`;
    toolbar.style.left = `${Math.round(left)}px`;
  }

  function showToolbar(root, formula, rectOverride, preferBelow = false) {
    ensureUi();
    cancelHide();

    activeRoot?.classList?.remove?.("cfc-formula-active");
    activeRoot = root;
    activeFormula = formula;
    activeRoot?.classList?.add?.("cfc-formula-active");

    toolbar.hidden = false;
    menu.hidden = true;
    menu.classList.remove("is-visible");

    const rect = rectOverride || root.getBoundingClientRect();
    positionToolbarFromRect(rect, preferBelow);

    requestAnimationFrame(() => {
      positionToolbarFromRect(rect, preferBelow);
      toolbar.classList.add("is-visible");
      if (FORMULA_COPY_DEBUG) console.log("[FormulaCopy] toolbar shown");
    });
  }

  function detectFormulaAtPoint(event) {
    const target = document.elementFromPoint(event.clientX, event.clientY) || event.target;
    const root = window.CQRFormulaExtract.findFormulaElement(target);
    if (!root) return;

    const formula = formulaDataFromRoot(root);
    if (FORMULA_COPY_DEBUG) {
      console.log("[FormulaCopy] formula detected", {
        matchedSelector: formula.selectorMatched,
        latex: formula.latex,
        source: formula.source,
        isReliableLatex: formula.isReliableLatex
      });
    }
    showToolbar(root, formula);
  }

  function handlePointerMove(event) {
    if (toolbar?.contains(event.target)) return;
    detectFormulaAtPoint(event);
  }

  function handleMouseOver(event) {
    const root = window.CQRFormulaExtract.findFormulaElement(event.target);
    if (!root) return;

    const formula = formulaDataFromRoot(root);
    if (FORMULA_COPY_DEBUG) {
      console.log("[FormulaCopy] formula detected", {
        matchedSelector: formula.selectorMatched,
        latex: formula.latex,
        source: formula.source,
        isReliableLatex: formula.isReliableLatex
      });
    }
    showToolbar(root, formula);
  }

  function handleMouseOut(event) {
    if (!activeRoot) return;
    const next = event.relatedTarget;
    if (next && (activeRoot.contains?.(next) || toolbar?.contains(next))) return;
    scheduleHide();
  }

  function selectionRangeRect(selection) {
    if (!selection || selection.rangeCount === 0) return null;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return rect;
  }

  function formulaRootFromSelection(selection) {
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container instanceof Element ? container : container.parentElement;
    if (!element) return null;

    return window.CQRFormulaExtract.findFormulaElement(element)
      || element.closest?.(".katex-display, .katex")
      || element.querySelector?.(".katex-display, .katex, math");
  }

  function showForCurrentSelection() {
    const selection = window.getSelection?.();
    const text = selection?.toString?.().trim() || "";
    if (!text) return false;

    const rect = selectionRangeRect(selection);
    if (!rect) return false;

    const root = formulaRootFromSelection(selection);
    const selectionFormula = window.CQRFormulaExtract.extractLatexFromSelection();
      if (!root && !selectionFormula && !looksLikeFormulaSelection(text)) {
        return false;
      }

    const rootFormula = root ? formulaDataFromRoot(root) : null;
    const formula = (rootFormula?.isReliableLatex ? rootFormula : null)
      || selectionFormula
      || rootFormula
      || {
        latex: text,
        mathml: "",
        isDisplay: /\n/.test(text),
        source: "text-fallback",
        isFallback: true,
        isReliableLatex: false,
        selectorMatched: "selection"
      };

    if (FORMULA_COPY_DEBUG) {
      console.log("[FormulaCopy] formula detected", {
        matchedSelector: formula.selectorMatched,
        latex: formula.latex,
        source: formula.source,
        isReliableLatex: formula.isReliableLatex
      });
    }

    showToolbar(root || {
      getBoundingClientRect: () => rect,
      classList: { add() {}, remove() {} },
      contains: () => false
    }, formula, rect, true);
    return true;
  }

  function handleSelectionChange() {
    window.setTimeout(() => {
      showForCurrentSelection();
    }, 0);
  }

  function handleSelectionMouseUp() {
    window.setTimeout(() => {
      if (showForCurrentSelection()) return;

      const selection = window.getSelection?.();
      const text = selection?.toString?.().trim() || "";
      if (!text) return;

      const rect = selectionRangeRect(selection);
      if (!rect) return;

      showToolbar({
        getBoundingClientRect: () => rect,
        classList: { add() {}, remove() {} },
        contains: () => false
      }, {
        latex: text,
        mathml: "",
        isDisplay: /\n/.test(text),
        source: "text-fallback",
        isFallback: true,
        isReliableLatex: false,
        selectorMatched: "selection-fallback"
      }, rect, true);
    }, 30);
  }

  function toggleMenu() {
    if (!menu) return;
    const shouldOpen = menu.hidden;
    menu.hidden = !shouldOpen;
    menu.classList.toggle("is-visible", shouldOpen);
  }

  function fallbackMessageFor(formula) {
    return formula?.source === "text-fallback"
      ? "未识别到可靠 LaTeX 源码，已复制可见文本。"
      : "";
  }

  async function copyWithFeedback(event, action, successMessage) {
    event.preventDefault();
    event.stopPropagation();
    if (!activeFormula) {
      showToast("未识别到可靠 LaTeX 源码", true);
      return;
    }

    try {
      const result = await action(activeFormula);
      showToast(messageForCopyResult(result) || fallbackMessageFor(activeFormula) || successMessage);
      hideToolbar();
    } catch (error) {
      console.error("Formula copy failed", error);
      if (error?.message === "word-unicodemath-copy-failed") {
        showToast("复制 Word UnicodeMath 失败。", true);
        return;
      }
      showToast("复制公式失败", true);
    }
  }

  function messageForCopyResult(result) {
    if (result === "word-unicodemath") {
      return "已复制 Word UnicodeMath。请在 Word 中按 Alt+= 后粘贴，必要时按空格或转换为 Professional。";
    }

    if (result === "word-unicodemath-unreliable") {
      return "未识别到可靠 LaTeX 源码，无法生成 Word UnicodeMath。";
    }

    if (result === "word-mathml") {
      return "已复制 Word MathML。若未自动转公式，请改用 Word UnicodeMath。";
    }

    if (result === "word-mathml-fallback") {
      return "Word MathML 写入失败，已复制 Word UnicodeMath。";
    }

    if (result === "word-mathml-unreliable") {
      return "未识别到可靠 LaTeX 源码，无法生成 Word MathML。";
    }

    if (result === "latex-fallback") {
      return "未检测到 MathML，已复制 LaTeX。";
    }

    return "";
  }

  function copyWordUnicodeMath(event) {
    copyWithFeedback(event, window.CQRFormulaClipboard.copyAsWordUnicodeMath, "已复制 Word UnicodeMath。");
  }

  function copyMarkdownLatex(event) {
    copyWithFeedback(event, window.CQRFormulaClipboard.copyAsMarkdownLatex, "已复制 Markdown LaTeX。");
  }

  function copyWpsLatex(event) {
    copyWithFeedback(event, window.CQRFormulaClipboard.copyAsWpsLatex, "已复制 WPS LaTeX。");
  }

  function copyRawLatex(event) {
    copyWithFeedback(event, window.CQRFormulaClipboard.copyAsRawLatex, "已复制原始 LaTeX。");
  }

  function initFormulaCopy() {
    if (initialized) {
      window.__CQRFormulaCopyPrimaryReady = true;
      return;
    }
    if (!window.CQRFormulaExtract || !window.CQRFormulaClipboard) return;
    initialized = true;
    window.__CQRFormulaCopyPrimaryReady = true;
    ensureUi();

    console.log("[FormulaCopy] initialized");
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("mouseover", handleMouseOver, true);
    document.addEventListener("mouseout", handleMouseOut, true);
    window.addEventListener("scroll", () => {
      if (activeRoot && toolbar && !toolbar.hidden) {
        positionToolbarFromRect(activeRoot.getBoundingClientRect());
      }
    }, { passive: true, capture: true });
    window.addEventListener("resize", () => {
      if (activeRoot && toolbar && !toolbar.hidden) {
        positionToolbarFromRect(activeRoot.getBoundingClientRect());
      }
    });
  }

  window.initFormulaCopy = initFormulaCopy;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFormulaCopy, { once: true });
  } else {
    initFormulaCopy();
  }
})();
