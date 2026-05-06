(function () {
  const FORMULA_COPY_DEBUG = true;
  const FORMULA_SELECTOR = ".katex-display, .katex, .katex-mathml, math, annotation[encoding='application/x-tex']";

  function findFormulaElement(target) {
    if (!(target instanceof Element)) return null;

    const display = target.closest(".katex-display");
    if (display instanceof HTMLElement) return display;

    const katex = target.closest(".katex");
    if (katex instanceof HTMLElement) return katex;

    const katexHtml = target.closest(".katex-html");
    if (katexHtml instanceof HTMLElement) {
      const parentKatex = katexHtml.closest(".katex");
      if (parentKatex instanceof HTMLElement) return parentKatex;
    }

    const katexMathml = target.closest(".katex-mathml");
    if (katexMathml instanceof HTMLElement) {
      const parentKatex = katexMathml.closest(".katex");
      if (parentKatex instanceof HTMLElement) return parentKatex;
    }

    const math = target.closest("math");
    if (math instanceof Element) {
      const parent = math.closest(".katex-display") || math.closest(".katex");
      if (parent instanceof HTMLElement) return parent;
      return math;
    }

    const annotation = target.closest('annotation[encoding="application/x-tex"]');
    if (annotation instanceof Element) {
      const parent = annotation.closest(".katex-display") || annotation.closest(".katex");
      if (parent instanceof HTMLElement) return parent;
    }

    return null;
  }

  function isDisplayFormula(formulaElement) {
    if (!formulaElement) return false;
    if (formulaElement.matches(".katex-display") || formulaElement.closest(".katex-display")) return true;

    const math = formulaElement.matches("math")
      ? formulaElement
      : formulaElement.querySelector("math");
    if (math?.getAttribute("display") === "block") return true;

    const style = window.getComputedStyle(formulaElement);
    return style.display === "block" || style.display === "flex";
  }

  function isProbablyLatex(text) {
    const value = String(text || "");
    return /\\(cos|sin|tan|theta|alpha|beta|gamma|frac|sqrt|begin|end|sum|int|pm|cdot|left|right)\b/.test(value)
      || /\\[a-zA-Z]+/.test(value)
      || /[\^_]/.test(value) && /[{}]/.test(value)
      || /\\begin\{[^}]+\}/.test(value);
  }

  function annotationIn(element) {
    return element?.querySelector?.("annotation[encoding='application/x-tex']") || null;
  }

  function isReliableLatexSource(source, latex) {
    if (["annotation", "parent-annotation", "data-math", "selection-latex"].includes(source)) return true;
    if (source === "aria-label") return isProbablyLatex(latex);
    return false;
  }

  function extractLatexFromFormulaElement(formulaElement) {
    if (!formulaElement) return null;

    const annotation = annotationIn(formulaElement);
    if (annotation?.textContent?.trim()) {
      return {
        latex: annotation.textContent.trim(),
        source: "annotation",
        isFallback: false,
        isReliableLatex: true
      };
    }

    const parentAnnotation = annotationIn(formulaElement.closest(".katex"))
      || annotationIn(formulaElement.closest(".katex-display"));
    if (parentAnnotation?.textContent?.trim()) {
      return {
        latex: parentAnnotation.textContent.trim(),
        source: "parent-annotation",
        isFallback: false,
        isReliableLatex: true
      };
    }

    const dataMath = formulaElement.getAttribute("data-math")
      || formulaElement.closest("[data-math]")?.getAttribute("data-math");
    if (dataMath?.trim()) {
      return {
        latex: dataMath.trim(),
        source: "data-math",
        isFallback: false,
        isReliableLatex: true
      };
    }

    const ariaLabel = formulaElement.getAttribute("aria-label")
      || formulaElement.querySelector("[aria-label]")?.getAttribute("aria-label");
    if (ariaLabel?.trim()) {
      return {
        latex: ariaLabel.trim(),
        source: "aria-label",
        isFallback: false,
        isReliableLatex: isReliableLatexSource("aria-label", ariaLabel)
      };
    }

    const fallback = (formulaElement.textContent || "").trim();
    if (!fallback) return null;

    return {
      latex: fallback,
      source: "text-fallback",
      isFallback: true,
      isReliableLatex: false
    };
  }

  function extractLatexFromSelection() {
    const selection = window.getSelection?.();
    const text = selection?.toString?.().trim() || "";
    if (!text) return null;

    const delimiterPatterns = [
      { pattern: /\\\[\s*([\s\S]+?)\s*\\\]/, display: true },
      { pattern: /\\\(\s*([\s\S]+?)\s*\\\)/, display: false },
      { pattern: /\$\$\s*([\s\S]+?)\s*\$\$/, display: true },
      { pattern: /\$\s*([\s\S]+?)\s*\$/, display: false }
    ];

    for (const item of delimiterPatterns) {
      const match = text.match(item.pattern);
      if (match?.[1]?.trim()) {
        return {
          latex: match[1].trim(),
          mathml: "",
          isDisplay: item.display,
          source: "selection-latex",
          isFallback: false,
          isReliableLatex: true,
          selectorMatched: "selection"
        };
      }
    }

    if (isProbablyLatex(text)) {
      return {
        latex: text,
        mathml: "",
        isDisplay: /\n/.test(text),
        source: "selection-latex",
        isFallback: false,
        isReliableLatex: true,
        selectorMatched: "selection"
      };
    }

    return null;
  }

  function extractExistingMathML(formulaElement) {
    if (!formulaElement) return "";

    const math = formulaElement.querySelector(".katex-mathml math")
      || (formulaElement.matches("math") ? formulaElement : null)
      || formulaElement.querySelector("math");

    return math?.outerHTML || "";
  }

  function selectorMatched(formulaElement) {
    if (!formulaElement) return "";
    if (formulaElement.matches(".katex-display")) return ".katex-display";
    if (formulaElement.matches(".katex")) return ".katex";
    if (formulaElement.matches("math")) return "math";
    if (formulaElement.matches(".katex-mathml")) return ".katex-mathml";
    return FORMULA_SELECTOR;
  }

  function extractFormulaData(formulaElement) {
    const latexData = extractLatexFromFormulaElement(formulaElement);

    return {
      latex: latexData?.latex || "",
      mathml: extractExistingMathML(formulaElement),
      isDisplay: isDisplayFormula(formulaElement),
      source: latexData?.source || "text-fallback",
      isFallback: latexData?.isFallback ?? true,
      isReliableLatex: latexData?.isReliableLatex ?? false,
      selectorMatched: selectorMatched(formulaElement)
    };
  }

  function debugFormulaData(formulaElementOrData) {
    const data = formulaElementOrData?.latex
      ? formulaElementOrData
      : extractFormulaData(formulaElementOrData);
    if (!data) return;

    const normalizedLatex = window.CQRFormulaClipboard?.stripMathDelimiters
      ? window.CQRFormulaClipboard.stripMathDelimiters(data.latex)
      : data.latex;

    console.table([{
      latex: data.latex,
      normalizedLatex,
      display: data.isDisplay,
      source: data.source,
      hasMathML: Boolean(data.mathml),
      selectorMatched: data.selectorMatched,
      isFallback: data.isFallback,
      isReliableLatex: data.isReliableLatex
    }]);
  }

  window.CQRFormulaExtract = {
    FORMULA_COPY_DEBUG,
    FORMULA_SELECTOR,
    findFormulaElement,
    getFormulaRoot: findFormulaElement,
    extractLatexSource: extractLatexFromFormulaElement,
    extractLatexFromFormulaElement,
    extractLatexFromSelection,
    extractExistingMathML,
    isDisplayFormula,
    isProbablyLatex,
    isReliableLatexSource,
    extractFormulaData,
    debugFormulaData
  };
})();
