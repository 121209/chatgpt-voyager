const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const fixtureServerPath = path.join(root, "scripts", "serve-navigation-fixture.js");
const scenarios = process.argv.slice(2).length ? process.argv.slice(2) : ["basic", "virtualized", "restore", "compatibility", "answer-pairing", "answer-identity", "modern-chat", "modern-cache"];
const fixtureRun = `browser-${Date.now().toString(36)}`;
const port = 4173 + Math.floor(Math.random() * 800);
const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "voyager-navigation-fixture-"));

function executableFromCommand(command) {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(lookup, [command], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) return "";
  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function findChrome() {
  const candidates = [process.env.CHROME_PATH].filter(Boolean);

  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const localAppData = process.env.LOCALAPPDATA || "";
    candidates.push(
      path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe")
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    );
  } else {
    ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]
      .map(executableFromCommand)
      .filter(Boolean)
      .forEach((candidate) => candidates.push(candidate));
  }

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || "";
}

function waitForServer(server) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Fixture server did not start. ${output.trim()}`));
    }, 5000);

    const onData = (chunk) => {
      output += chunk.toString();
      if (!output.includes("Voyager navigation fixture:")) return;
      clearTimeout(timeout);
      resolve();
    };

    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.once("exit", (code) => {
      if (code === null || output.includes("Voyager navigation fixture:")) return;
      clearTimeout(timeout);
      reject(new Error(`Fixture server exited with code ${code}. ${output.trim()}`));
    });
  });
}

function runScenario(chromePath, scenario) {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${port}/tests/navigation-core-fixture.html?scenario=${encodeURIComponent(scenario)}&fixtureRun=${encodeURIComponent(fixtureRun)}`;
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-features=CalculateNativeWinOcclusion",
      "--metrics-recording-only",
      "--no-default-browser-check",
      "--no-first-run",
      `--user-data-dir=${profilePath}`,
      "--virtual-time-budget=90000",
      "--dump-dom",
      url
    ];
    const browser = spawn(chromePath, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      browser.kill();
      reject(new Error(`${scenario} fixture timed out after 120 seconds.`));
    }, 120000);

    browser.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    browser.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    browser.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    browser.once("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`${scenario} Chrome exit code ${code}. ${stderr.trim().slice(-1200)}`));
        return;
      }

      const status = stdout.match(/data-fixture-status="(PASS|FAIL)"/)?.[1];
      if (!status) {
        reject(new Error(`${scenario} fixture did not expose a final status. ${stderr.trim().slice(-1200)}`));
        return;
      }

      const results = Array.from(stdout.matchAll(/<li data-status="(?:PASS|FAIL)">([^<]*)<\/li>/g))
        .map((match) => match[1].replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&"));
      results.forEach((result) => console.log(`[navigation-browser-fixture] ${scenario}: ${result}`));
      if (status !== "PASS") {
        reject(new Error(`${scenario} fixture reported FAIL.`));
        return;
      }

      console.log(`[navigation-browser-fixture] ${scenario}: PASS`);
      resolve();
    });
  });
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error("Chrome or Edge was not found. Set CHROME_PATH to a Chromium executable.");
  }

  console.log(`[navigation-browser-fixture] browser: ${chromePath}`);
  const server = spawn(process.execPath, [fixtureServerPath, String(port)], {
    cwd: root,
    windowsHide: true
  });

  try {
    await waitForServer(server);
    for (const scenario of scenarios) {
      await runScenario(chromePath, scenario);
    }
  } finally {
    server.kill();
    try {
      fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    } catch (error) {
      console.warn(`[navigation-browser-fixture] temporary profile cleanup failed: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(`[navigation-browser-fixture] ${error.message}`);
  process.exitCode = 1;
});
