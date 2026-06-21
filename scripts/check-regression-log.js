const { execFileSync } = require("child_process");

const REGRESSION_LOG = "REGRESSION_LOG.md";

const CODE_PATH_PATTERNS = [
  /^src\//,
  /^scripts\//,
  /^assets\//,
  /^manifest\.json$/,
  /^package(?:-lock)?\.json$/,
  /^\.github\//
];

const IGNORED_PATH_PATTERNS = [
  /^dist\//,
  /^AGENTS\.md$/,
  /^REGRESSION_LOG\.md$/,
  /^README\.md$/,
  /^NOTICE\.md$/
];

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    if (error.status === 129 || error.status === 128) {
      return [];
    }
    throw error;
  }
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function unique(values) {
  return Array.from(new Set(values));
}

function isIgnoredPath(filePath) {
  return IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

function isCodePath(filePath) {
  if (isIgnoredPath(filePath)) return false;
  return CODE_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

function getChangedFiles() {
  return unique([
    ...git(["diff", "--name-only"]),
    ...git(["diff", "--cached", "--name-only"]),
    ...git(["ls-files", "--others", "--exclude-standard"])
  ].map(normalizePath));
}

function main() {
  const changedFiles = getChangedFiles();
  const codeChanges = changedFiles.filter(isCodePath);
  const logUpdated = changedFiles.includes(REGRESSION_LOG);

  if (codeChanges.length === 0 || logUpdated) {
    return;
  }

  console.error("Regression log check failed.");
  console.error("");
  console.error("检测到本地代码相关改动，但 REGRESSION_LOG.md 没有同步更新。");
  console.error("请先为本次修复追加问题记录，再继续检查或交付。");
  console.error("");
  console.error("需要记录的改动文件：");
  codeChanges.forEach((filePath) => console.error(`- ${filePath}`));
  console.error("");
  console.error("记录内容至少包括：问题现象、影响范围、修复方式、回归测试、验证结果、相关文件。");
  process.exit(1);
}

main();
