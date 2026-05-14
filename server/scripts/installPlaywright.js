const { spawnSync } = require("child_process");

const skipValues = new Set(["1", "true", "yes"]);
const shouldSkip = skipValues.has(String(process.env.CB_SKIP_PLAYWRIGHT_INSTALL || "").toLowerCase());

if (shouldSkip) {
  process.stdout.write("Skipping Playwright browser install because CB_SKIP_PLAYWRIGHT_INSTALL is set.\n");
  process.exit(0);
}

const result = spawnSync("npx", ["--yes", "playwright", "install", "chromium", "--with-deps"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
