const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.resolve(__dirname, "..");
const recordPath = path.join(rootDir, "docs", "STAGE0_ACCEPTANCE.json");
const clipboardPath = path.join(rootDir, "src", "content", "formulaCopy", "clipboard.js");
const manifestPath = path.join(rootDir, "manifest.json");
const packagePath = path.join(rootDir, "package.json");
const requireComplete = process.argv.includes("--require-complete");
const printFormulaPrompt = process.argv.includes("--print-formula-prompt");

function fail(message) {
  console.error("[stage0-acceptance] failed");
  console.error(message);
  process.exit(1);
}

function ensure(condition, message) {
  if (!condition) fail(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Cannot read valid JSON from ${path.relative(rootDir, filePath)}: ${error.message}`);
  }
}

function expectedIds(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`);
}

function assertExactIds(entries, expected, label) {
  ensure(Array.isArray(entries), `${label} must be an array.`);
  const ids = entries.map((entry) => entry?.id);
  ensure(new Set(ids).size === ids.length, `${label} contains duplicate ids.`);
  ensure(
    JSON.stringify(ids) === JSON.stringify(expected),
    `${label} ids must be exactly ${expected.join(", ")} in order; got ${ids.join(", ")}.`
  );
}

const record = readJson(recordPath);
const manifest = readJson(manifestPath);
const packageJson = readJson(packagePath);
const allowedStatuses = new Set(["PASS", "FAIL", "BLOCKED", "NOT RUN"]);

ensure(record.schemaVersion === 1, "schemaVersion must remain 1 until the checker is updated.");
ensure(record.candidate?.currentVersion === manifest.version, "candidate.currentVersion must match manifest.json.");
ensure(record.candidate?.currentVersion === packageJson.version, "candidate.currentVersion must match package.json.");
ensure(record.candidate?.targetVersion === "0.3.1", "candidate.targetVersion must be 0.3.1 for stage 0.");
ensure(record.candidate?.loadSource === "dist/", "Stage 0 acceptance must load the rebuilt dist/ directory.");
ensure(String(record.candidate?.chromeVersion || "").trim(), "candidate.chromeVersion is required.");

assertExactIds(record.chatgptCases, expectedIds("M", 12), "chatgptCases");
record.chatgptCases.forEach((entry) => {
  ensure(String(entry.title || "").trim(), `${entry.id} requires a title.`);
  ensure(allowedStatuses.has(entry.status), `${entry.id} has invalid status ${entry.status}.`);
  if (entry.status === "PASS" || entry.status === "FAIL") {
    ensure(String(entry.evidence || "").trim(), `${entry.id} ${entry.status} requires evidence.`);
  }
});

assertExactIds(record.formulaCases, expectedIds("F", 20), "formulaCases");
const requiredCategories = [
  "superscript",
  "subscript",
  "fraction",
  "radical",
  "summation",
  "matrix",
  "cases",
  "calculus",
  "greek",
  "norm",
  "text-function"
];
const categories = new Set(record.formulaCases.map((entry) => entry.category));
requiredCategories.forEach((category) => {
  ensure(categories.has(category), `Formula baseline is missing required category ${category}.`);
});

const sandbox = { window: {}, console };
vm.runInNewContext(fs.readFileSync(clipboardPath, "utf8"), sandbox, { filename: clipboardPath });
const clipboard = sandbox.window.CQRFormulaClipboard;
ensure(clipboard?.formatForWordUnicodeMath, "Word UnicodeMath formatter is unavailable.");
ensure(clipboard?.formatForWpsLatex, "WPS LaTeX formatter is unavailable.");

record.formulaCases.forEach((entry) => {
  ensure(String(entry.latex || "").trim(), `${entry.id} requires LaTeX input.`);
  ensure(allowedStatuses.has(entry.wordStatus), `${entry.id} has invalid Word status ${entry.wordStatus}.`);
  ensure(allowedStatuses.has(entry.wpsStatus), `${entry.id} has invalid WPS status ${entry.wpsStatus}.`);

  const wordOutput = clipboard.formatForWordUnicodeMath(entry.latex);
  const wpsOutput = clipboard.formatForWpsLatex(entry.latex);
  ensure(wordOutput === entry.expectedWordUnicodeMath, `${entry.id} Word output changed. Expected "${entry.expectedWordUnicodeMath}", got "${wordOutput}".`);
  ensure(wpsOutput === entry.expectedWpsLatex, `${entry.id} WPS output changed. Expected "${entry.expectedWpsLatex}", got "${wpsOutput}".`);
  ensure(!/\n/.test(wpsOutput), `${entry.id} WPS output must remain one line.`);
  ensure(!/\\\s+[A-Za-z]+/.test(wpsOutput), `${entry.id} WPS output contains a split command.`);
  ensure(!/\\(?:mathrm|operatorname|text|mbox)\b/.test(wpsOutput), `${entry.id} WPS output contains a fragile text-style command.`);

  for (const target of ["word", "wps"]) {
    const status = entry[`${target}Status`];
    if (status === "PASS" || status === "FAIL") {
      ensure(String(entry[`${target}Evidence`] || "").trim(), `${entry.id} ${target} ${status} requires evidence.`);
    }
  }
});

if (printFormulaPrompt) {
  console.log("请按编号逐项单独渲染以下公式，不要改写、合并或省略。每个编号使用一个独立的块级公式：");
  for (const entry of record.formulaCases) {
    console.log(`\n${entry.id}\n\\[\n${entry.latex}\n\\]`);
  }
}

const chatPassCount = record.chatgptCases.filter((entry) => entry.status === "PASS").length;
const wordRecordedCount = record.formulaCases.filter((entry) => ["PASS", "FAIL"].includes(entry.wordStatus)).length;
const wpsRecordedCount = record.formulaCases.filter((entry) => ["PASS", "FAIL"].includes(entry.wpsStatus)).length;
const wordVersionRecorded = Boolean(
  String(record.formulaEnvironment?.wordVersion || "").trim()
  && record.formulaEnvironment.wordVersion !== "NOT RECORDED"
);
const wpsVersionRecorded = Boolean(
  String(record.formulaEnvironment?.wpsVersion || "").trim()
  && record.formulaEnvironment.wpsVersion !== "NOT RECORDED"
);
const readyForVersionReview = chatPassCount === 12
  && wordRecordedCount === 20
  && wpsRecordedCount === 20
  && wordVersionRecorded
  && wpsVersionRecorded;

if (requireComplete) {
  ensure(chatPassCount === 12, `Release gate requires M-01 through M-12 PASS; current ${chatPassCount}/12.`);
  ensure(wordVersionRecorded, "Release gate requires the tested Word version.");
  ensure(wpsVersionRecorded, "Release gate requires the tested WPS version.");
  ensure(wordRecordedCount === 20, `Release gate requires 20 Word outcomes; current ${wordRecordedCount}/20.`);
  ensure(wpsRecordedCount === 20, `Release gate requires 20 WPS outcomes; current ${wpsRecordedCount}/20.`);
}

console.log(
  `[stage0-acceptance] schema ok; ChatGPT ${chatPassCount}/12 PASS; `
  + `Word ${wordRecordedCount}/20 recorded; WPS ${wpsRecordedCount}/20 recorded; `
  + `release gate ${readyForVersionReview ? "READY FOR VERSION REVIEW" : "PENDING"}`
);
