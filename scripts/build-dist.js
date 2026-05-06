const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const entries = [
  "manifest.json",
  "README.md",
  "NOTICE.md",
  "package.json",
  "src",
  "assets"
];

function removeDir(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function copyEntry(relativePath) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(distDir, relativePath);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing build entry: ${relativePath}`);
  }

  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    copyDir(source, target);
    return;
  }

  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function copyDir(sourceDir, targetDir) {
  ensureDir(targetDir);

  for (const dirent of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, dirent.name);
    const target = path.join(targetDir, dirent.name);

    if (dirent.isDirectory()) {
      copyDir(source, target);
    } else if (dirent.isFile()) {
      fs.copyFileSync(source, target);
    }
  }
}

removeDir(distDir);
ensureDir(distDir);
entries.forEach(copyEntry);

console.log(`Built Chrome extension package in ${path.relative(rootDir, distDir)}`);
