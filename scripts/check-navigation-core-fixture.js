const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const fixtureHtml = fs.readFileSync(path.join(root, "tests/navigation-core-fixture.html"), "utf8");
const fixtureJs = fs.readFileSync(path.join(root, "tests/navigation-core-fixture.js"), "utf8");

function assertContains(source, pattern, message) {
  const matched = pattern instanceof RegExp ? pattern.test(source) : source.includes(pattern);
  if (!matched) {
    console.error(`[navigation-core-fixture] ${message}`);
    process.exitCode = 1;
  }
}

assertContains(
  fixtureHtml,
  "../src/content/content.js",
  "The browser fixture must load the real content script."
);

[
  "ordinary conversation and repeated text preserve every directory question",
  "question export uses every recorded directory question",
  "question export PDF and image buttons stay enabled in question mode",
  "question export imports readable official navigation entries",
  "plugin menu stays available without duplicate line markers",
  "directory click brings final question into view",
  "DOM replacement does not create a duplicate index",
  "new user question is captured in real time",
  "plugin does not render its own scrollable rail on long conversations",
  "idle menu-only navigation does not recreate duplicate markers",
  "entering from the middle indexes the loaded window",
  "scrolling upward merges earlier virtualized questions",
  "deep capture collects the complete virtualized conversation",
  "question export includes every deeply captured question",
  "cache restore keeps all recorded directory entries",
  "cached question export keeps every recorded question",
  "clicking cached first item loads and reveals its question",
  "mixed role structures preserve repeated directory questions",
  "conversation export collects user and assistant bodies without UI text",
  "assistant streaming refreshes the open export panel",
  "role hydration attributes trigger message collection",
  "legacy explicit user text mentioning ChatGPT remains a question",
  "Markdown export contains selected user and assistant content",
  "PDF preview receives complete collected question and answer bodies",
  "role-free directory question is paired with its markdown answer",
  "role-free messages are included in conversation export",
  "repeated questions receive their own turn-specific answer",
  "same-turn user and assistant bodies remain independently collected",
  "attachment wrapper does not prevent directory answer matching",
  "multipart answer bodies are joined without collecting reasoning",
  "nonnumeric turn identities pair repeated questions by source node",
  "modern semantic message units expose the real question and replies",
  "semantic message IDs keep repeated questions stable across DOM replacement"
].forEach((scenario) => {
  assertContains(fixtureJs, scenario, `Missing navigation scenario: ${scenario}`);
});

assertContains(
  fixtureJs,
  "document.documentElement.dataset.fixtureStatus",
  "The fixture must expose an automation-readable final status."
);

if (!process.exitCode) {
  console.log("[navigation-core-fixture] ok");
}
