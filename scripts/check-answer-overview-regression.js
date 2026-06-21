const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contentJs = fs.readFileSync(path.join(root, "src/content/content.js"), "utf8");
const contentCss = fs.readFileSync(path.join(root, "src/content/content.css"), "utf8");

function assertContains(source, pattern, message) {
  const matched = pattern instanceof RegExp
    ? pattern.test(source)
    : source.includes(pattern);

  if (!matched) {
    console.error(`[answer-overview-regression] ${message}`);
    process.exitCode = 1;
  }
}

function assertNotContains(source, pattern, message) {
  const matched = pattern instanceof RegExp
    ? pattern.test(source)
    : source.includes(pattern);

  if (matched) {
    console.error(`[answer-overview-regression] ${message}`);
    process.exitCode = 1;
  }
}

assertContains(
  contentJs,
  "function getQuestionAnswerPairs()",
  "The directory must pair user questions with following assistant replies."
);

assertContains(
  contentJs,
  "function buildAssistantReplyOverview(",
  "The directory must build a one-sentence overview from the full assistant reply."
);

assertContains(
  contentJs,
  /answer\.textContent\s*=\s*`一句话概览：/,
  "Directory question rows must render an inline one-sentence overview."
);

assertContains(
  contentJs,
  "function scoreOverviewSentence(",
  "The overview must score sentences across the full reply instead of taking only the opening."
);

assertContains(
  contentJs,
  /回答先说明.*并最终指出/,
  "The overview must combine earlier context with the later conclusion."
);

assertContains(
  contentJs,
  /tabs\.append\(directoryTab,\s*exportTab\)/,
  "The floating panel must keep the focused directory and export tab layout."
);

assertNotContains(
  contentJs,
  /summaryTab|buildAssistantSummaryPrompt|fillAssistantSummaryPrompt|复制总结提示词|填入 ChatGPT 输入框/,
  "The removed prompt-based summary workflow must not return."
);

assertNotContains(
  contentCss,
  ".cqr-summary-panel",
  "Removed summary panel styles must not return."
);

assertContains(
  contentCss,
  ".cqr-directory-answer-overview",
  "Directory inline answer overview styles must be present."
);

if (!process.exitCode) {
  console.log("[answer-overview-regression] ok");
}
