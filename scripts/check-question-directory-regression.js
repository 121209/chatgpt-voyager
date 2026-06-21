const fs = require("fs");

const CONTENT_FILE = "src/content/content.js";
const source = fs.readFileSync(CONTENT_FILE, "utf8");

function fail(message) {
  console.error("Question directory regression check failed.");
  console.error("");
  console.error(message);
  process.exit(1);
}

const directMatchesBlock = source.match(/const directMatches = Array\.from\(document\.querySelectorAll\(USER_MESSAGE_CANDIDATE_SELECTOR\)\)[\s\S]*?\.filter\(looksLikeUserMessageElement\);/);
if (!directMatchesBlock) {
  fail("getUserMessages must always scan USER_MESSAGE_CANDIDATE_SELECTOR so mixed ChatGPT DOM structures do not hide user questions.");
}

if (/const directMatches = turnMatches\.length > 0/.test(source)) {
  fail("directMatches must not be gated by turnMatches; otherwise the hamburger directory can miss user-role messages.");
}

const directoryQuestionsBlock = source.match(/function getDirectoryQuestions\(\) \{[\s\S]*?\n  \}/);
if (!directoryQuestionsBlock) {
  fail("Could not find getDirectoryQuestions().");
}

if (/\.filter\(hasDirectoryOrderEvidence\)/.test(directoryQuestionsBlock[0])) {
  fail("getDirectoryQuestions must include all recorded questions, including cached items that need recapture.");
}

if (!source.includes("function findQuestionByStableIdentity(items, targetQuestion)")) {
  fail("Question merging must use a stable identity helper so repeated or similar question text remains distinct.");
}

if (!source.includes("&& (!targetHasTurn || !Number.isFinite(question.turnNumber))")) {
  fail("Known ChatGPT turns must not fall back to an element key owned by another known turn.");
}

if (!source.includes("if (Number.isFinite(question?.turnNumber)) return `turn:${question.turnNumber}`;")) {
  fail("Serialized question identity must prefer ChatGPT turn numbers before text hashes.");
}

const mergeQuestionIndexBlock = source.match(/function mergeQuestionIndex\(oldQuestions, newlyScannedQuestions, scanContext = \{\}\) \{[\s\S]*?\n  \}/);
if (!mergeQuestionIndexBlock) {
  fail("Could not find mergeQuestionIndex().");
}

if (!mergeQuestionIndexBlock[0].includes("findQuestionByStableIdentity(merged, question)")) {
  fail("mergeQuestionIndex must match scanned questions by stable identity.");
}

if (mergeQuestionIndexBlock[0].includes("const byHash = new Map()")) {
  fail("mergeQuestionIndex must not collapse different turns into a single text-hash entry.");
}

if (!source.includes("const trigger = event.currentTarget;")) {
  fail("Async navigation click handlers must retain their trigger before awaiting location work.");
}
