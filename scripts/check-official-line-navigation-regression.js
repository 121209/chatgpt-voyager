const fs = require("fs");

const contentSource = fs.readFileSync("src/content/content.js", "utf8");
const cssSource = fs.readFileSync("src/content/content.css", "utf8");

function fail(message) {
  console.error("Official navigation integration regression check failed.");
  console.error("");
  console.error(message);
  process.exit(1);
}

if (contentSource.includes("cqr-question-line")) {
  fail("The plugin must not render its own right-side question line markers because ChatGPT already provides them.");
}

if (/document\.createElement\("button"\)[\s\S]*?railContent\.append\(dot\)/.test(contentSource)) {
  fail("renderQuestionUi must not append plugin-owned rail marker buttons.");
}

if (contentSource.includes('railTrack.className = "cqr-rail-track"')) {
  fail("ensureRail/renderQuestionUi must not create a scrollable plugin rail track.");
}

if (!contentSource.includes('directoryButtonTrigger.className = "cqr-menu-trigger";')) {
  fail("The middle hot zone that opens the plugin menu must remain available.");
}

if (!contentSource.includes('directoryButton.className = "cqr-menu-button";')) {
  fail("The plugin menu button must remain available.");
}

if (!contentSource.includes("renderDirectory();")) {
  fail("The plugin directory/menu rendering path must remain available.");
}

if (!contentSource.includes("window.initFormulaCopy?.();")) {
  fail("Formula copy initialization must not be removed while removing the duplicate right rail.");
}

if (/\.cqr-dot\b|\.cqr-question-line\b|\.cqr-rail-track\b/.test(cssSource)) {
  fail("content.css must not keep plugin-owned question marker or rail-track styling.");
}

if (!/\.cqr-rail\s*\{[\s\S]*?display:\s*none;[\s\S]*?\}/.test(cssSource)) {
  fail("The legacy plugin rail container must remain hidden if present.");
}

console.log("[official-navigation-integration-regression] ok");
