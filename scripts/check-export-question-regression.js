const fs = require("fs");

const CONTENT_FILE = "src/content/content.js";
const FIXTURE_FILE = "tests/navigation-core-fixture.js";
const source = fs.readFileSync(CONTENT_FILE, "utf8");
const fixture = fs.readFileSync(FIXTURE_FILE, "utf8");

function fail(message) {
  console.error("Export question regression check failed.");
  console.error("");
  console.error(message);
  process.exit(1);
}

if (!source.includes('let exportMode = "questions";')) {
  fail("Export must default to question mode so the menu starts from the full question index, not loaded messages.");
}

if (!source.includes("function getExportQuestions()") || !source.includes("return getDirectoryQuestions();")) {
  fail("Question export must reuse getDirectoryQuestions() so it can export cached and deeply captured questions.");
}

if (!source.includes("function getQuestionExportKey(question)")) {
  fail("Question export selection must use a stable question key instead of list position only.");
}

if (!source.includes("function buildQuestionMarkdownExport")) {
  fail("Question export must have its own Markdown builder independent from loaded message DOM nodes.");
}

const markdownExportBlock = source.match(/function buildMarkdownExport\(\) \{[\s\S]*?\n  \}/);
if (!markdownExportBlock || !markdownExportBlock[0].includes('exportMode === "questions"')) {
  fail("buildMarkdownExport() must branch by export mode so question export does not call getSelectedMessages().");
}

const renderExportBlock = source.match(/function renderExportPanel\(\) \{[\s\S]*?\n  \}/);
if (!renderExportBlock) {
  fail("Could not find renderExportPanel().");
}

if (!renderExportBlock[0].includes("const exportQuestions = getExportQuestions();")) {
  fail("renderExportPanel() must render question choices from getExportQuestions().");
}

if (!renderExportBlock[0].includes('["questions", "问题"]') || !renderExportBlock[0].includes('["messages", "对话"]')) {
  fail("The export panel must keep separate question and conversation modes.");
}

if (!source.includes("pdfButton.disabled = exportMode === \"questions\"")
  || !source.includes("imageButton.disabled = exportMode === \"questions\"")) {
  fail("Question mode must disable PDF and PNG exports because unloaded historical assistant DOM cannot be cloned.");
}

[
  "question export uses every recorded directory question",
  "question export includes every deeply captured question",
  "cached question export keeps every recorded question"
].forEach((scenario) => {
  if (!fixture.includes(scenario)) {
    fail(`Missing navigation fixture coverage: ${scenario}`);
  }
});

console.log("[export-question-regression] ok");
