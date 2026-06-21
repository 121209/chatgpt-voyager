(function () {
  const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripMathDelimiters(latex) {
    let value = String(latex || "").trim();

    const pairs = [
      [/^\\\[\s*([\s\S]*?)\s*\\\]$/, "$1"],
      [/^\\\(\s*([\s\S]*?)\s*\\\)$/, "$1"],
      [/^\$\$\s*([\s\S]*?)\s*\$\$$/, "$1"],
      [/^\$\s*([\s\S]*?)\s*\$$/, "$1"]
    ];

    for (const [pattern, replacement] of pairs) {
      if (pattern.test(value)) {
        value = value.replace(pattern, replacement).trim();
        break;
      }
    }

    return value;
  }

  function normalizeSpacedLatexCommands(latex) {
    return String(latex || "").replace(/(?<!\\)\\[\s\u00a0]+([A-Za-z]+)/g, "\\$1");
  }

  function formatLatexForMarkdown(latex, isDisplay) {
    const body = stripMathDelimiters(latex);
    if (!body) return "";

    if (isDisplay) {
      return `\\[\n${body}\n\\]`;
    }

    return `\\( ${body} \\)`;
  }

  function formatForWordLatex(latex) {
    return normalizeForWordLatex(stripMathDelimiters(latex));
  }

  function isReliableFormulaLatex(formula) {
    if (!formula?.latex) return false;
    if (typeof formula.isReliableLatex === "boolean") return formula.isReliableLatex;
    if (["annotation", "parent-annotation", "data-math", "selection-latex"].includes(formula.source)) return true;
    if (formula.source === "aria-label") return /\\[A-Za-z]+|[\^_{}]/.test(formula.latex);
    return false;
  }

  function unicodeCommand(command) {
    const map = {
      alpha: "α",
      beta: "β",
      gamma: "γ",
      Gamma: "Γ",
      delta: "δ",
      Delta: "Δ",
      epsilon: "ε",
      theta: "θ",
      lambda: "λ",
      mu: "μ",
      pi: "π",
      rho: "ρ",
      sigma: "σ",
      Sigma: "Σ",
      omega: "ω",
      Omega: "Ω",
      phi: "φ",
      varphi: "φ",
      partial: "∂",
      nabla: "∇",
      in: "∈",
      pm: "±",
      times: "×",
      cdot: "⋅",
      leq: "≤",
      geq: "≥",
      neq: "≠",
      approx: "≈",
      ln: "ln",
      log: "log",
      sin: "sin",
      cos: "cos",
      tan: "tan",
      exp: "exp"
    };

    return Object.prototype.hasOwnProperty.call(map, command) ? map[command] : `\\${command}`;
  }

  function unicodeSuperscript(body) {
    const value = formatUnicodeMathPart(body).trim();
    if (!value) return "";
    if (/^[A-Za-z0-9]$/.test(value)) return `^${value}`;
    return `^(${value})`;
  }

  function normalizeHatForUnicodeMath(input) {
    return String(input || "")
      .replace(/\\(?:widehat|hat)\s*[\{\(]\s*y_([A-Za-z0-9]+)\s*[\}\)]/g, (_, sub) => `ŷ_${sub}`)
      .replace(/\\(?:widehat|hat)\s*[\{\(]\s*y\s*[\}\)]_\{?([A-Za-z0-9]+)\}?/g, (_, sub) => `ŷ_${sub}`)
      .replace(/\\(?:widehat|hat)\s+y_([A-Za-z0-9]+)/g, (_, sub) => `ŷ_${sub}`)
      .replace(/\\(?:widehat|hat)\s+y/g, "ŷ");
  }

  function normalizeOverbarForUnicodeMath(input) {
    function overbar(text) {
      return Array.from(String(text || "").trim()).map((char) => `${char}\u0305`).join("");
    }

    return String(input || "")
      .replace(/\\(?:bar|overline)\s*[\{\(]\s*([A-Za-z])\s*[\}\)]/g, (_, body) => overbar(body))
      .replace(/\\(?:bar|overline)\s+([A-Za-z])/g, (_, body) => overbar(body));
  }

  function normalizeLooseSqrtForUnicodeMath(input) {
    const value = String(input || "");
    let output = "";
    let index = 0;
    const needle = "\\sqrt";

    while (index < value.length) {
      const found = value.indexOf(needle, index);
      if (found === -1) {
        output += value.slice(index);
        break;
      }

      output += value.slice(index, found);
      let cursor = found + needle.length;
      while (cursor < value.length && /\s/.test(value[cursor])) cursor += 1;

      if (value[cursor] === "{") {
        output += needle;
        index = cursor;
        continue;
      }

      let depth = 0;
      const start = cursor;
      while (cursor < value.length) {
        if (value.startsWith(needle, cursor) && depth === 0) break;

        const char = value[cursor];
        if (char === "(") {
          depth += 1;
        } else if (char === ")") {
          if (depth === 0) break;
          depth -= 1;
        } else if (char === "/" && depth === 0) {
          break;
        }

        cursor += 1;
      }

      const body = value.slice(start, cursor).trim();
      output += body ? `√(${groupAdjacentSumsForRadical(body)})` : "√";
      index = cursor;
    }

    return output;
  }

  function normalizeInverseTrigForUnicodeMath(input) {
    const map = {
      cos: "arccos",
      sin: "arcsin",
      tan: "arctan"
    };

    return String(input || "")
      .replace(/\\(cos|sin|tan)(?![A-Za-z])\s*\^\s*\{\s*-1\s*\}/g, (_, command) => map[command])
      .replace(/\\(cos|sin|tan)(?![A-Za-z])\s*\^\s*\(\s*-1\s*\)/g, (_, command) => map[command])
      .replace(/\\(cos|sin|tan)(?![A-Za-z])\s*\^\s*-1/g, (_, command) => map[command])
      .replace(/\b(cos|sin|tan)\s*\^\s*\{\s*-1\s*\}/g, (_, command) => map[command])
      .replace(/\b(cos|sin|tan)\s*\^\s*\(\s*-1\s*\)/g, (_, command) => map[command]);
  }

  function convertNormAndAbsForUnicodeMath(input) {
    return String(input || "")
      .replace(/\\left\s*\\\|/g, "‖")
      .replace(/\\right\s*\\\|/g, "‖")
      .replace(/\\left\s*\|/g, "|")
      .replace(/\\right\s*\|/g, "|")
      .replace(/\\\|/g, "‖")
      .replace(/\\left\s*/g, "")
      .replace(/\\right\s*/g, "");
  }

  function convertLatexSubscriptsForUnicodeMath(input) {
    let value = String(input || "");

    for (let pass = 0; pass < 4; pass += 1) {
      value = value.replace(/(^|[^\\A-Za-z])([A-Za-zΑ-ω])_\{([^{}]+)\}/g, (_, prefix, base, sub) => {
        const body = formatUnicodeMathPart(sub).replace(/\s+/g, "");
        return /^[A-Za-z0-9]$/.test(body) ? `${prefix}${base}_${body}` : `${prefix}${base}_(${body})`;
      });
    }

    return value
      .replace(/\^\{\*\}/g, "^*")
      .replace(/\^\{(-?\d+)\}/g, "^($1)")
      .replace(/\^\{([A-Za-z0-9])\}/g, "^$1");
  }

  function convertSumsForUnicodeMath(input) {
    function nary(operator, lower, upper) {
      const symbol = operator === "prod" ? "∏" : "∑";
      const lowerText = formatUnicodeMathPart(lower).replace(/\s+/g, "");
      const upperText = upper ? unicodeSuperscript(upper) : "";
      return `${symbol}_(${lowerText})${upperText} `;
    }

    return String(input || "")
      .replace(/\\(sum|prod)(?![A-Za-z])_\{([^{}]+)\}\^\{([^{}]+)\}/g, (_, operator, lower, upper) => nary(operator, lower, upper))
      .replace(/\\(sum|prod)(?![A-Za-z])_\{([^{}]+)\}\^([+-]?\d+|[A-Za-z0-9*])/g, (_, operator, lower, upper) => nary(operator, lower, upper))
      .replace(/\\(sum|prod)(?![A-Za-z])_\{([^{}]+)\}/g, (_, operator, lower) => nary(operator, lower))
      .replace(/\\(sum|prod)(?![A-Za-z])_\(([^()]*)\)\^\(([^()]*)\)/g, (_, operator, lower, upper) => nary(operator, lower, upper))
      .replace(/\\(sum|prod)(?![A-Za-z])_\(([^()]*)\)\^([+-]?\d+|[A-Za-z0-9*])/g, (_, operator, lower, upper) => nary(operator, lower, upper))
      .replace(/\\(sum|prod)(?![A-Za-z])_\(([^()]*)\)/g, (_, operator, lower) => nary(operator, lower))
      .replace(/\\(sum|prod)(?![A-Za-z])_([A-Za-z])=([^^\s\\{}()]+)\^([A-Za-z0-9])(?=[A-Za-z\\(])/g, (_, operator, variable, lower, upper) => nary(operator, `${variable}=${lower}`, upper))
      .replace(/\\(sum|prod)(?![A-Za-z])_([A-Za-z])=([^^\s\\{}()]+)\^([A-Za-z0-9]+)(?=\s|[)\/+\-*]|$)/g, (_, operator, variable, lower, upper) => nary(operator, `${variable}=${lower}`, upper));
  }

  function groupAdjacentSumsForRadical(input) {
    const value = String(input || "").trim();
    const parts = value.split(/(?=[∑∏]_\()/).filter(Boolean);

    if (parts.length >= 2 && parts.every((part) => /^[∑∏]_\(/.test(part.trim()))) {
      return parts.map((part) => `(${part.trim()})`).join("");
    }

    return value;
  }

  function convertSqrtForUnicodeMath(input) {
    let value = String(input || "");

    for (let pass = 0; pass < 4; pass += 1) {
      value = replaceOneBraceCommand(value, "sqrt", (body) => {
        const formatted = formatForWordUnicodeMath(body);
        return `√(${groupAdjacentSumsForRadical(formatted)})`;
      });
    }

    return normalizeLooseSqrtForUnicodeMath(value);
  }

  function convertFractionsForUnicodeMath(input) {
    let value = String(input || "");

    for (let pass = 0; pass < 4; pass += 1) {
      value = replaceTwoBraceCommand(value, "frac", (top, bottom) => {
        const numerator = formatForWordUnicodeMath(top);
        const denominator = formatForWordUnicodeMath(bottom);
        const simple = /^[A-Za-z0-9+\-.]+$/.test(numerator) && /^[A-Za-z0-9+\-.]+$/.test(denominator);
        return simple ? `${numerator}/${denominator}` : `(${numerator})/(${denominator})`;
      });
    }

    return value;
  }

  function convertGreekForUnicodeMath(input) {
    return String(input || "").replace(/\\(theta|gamma|mu|Sigma|omega)(?![A-Za-z])/g, (_, command) => unicodeCommand(command));
  }

  function formatUnicodeMathPart(text) {
    let value = String(text || "");

    value = value
      .replace(/\\left\s*\\\|/g, "‖")
      .replace(/\\right\s*\\\|/g, "‖")
      .replace(/\\\|/g, "‖")
      .replace(/\\left\s*/g, "")
      .replace(/\\right\s*/g, "");

    value = value.replace(/\\([A-Za-z]+)/g, (_, command) => unicodeCommand(command));

    return value
      .replace(/_\{([A-Za-z0-9])\}/g, "_$1")
      .replace(/\^\{([A-Za-z0-9])\}/g, "^$1")
      .replace(/\^\{(-?\d+)\}/g, "^($1)")
      .replace(/\^\((-?\d+)\)/g, "^($1)")
      .replace(/\{([^{}]+)\}/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatForWordUnicodeMath(latex) {
    let value = normalizeOverbarForUnicodeMath(normalizeHatForUnicodeMath(stripMathDelimiters(latex).replace(/▒/g, " ")));

    value = normalizeInverseTrigForUnicodeMath(value);
    value = convertNormAndAbsForUnicodeMath(value);
    value = convertFractionsForUnicodeMath(value);
    value = convertSqrtForUnicodeMath(value);
    value = convertSumsForUnicodeMath(value);
    value = convertLatexSubscriptsForUnicodeMath(value);
    value = convertGreekForUnicodeMath(value);

    value = formatUnicodeMathPart(value);

    return value
      .replace(/([∑∏])_\(([^)]*)\)\s+\^/g, "$1_($2)^")
      .replace(/([A-Za-zΑ-ω])_([A-Za-z0-9])(?=(ln|log|sin|cos|tan|exp)\b)/g, "$1_$2 ")
      .replace(/(\d+\/\d+)(?=[A-Za-z(])/g, "$1 ")
      .replace(/(^|[=+\-*/(])(\d+\/\d+)\s+(?=(?:ln|log|sin|cos|tan|exp)\b|\(|[A-Za-zΑ-ω])/g, "$1($2)")
      .replace(/\)\s+(?=√)/g, ")")
      .replace(/\)(?=√|[A-Za-zΑ-ω])/g, ") ")
      .replace(/\^\(-?\d+\)(?=\(|[A-Za-zΑ-ω])/g, "$& ")
      .replace(/\((\d+\/\d+)\)\s+(?=(?:ln|log|sin|cos|tan|exp)\b)/g, "($1)")
      .replace(/\^T(?=[A-Za-zΑ-ω])/g, "^T ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function runFormulaCopyDebugTests() {
    const kMeans = "J=\\sum_{i=1}^{K}\\sum_{x\\in C_i}\\left\\|x-\\mu_i\\right\\|^2";
    const discriminator = "g_i(x)=\\ln P(\\omega_i)-\\frac{1}{2}\\ln|\\Sigma_i|-\\frac{1}{2}(x-\\mu_i)^T\\Sigma_i^{-1}(x-\\mu_i)";
    const inverseCosine = "\\theta=\\cos^{-1}\\left(\\frac{\\sum_{i=1}^{n}t_i r_i}{\\sqrt{\\sum_{i=1}^{n}t_i^2\\sum_{i=1}^{n}r_i^2}}\\right)";
    const complexCorrelation = "\\gamma=\\frac{\\left|\\sum_{i=1}^{N}S_{1i}S_{2i}^{*}\\right|}{\\sqrt{\\sum_{i=1}^{N}|S_{1i}|^2\\sum_{i=1}^{N}|S_{2i}|^2}}";
    const correlation = "R=\\frac{\\sum_{i=1}^{n}(r_i-\\bar r)(t_i-\\bar t)}{\\sqrt{\\sum_{i=1}^{n}(r_i-\\bar r)^2}\\sqrt{\\sum_{i=1}^{n}(t_i-\\bar t)^2}}";
    const crossEntropy = "L=-\\sum_(i=1)^C y_ilog(\\hat y_i)";
    const kMeansOutput = formatForWordUnicodeMath(kMeans);
    const discriminatorOutput = formatForWordUnicodeMath(discriminator);
    const inverseCosineOutput = formatForWordUnicodeMath(inverseCosine);
    const complexCorrelationOutput = formatForWordUnicodeMath(complexCorrelation);
    const correlationOutput = formatForWordUnicodeMath(correlation);
    const crossEntropyOutput = formatForWordUnicodeMath(crossEntropy);

    const result = {
      kMeans,
      kMeansOutput,
      kMeansPassed: kMeansOutput.includes("∑_(i=1)^K")
        && kMeansOutput.includes("∑_(x∈C_i)")
        && kMeansOutput.includes("‖x-μ_i‖^2"),
      discriminator,
      discriminatorOutput,
      discriminatorPassed: discriminatorOutput.includes("ω_i")
        && discriminatorOutput.includes("Σ_i")
        && discriminatorOutput.includes("μ_i")
        && discriminatorOutput.includes("^(-1)")
        && discriminatorOutput.includes("-(1/2)ln|Σ_i|")
        && discriminatorOutput.includes("-(1/2)(x-μ_i)^T"),
      inverseCosine,
      inverseCosineOutput,
      inverseCosinePassed: inverseCosineOutput.includes("θ=arccos(")
        && inverseCosineOutput.includes("∑_(i=1)^n")
        && inverseCosineOutput.includes("√((∑_(i=1)^n t_i^2)(∑_(i=1)^n r_i^2))"),
      complexCorrelation,
      complexCorrelationOutput,
      complexCorrelationPassed: complexCorrelationOutput.includes("γ=")
        && complexCorrelationOutput.includes("S_(1i)")
        && complexCorrelationOutput.includes("S_(2i)^*")
        && complexCorrelationOutput.includes("√((∑_(i=1)^N |S_(1i)|^2)(∑_(i=1)^N |S_(2i)|^2))"),
      correlation,
      correlationOutput,
      correlationPassed: correlationOutput.includes("r̅")
        && correlationOutput.includes("t̅")
        && correlationOutput.includes("√(∑_(i=1)^n (r_i-r̅)^2)")
        && correlationOutput.includes("√(∑_(i=1)^n (t_i-t̅)^2)"),
      crossEntropy,
      crossEntropyOutput,
      crossEntropyPassed: crossEntropyOutput.includes("∑_(i=1)^C")
        && crossEntropyOutput.includes("y_i log(ŷ_i)")
    };

    console.log("[FormulaCopy] Word UnicodeMath format tests", result);
    return result;
  }

  function formatForWpsLatex(latex) {
    return normalizeNaryForWpsLatex(stripMathDelimiters(latex));
  }

  function formatForMarkdownLatex(latex, isDisplay) {
    return formatLatexForMarkdown(latex, isDisplay);
  }

  function formatLatexForWps(latex) {
    return formatForWpsLatex(latex);
  }

  function normalizeNaryForWpsLatex(latex) {
    function normalizeWpsLatexInput(input) {
      return normalizeSpacedLatexCommands(input)
        .replace(/\\(?:operatorname\*?|mathrm|text|mbox)\s*\{([^{}]+)\}/g, "$1")
        .replace(/\\(?:dfrac|tfrac)(?![A-Za-z])/g, "\\frac")
        .replace(/\\det(?![A-Za-z])/g, "det")
        .replace(/\\ne(?![A-Za-z])/g, "\\neq")
        .replace(/\\(?:qquad|quad)(?![A-Za-z])/g, " ")
        .replace(/\\mid(?![A-Za-z])/g, "|")
        .replace(/\\left\s*/g, "")
        .replace(/\\right\s*/g, "")
        .replace(/\s*\n+\s*/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
    }

    function groupedNary(operator, lower, upper) {
      const base = `\\${operator}_{${String(lower || "").trim()}}`;
      return upper ? `${base}^{${String(upper || "").trim()}}` : base;
    }

    function groupAdjacentNaryBodies(input) {
      let output = String(input || "").replace(
        /(\\(?:sum|prod)_\{[^{}]+\}(?:\^\{[^{}]+\})?)\s*(\\(?:sum|prod)_\{[^{}]+\}(?:\^\{[^{}]+\})?)([^=+;\n]*)/g,
        (_, outer, inner, body) => `${outer}{${inner}{${String(body || "").trim()}}}`
      );

      return output;
    }

    const normalized = normalizeWpsLatexInput(latex)
      .replace(/\\(sum|prod)(?![A-Za-z])_\{([^{}]+)\}\^\{([^{}]+)\}/g, (_, operator, lower, upper) => groupedNary(operator, lower, upper))
      .replace(/\\(sum|prod)(?![A-Za-z])_\{([^{}]+)\}\^([+-]?\d+|[A-Za-z0-9*])/g, (_, operator, lower, upper) => groupedNary(operator, lower, upper))
      .replace(/\\(sum|prod)(?![A-Za-z])_\{([^{}]+)\}/g, (_, operator, lower) => groupedNary(operator, lower))
      .replace(/\\(sum|prod)(?![A-Za-z])_\(([^()]*)\)\^\(([^()]*)\)/g, (_, operator, lower, upper) => groupedNary(operator, lower, upper))
      .replace(/\\(sum|prod)(?![A-Za-z])_\(([^()]*)\)\^([+-]?\d+|[A-Za-z0-9*])/g, (_, operator, lower, upper) => groupedNary(operator, lower, upper))
      .replace(/\\(sum|prod)(?![A-Za-z])_\(([^()]*)\)/g, (_, operator, lower) => groupedNary(operator, lower))
      .trim();

    return groupAdjacentNaryBodies(normalized);
  }

  function formatLatexForNotion(latex) {
    return `$$${stripMathDelimiters(latex)}$$`;
  }

  function replaceTwoBraceCommand(value, command, formatter) {
    let output = "";
    let index = 0;
    const needle = `\\${command}`;

    function readGroup(start) {
      if (value[start] !== "{") return null;
      let depth = 0;
      for (let cursor = start; cursor < value.length; cursor += 1) {
        if (value[cursor] === "{") depth += 1;
        if (value[cursor] === "}") depth -= 1;
        if (depth === 0) {
          return {
            content: value.slice(start + 1, cursor),
            end: cursor + 1
          };
        }
      }
      return null;
    }

    while (index < value.length) {
      const found = value.indexOf(needle, index);
      if (found === -1) {
        output += value.slice(index);
        break;
      }

      const first = readGroup(found + needle.length);
      const second = first ? readGroup(first.end) : null;
      if (!first || !second) {
        output += value.slice(index, found + needle.length);
        index = found + needle.length;
        continue;
      }

      output += value.slice(index, found);
      output += formatter(first.content, second.content);
      index = second.end;
    }

    return output;
  }

  function replaceOneBraceCommand(value, command, formatter) {
    let output = "";
    let index = 0;
    const needle = `\\${command}`;

    function readGroup(start) {
      if (value[start] !== "{") return null;
      let depth = 0;
      for (let cursor = start; cursor < value.length; cursor += 1) {
        if (value[cursor] === "{") depth += 1;
        if (value[cursor] === "}") depth -= 1;
        if (depth === 0) {
          return {
            content: value.slice(start + 1, cursor),
            end: cursor + 1
          };
        }
      }
      return null;
    }

    while (index < value.length) {
      const found = value.indexOf(needle, index);
      if (found === -1) {
        output += value.slice(index);
        break;
      }

      const group = readGroup(found + needle.length);
      if (!group) {
        output += value.slice(index, found + needle.length);
        index = found + needle.length;
        continue;
      }

      output += value.slice(index, found);
      output += formatter(group.content);
      index = group.end;
    }

    return output;
  }

  function normalizeForWordLatex(latex) {
    let value = String(latex || "").replace(/▒/g, " ").trim();

    function script(body, marker) {
      const value = String(body || "").trim();
      if (!value) return `${marker}{}`;
      if (/^[A-Za-z0-9*]$/.test(value)) return `${marker}${value}`;
      return `${marker}{${value}}`;
    }

    function normalizeAccentCommands(input) {
      return input
        .replace(/\\(widehat|hat)\s*[\{\(]\s*([A-Za-z])_([A-Za-z0-9]+)\s*[\}\)]/g, (_, command, base, sub) => `\\${command}{${base}}${script(sub, "_")}`)
        .replace(/\\(widehat|hat)\s*[\{\(]\s*([A-Za-z])\s*[\}\)]_\{?([A-Za-z0-9]+)\}?/g, (_, command, base, sub) => `\\${command}{${base}}${script(sub, "_")}`)
        .replace(/\\(widehat|hat)\s*\(\s*([A-Za-z])\s*\)/g, "\\$1{$2}")
        .replace(/\\(widehat|hat)\s+([A-Za-z])/g, "\\$1{$2}");
    }

    function naryUpper(body) {
      const value = String(body || "").trim();
      if (!value) return "";
      return /^[A-Za-z0-9]$/.test(value) ? `^${value}` : `^(${value})`;
    }

    function naryTerm(operator, lower, upper) {
      const symbol = operator === "prod" ? "∏" : "∑";
      const base = `${symbol}_(${String(lower || "").trim()})${naryUpper(upper)}`;
      return `${base} `;
    }

    function normalizeNaryForWord(input) {
      return String(input || "")
        .replace(/\\sum_\(([^()]*)\)\^\(([^()]*)\)/g, (_, lower, upper) => naryTerm("sum", lower, upper))
        .replace(/\\sum_\(([^()]*)\)\^([+-]?\d+|[A-Za-z0-9*])/g, (_, lower, upper) => naryTerm("sum", lower, upper))
        .replace(/\\sum_\(([^()]*)\)/g, (_, lower) => naryTerm("sum", lower))
        .replace(/\\sum_\{([^{}]+)\}\^\{([^{}]+)\}/g, (_, lower, upper) => naryTerm("sum", lower, upper))
        .replace(/\\sum_\{([^{}]+)\}\^([+-]?\d+|[A-Za-z0-9*])/g, (_, lower, upper) => naryTerm("sum", lower, upper))
        .replace(/\\sum_\{([^{}]+)\}/g, (_, lower) => naryTerm("sum", lower))
        .replace(/∑_\(([^()]*)\)\^\(([^()]*)\)/g, (_, lower, upper) => naryTerm("sum", lower, upper))
        .replace(/∑_\(([^()]*)\)\^([+-]?\d+|[A-Za-z0-9*])/g, (_, lower, upper) => naryTerm("sum", lower, upper))
        .replace(/∑_\(([^()]*)\)/g, (_, lower) => naryTerm("sum", lower))
        .replace(/∑_\{([^{}]+)\}\^\{([^{}]+)\}/g, (_, lower, upper) => naryTerm("sum", lower, upper))
        .replace(/∑_\{([^{}]+)\}\^([+-]?\d+|[A-Za-z0-9*])/g, (_, lower, upper) => naryTerm("sum", lower, upper))
        .replace(/∑_\{([^{}]+)\}/g, (_, lower) => naryTerm("sum", lower))
        .replace(/\\prod_\(([^()]*)\)\^\(([^()]*)\)/g, (_, lower, upper) => naryTerm("prod", lower, upper))
        .replace(/\\prod_\(([^()]*)\)\^([+-]?\d+|[A-Za-z0-9*])/g, (_, lower, upper) => naryTerm("prod", lower, upper))
        .replace(/\\prod_\(([^()]*)\)/g, (_, lower) => naryTerm("prod", lower))
        .replace(/\\prod_\{([^{}]+)\}\^\{([^{}]+)\}/g, (_, lower, upper) => naryTerm("prod", lower, upper))
        .replace(/\\prod_\{([^{}]+)\}\^([+-]?\d+|[A-Za-z0-9*])/g, (_, lower, upper) => naryTerm("prod", lower, upper))
        .replace(/\\prod_\{([^{}]+)\}/g, (_, lower) => naryTerm("prod", lower))
        .replace(/∏_\(([^()]*)\)\^\(([^()]*)\)/g, (_, lower, upper) => naryTerm("prod", lower, upper))
        .replace(/∏_\(([^()]*)\)\^([+-]?\d+|[A-Za-z0-9*])/g, (_, lower, upper) => naryTerm("prod", lower, upper))
        .replace(/∏_\(([^()]*)\)/g, (_, lower) => naryTerm("prod", lower))
        .replace(/∏_\{([^{}]+)\}\^\{([^{}]+)\}/g, (_, lower, upper) => naryTerm("prod", lower, upper))
        .replace(/∏_\{([^{}]+)\}\^([+-]?\d+|[A-Za-z0-9*])/g, (_, lower, upper) => naryTerm("prod", lower, upper))
        .replace(/∏_\{([^{}]+)\}/g, (_, lower) => naryTerm("prod", lower));
    }

    function isComplexFractionPart(text) {
      return /\\(?:sum|prod|sqrt|frac|left|right)\b|[|‖]/.test(String(text || ""));
    }

    function normalizeComplexWordStructures(input) {
      let output = String(input || "");

      for (let pass = 0; pass < 4; pass += 1) {
        output = replaceTwoBraceCommand(output, "frac", (top, bottom) => {
          const numerator = top.trim();
          const denominator = bottom.trim();

          if (!isComplexFractionPart(numerator) && !isComplexFractionPart(denominator)) {
            return `\\frac{${numerator}}{${denominator}}`;
          }

          return `(${normalizeNaryForWord(numerator)})/(${normalizeNaryForWord(denominator)})`;
        });

        output = replaceOneBraceCommand(output, "sqrt", (body) => (
          `√(${normalizeNaryForWord(body.trim())})`
        ));
      }

      return output;
    }

    value = normalizeComplexWordStructures(normalizeAccentCommands(value))
      .replace(/_\(([^()]*)\)/g, (_, body) => script(body, "_"))
      .replace(/\^\(([^()]*)\)/g, (_, body) => script(body, "^"))
      .replace(/_\{([^{}]+)\}/g, (_, body) => script(body, "_"))
      .replace(/\^\{([^{}]+)\}/g, (_, body) => script(body, "^"))
      .replace(/\\\|/g, "‖")
      .replace(/\\gamma(?![A-Za-z])/g, "γ")
      .replace(/\\in(?![A-Za-z])/g, "∈")
      .replace(/\\sum(?![A-Za-z])/g, "∑")
      .replace(/\\prod(?![A-Za-z])/g, "∏")
      .replace(/([A-Za-z0-9])(?=(\\(?:ln|log|sin|cos|tan|exp)\b))/g, "$1 ")
      .replace(/(?<!\\)\b(ln|log|sin|cos|tan|exp)(?=\s*\()/g, "\\$1")
      .replace(/\\left\s*/g, "")
      .replace(/\\right\s*/g, "")
      .trim();

    return normalizeNaryForWord(value)
      .replace(/\\(sum|prod)_\(([^)]*)\)\s+\^/g, "\\$1_($2)^")
      .replace(/([∑∏])_\(([^)]*)\)\s+\^/g, "$1_($2)^")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function stripMathMLAnnotations(mathml) {
    const doc = new DOMParser().parseFromString(mathml, "application/xml");
    if (doc.querySelector("parsererror")) return mathml;

    doc.querySelectorAll("annotation, annotation-xml").forEach((node) => node.remove());
    doc.querySelectorAll("semantics").forEach((semantics) => {
      const presentation = Array.from(semantics.children).find((child) => (
        child.localName !== "annotation" && child.localName !== "annotation-xml"
      ));
      if (presentation) {
        semantics.replaceWith(presentation);
      }
    });

    return new XMLSerializer().serializeToString(doc.documentElement);
  }

  function ensureMathMLNamespace(mathml) {
    const doc = new DOMParser().parseFromString(mathml, "application/xml");
    const math = doc.documentElement;
    if (!math || math.localName !== "math" || doc.querySelector("parsererror")) return mathml;

    if (!math.getAttribute("xmlns")) {
      math.setAttribute("xmlns", MATHML_NS);
    }

    return new XMLSerializer().serializeToString(math);
  }

  function stripMathMLPresentationAttributes(mathml) {
    const doc = new DOMParser().parseFromString(mathml, "application/xml");
    if (doc.querySelector("parsererror")) return mathml;

    doc.querySelectorAll("*").forEach((node) => {
      node.removeAttribute("class");
      node.removeAttribute("style");
      node.removeAttribute("id");
    });

    return new XMLSerializer().serializeToString(doc.documentElement);
  }

  function isBlankMathMLNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return !String(node.textContent || "").trim();
  }

  function isNaryOperatorNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const text = String(node.textContent || "").trim();
    return text === "∑" || text === "\u2211" || text === "∏" || text === "\u220F";
  }

  function cleanupWordMathMLPlaceholders(mathml) {
    const doc = new DOMParser().parseFromString(mathml, "application/xml");
    if (doc.querySelector("parsererror")) return mathml;

    doc.querySelectorAll("munderover, munder, msubsup, msub").forEach((node) => {
      const children = Array.from(node.children || []);
      if (children.length < 2 || !isNaryOperatorNode(children[0])) return;

      children.slice(1).forEach((child) => {
        if (isBlankMathMLNode(child)) {
          child.remove();
        }
      });
    });

    doc.querySelectorAll("mrow").forEach((node) => {
      if (isBlankMathMLNode(node) && node.parentElement?.children.length > 1) {
        node.remove();
      }
    });

    return new XMLSerializer().serializeToString(doc.documentElement);
  }

  function neutralizeWordNaryMathML(mathml) {
    const doc = new DOMParser().parseFromString(mathml, "application/xml");
    if (doc.querySelector("parsererror")) return mathml;

    doc.querySelectorAll("munderover, munder, msubsup, msub").forEach((node) => {
      const children = Array.from(node.children || []);
      if (children.length < 2 || !isNaryOperatorNode(children[0])) return;

      const replacement = doc.createElementNS(MATHML_NS, children.length > 2 ? "msubsup" : "msub");
      const base = doc.createElementNS(MATHML_NS, "mtext");
      base.textContent = String(children[0].textContent || "").trim();
      replacement.append(base);
      children.slice(1).forEach((child) => replacement.append(child.cloneNode(true)));
      node.replaceWith(replacement);
    });

    return new XMLSerializer().serializeToString(doc.documentElement);
  }

  function cloneAsWordMathML(node, doc) {
    const next = doc.createElementNS(MATHML_NS, `mml:${node.localName}`);

    Array.from(node.attributes || []).forEach((attr) => {
      if (["class", "style", "id"].includes(attr.name)) return;
      if (attr.name === "xmlns" || attr.name.startsWith("xmlns:")) return;
      next.setAttribute(attr.name, attr.value);
    });

    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        next.append(doc.createTextNode(child.nodeValue || ""));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        next.append(cloneAsWordMathML(child, doc));
      }
    });

    return next;
  }

  function toWordMathML(mathml) {
    const cleaned = ensureMathMLNamespace(stripMathMLAnnotations(mathml));
    const parsed = new DOMParser().parseFromString(cleaned, "application/xml");
    if (parsed.querySelector("parsererror") || parsed.documentElement.localName !== "math") {
      throw new Error("Invalid MathML");
    }

    const doc = document.implementation.createDocument(MATHML_NS, "mml:math");
    const wordMath = cloneAsWordMathML(parsed.documentElement, doc);
    wordMath.setAttribute("xmlns:mml", MATHML_NS);
    doc.replaceChild(wordMath, doc.documentElement);

    return new XMLSerializer().serializeToString(doc.documentElement);
  }

  function wrapMathMLForWordHtml(wordMathML) {
    return [
      '<html xmlns:mml="http://www.w3.org/1998/Math/MathML">',
      "<head><meta charset=\"utf-8\"></head>",
      "<body><!--StartFragment-->",
      wordMathML,
      "<!--EndFragment--></body>",
      "</html>"
    ].join("");
  }

  function shouldPreferWordMathML(formula) {
    const latex = stripMathDelimiters(formula?.latex || "");
    if (!latex || !formula?.mathml) return false;

    const sumCount = (latex.match(/\\sum(?![A-Za-z])/g) || []).length;
    const prodCount = (latex.match(/\\prod(?![A-Za-z])/g) || []).length;
    const hasNary = sumCount + prodCount > 0;
    const hasNestedRadicalOrFraction = /\\(?:frac|sqrt)(?![A-Za-z])/.test(latex);

    return (hasNestedRadicalOrFraction && hasNary)
      || sumCount >= 2
      || /\\begin\{(?:matrix|bmatrix|pmatrix|cases|aligned)\}/.test(latex);
  }

  function convertLatexToWordMathML(latex, isDisplay) {
    const temml = window.temml;
    if (!temml?.renderToString) return "";

    const mathml = temml.renderToString(stripMathDelimiters(latex), {
      displayMode: isDisplay,
      xml: true,
      annotate: false,
      throwOnError: true,
      colorIsTextColor: true,
      trust: false
    });

    return toWordMathML(mathml);
  }

  function execCommandCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.documentElement.append(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  }

  async function copyToClipboard(text, html, mathml) {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined" && html) {
      const richPayload = {
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" })
      };

      if (mathml) {
        richPayload["application/mathml+xml"] = new Blob([mathml], { type: "application/mathml+xml" });
      }

      try {
        await navigator.clipboard.write([new ClipboardItem(richPayload)]);
        return true;
      } catch (error) {
        if (!mathml) throw error;

        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": richPayload["text/plain"],
            "text/html": richPayload["text/html"]
          })
        ]);
        return true;
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    return execCommandCopy(text);
  }

  async function copyAsMarkdownLatex(formula) {
    return copyToClipboard(formatForMarkdownLatex(formula.latex, formula.isDisplay));
  }

  async function copyAsRawLatex(formula) {
    return copyToClipboard(stripMathDelimiters(formula.latex));
  }

  async function copyAsWordUnicodeMath(formula) {
    const unicodeMath = formatForWordUnicodeMath(formula.latex);
    const payload = {
      rawLatex: formula?.latex || "",
      source: formula?.source || "text-fallback",
      isReliableLatex: isReliableFormulaLatex(formula),
      unicodeMath,
      containsSum: unicodeMath.includes("∑_") || unicodeMath.includes("\\sum_"),
      containsIn: unicodeMath.includes("∈"),
      containsNorm: unicodeMath.includes("‖"),
      containsMu: unicodeMath.includes("μ"),
      containsInverseTrig: unicodeMath.includes("arccos") || unicodeMath.includes("arcsin") || unicodeMath.includes("arctan"),
      containsGroupedSqrt: unicodeMath.includes("√(("),
      containsGroupedSubscript: unicodeMath.includes("S_(1i)") || unicodeMath.includes("S_(2i)"),
      containsGamma: unicodeMath.includes("γ"),
      containsTheta: unicodeMath.includes("θ")
    };
    console.log("[FormulaCopy] Word UnicodeMath copied", payload);

    if (!isReliableFormulaLatex(formula)) {
      return "word-unicodemath-unreliable";
    }

    if (!navigator.clipboard?.writeText) {
      throw new Error("word-unicodemath-copy-failed");
    }

    await navigator.clipboard.writeText(unicodeMath);
    return "word-unicodemath";
  }

  async function copyAsWordLatex(formula) {
    if (shouldPreferWordMathML(formula)) {
      const result = await copyAsWordMathML(formula);
      if (result === "word-mathml") {
        console.log("[FormulaCopy] Word MathML copied for complex formula");
        return "word-mathml-auto";
      }
    }

    const text = formatForWordLatex(formula.latex);
    console.log("[FormulaCopy] Word LaTeX copied:", text);
    await copyToClipboard(text);
    return "word-latex";
  }

  async function copyAsWpsLatex(formula) {
    return copyToClipboard(formatForWpsLatex(formula.latex));
  }

  async function copyAsNotion(formula) {
    return copyToClipboard(formatLatexForNotion(formula.latex));
  }

  async function copyAsWordMathML(formula) {
    const rawLatex = stripMathDelimiters(formula.latex);
    const unicodeMath = formatForWordUnicodeMath(rawLatex);

    if (!isReliableFormulaLatex(formula)) {
      console.log("[FormulaCopy] Word MathML debug", {
        rawLatex,
        source: formula?.source || "text-fallback",
        isReliableLatex: false,
        mathmlLength: 0,
        htmlLength: 0,
        htmlPreview: "",
        hasRealMathTag: false,
        hasEscapedMathTag: false
      });
      return "word-mathml-unreliable";
    }

    let sourceMathML = "";
    try {
      sourceMathML = convertLatexToWordMathML(rawLatex, formula.isDisplay);
    } catch (error) {
      console.warn("[FormulaCopy] temml MathML conversion failed", error);
    }

    if (!sourceMathML) {
      sourceMathML = formula.mathml || "";
    }

    if (!sourceMathML) {
      await copyAsWordUnicodeMath(formula);
      return "word-mathml-fallback";
    }

    const wordMathML = stripMathMLPresentationAttributes(ensureMathMLNamespace(stripMathMLAnnotations(sourceMathML)));
    const html = wrapMathMLForWordHtml(wordMathML);

    console.log("[FormulaCopy] Word MathML debug", {
      rawLatex,
      source: formula?.source || "text-fallback",
      isReliableLatex: true,
      mathmlLength: wordMathML.length,
      htmlLength: html.length,
      htmlPreview: html.slice(0, 300),
      hasRealMathTag: html.includes("<math") || html.includes("<mml:math"),
      hasEscapedMathTag: html.includes("&lt;math") || html.includes("&lt;mml:math")
    });

    try {
      await copyToClipboard(unicodeMath, html);
      return "word-mathml";
    } catch (error) {
      console.warn("[FormulaCopy] Word MathML write failed, falling back to Word UnicodeMath", error);
      await copyAsWordUnicodeMath(formula);
      return "word-mathml-fallback";
    }
  }

  window.CQRFormulaClipboard = {
    copyAsLatex: copyAsMarkdownLatex,
    copyAsMarkdownLatex,
    copyAsRawLatex,
    copyAsWordUnicodeMath,
    copyAsWordLatex,
    copyAsWordMathML,
    copyAsWpsLatex,
    copyAsNotion,
    copyFormulaForWord: copyAsWordMathML,
    copyLatex: copyAsMarkdownLatex,
    copyToClipboard,
    escapeHtml,
    stripMathDelimiters,
    formatForWordUnicodeMath,
    formatForWordLatex,
    formatForWpsLatex,
    formatForMarkdownLatex,
    normalizeForWordLatex,
    normalizeNaryForWpsLatex,
    normalizeSpacedLatexCommands,
    formatLatexForMarkdown,
    formatLatexForWps,
    formatLatexForNotion,
    isReliableFormulaLatex,
    normalizeOverbarForUnicodeMath,
    normalizeInverseTrigForUnicodeMath,
    convertLatexSubscriptsForUnicodeMath,
    convertSumsForUnicodeMath,
    convertFractionsForUnicodeMath,
    convertSqrtForUnicodeMath,
    convertNormAndAbsForUnicodeMath,
    convertGreekForUnicodeMath,
    runFormulaCopyDebugTests,
    shouldPreferWordMathML,
    convertLatexToWordMathML,
    cleanupWordMathMLPlaceholders,
    neutralizeWordNaryMathML,
    stripMathMLAnnotations,
    ensureMathMLNamespace,
    stripMathMLPresentationAttributes,
    toWordMathML,
    wrapMathMLForWordHtml
  };
})();
