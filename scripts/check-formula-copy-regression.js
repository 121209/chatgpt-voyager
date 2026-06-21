const fs = require("fs");
const vm = require("vm");

const clipboardSource = fs.readFileSync("src/content/formulaCopy/clipboard.js", "utf8");
const extractSource = fs.readFileSync("src/content/formulaCopy/extractFormulaData.js", "utf8");
const managerSource = fs.readFileSync("src/content/formulaCopy/FormulaCopyManager.js", "utf8");
const contentSource = fs.readFileSync("src/content/content.js", "utf8");

function fail(message) {
  console.error("Formula copy regression check failed.");
  console.error("");
  console.error(message);
  process.exit(1);
}

const sandbox = {
  window: {},
  console
};

vm.runInNewContext(clipboardSource, sandbox, { filename: "src/content/formulaCopy/clipboard.js" });
vm.runInNewContext(extractSource, sandbox, { filename: "src/content/formulaCopy/extractFormulaData.js" });

const api = sandbox.window.CQRFormulaClipboard;
if (!api?.formatForWpsLatex) {
  fail("CQRFormulaClipboard.formatForWpsLatex must remain available.");
}

const brokenWpsInput = String.raw`P(A_i \ mid B)
=
\ frac{
P(B \ mid A_i)P(A_i)
}{
\ sum_{j = 1}^{n}P(B \ mid A_j)P(A_j)
}
\ operatorname{head}_i
=
\ operatorname{softmax}
\ left(
\ frac{QW_i^Q(KW_i^K)^T}{\ sqrt{d_k}}
\ right)VW_i^V`;

const wpsOutput = api.formatForWpsLatex(brokenWpsInput);
const inverseMatrixInput = String.raw`A^{-1}
=
\ frac{1}{\ det(A)}
\ operatorname{adj}(A),
\ qquad
\ det(A) \ ne 0`;
const inverseMatrixOutput = api.formatForWpsLatex(inverseMatrixInput);
const attentionInput = String.raw`\mathrm{head}_i
=
\mathrm{softmax}
(
\frac{QW_i^Q(KW_i^K)^T}{\sqrt{d_k}}
)VW_i^V`;
const attentionOutput = api.formatForWpsLatex(attentionInput);

[wpsOutput, inverseMatrixOutput, attentionOutput].forEach((output) => {
  if (/\\\s+[A-Za-z]+/.test(output)) {
    fail(`WPS LaTeX output must repair commands split as "\\ frac"; got: ${output}`);
  }

  if (/\n/.test(output)) {
    fail(`WPS LaTeX output must be a single line because WPS rejects some multiline inputs. Got: ${output}`);
  }
});

[
  "head_i",
  "softmax",
  "\\frac{QW_i^Q(KW_i^K)^T}{\\sqrt{d_k}}",
  ")VW_i^V"
].forEach((expected) => {
  if (!attentionOutput.includes(expected)) {
    fail(`WPS attention output is missing expected fragment "${expected}". Got: ${attentionOutput}`);
  }
});

if (/\\(?:mathrm|operatorname|text|mbox)\b/.test(attentionOutput)) {
  fail(`WPS attention output must avoid text-style commands that make WPS reject the whole formula. Got: ${attentionOutput}`);
}

[
  "\\frac{",
  "\\sum_{j = 1}^{n}",
  "\\sqrt{d_k}",
  "head_i",
  "softmax",
  "P(A_i | B)"
].forEach((expected) => {
  if (!wpsOutput.includes(expected)) {
    fail(`WPS LaTeX output is missing expected fragment "${expected}". Got: ${wpsOutput}`);
  }
});

[
  "\\operatorname",
  "\\left",
  "\\right",
  "\\mid",
  "\\quad",
  "\\qquad",
  "\\mathrm",
  "\\text",
  "\\mbox",
  "\\det",
  "\\ne "
].forEach((forbidden) => {
  if (wpsOutput.includes(forbidden) || inverseMatrixOutput.includes(forbidden) || attentionOutput.includes(forbidden)) {
    fail(`WPS LaTeX output should avoid WPS-fragile command "${forbidden}". Got: ${wpsOutput}\n${inverseMatrixOutput}\n${attentionOutput}`);
  }
});

[
  "\\frac{1}{det(A)}",
  "adj(A)",
  "det(A) \\neq 0"
].forEach((expected) => {
  if (!inverseMatrixOutput.includes(expected)) {
    fail(`WPS matrix inverse output is missing expected fragment "${expected}". Got: ${inverseMatrixOutput}`);
  }
});

const nestedNary = api.formatForWpsLatex(String.raw`J=\sum_{i=1}^{K}\sum_{x\in C_i}\left\|x-\mu_i\right\|^2`);
if (!nestedNary.includes(String.raw`\sum_{i=1}^{K}{\sum_{x\in C_i}{\|x-\mu_i\|^2}}`)) {
  fail(`WPS nested n-ary grouping must keep the existing sum compatibility behavior. Got: ${nestedNary}`);
}

if (!sandbox.window.CQRFormulaExtract?.isProbablyLatex?.(String.raw`\ frac{x}{y}`)) {
  fail("Formula extraction must recognize selected LaTeX commands even when browser selection inserts a space after the backslash.");
}

if (!managerSource.includes(String.raw`\\\s*[a-zA-Z]+`)) {
  fail("Formula selection toolbar detection must recognize commands split as backslash + spaces + letters.");
}

if (!contentSource.includes("window.CQRFormulaClipboard.formatForWpsLatex(formula?.latex)")) {
  fail("The formula-copy fallback toolbar must use the shared WPS LaTeX formatter instead of raw delimiter stripping.");
}

if (contentSource.includes('["WPS LaTeX", () => stripDelimiters(activeFormula?.latex)]')) {
  fail("The formula-copy fallback toolbar must not copy raw LaTeX for WPS.");
}

console.log("[formula-copy-regression] ok");
