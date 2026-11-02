const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const prepareClientSettings = require("./prepareClientSettings");
const template = readFileSync(path.join(__dirname, "../client/src/config/settings.template.js"), "utf8");
const oldHosts = `export const API_HOST = import.meta.env.PROD
  ? import.meta.env.VITE_APP_API_HOST
  : (import.meta.env.VITE_APP_API_HOST_DEV || "http://localhost:4019");

export const SITE_HOST = import.meta.env.PROD
  ? import.meta.env.VITE_APP_CLIENT_HOST
  : (import.meta.env.VITE_APP_CLIENT_HOST_DEV || "http://localhost:4018");
`;
const newHosts = `export const API_HOST = import.meta.env.VITE_APP_API_HOST || "http://localhost:4019";

export const SITE_HOST = import.meta.env.VITE_APP_CLIENT_HOST || "http://localhost:4018";
`;

function fixture(t, settings) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "chartbrew-settings-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, "settings.template.js"), template);
  if (settings !== undefined) writeFileSync(path.join(directory, "settings.js"), settings);
  return directory;
}

test("creates missing settings from the current template", (t) => {
  const directory = fixture(t);
  prepareClientSettings(directory);
  assert.equal(readFileSync(path.join(directory, "settings.js"), "utf8"), template);
});

for (const newline of ["\n", "\r\n"]) {
  test(`updates old hosts and preserves custom settings with ${JSON.stringify(newline)} line endings`, (t) => {
    const custom = '// Keep this installation setting.\nexport const CUSTOM_HOST = "https://example.com";\n';
    const directory = fixture(t, (oldHosts + custom).replaceAll("\n", newline));
    prepareClientSettings(directory);
    const expected = (newHosts + custom).replaceAll("\n", newline);
    assert.equal(readFileSync(path.join(directory, "settings.js"), "utf8"), expected);
    prepareClientSettings(directory);
    assert.equal(readFileSync(path.join(directory, "settings.js"), "utf8"), expected);
  });
}

test("preserves custom host definitions and warns about remaining old variables", (t) => {
  const custom = oldHosts.replace("localhost:4019", "localhost:3210");
  const directory = fixture(t, custom);
  const warning = t.mock.method(console, "warn", () => {});
  prepareClientSettings(directory);
  const result = readFileSync(path.join(directory, "settings.js"), "utf8");
  assert.equal(result, custom.slice(0, custom.indexOf("export const SITE_HOST"))
    + newHosts.slice(newHosts.indexOf("export const SITE_HOST")));
  assert.equal(warning.mock.calls.length, 1);
  assert.match(warning.mock.calls[0].arguments[0], /Update these definitions manually/);
});

test("leaves current and fully custom settings unchanged", (t) => {
  const settings = template.replace('"http://localhost:4019"', '"https://api.example.com"')
    + '\nexport const CUSTOM_SETTING = true;\n';
  const directory = fixture(t, settings);
  const warning = t.mock.method(console, "warn", () => {});
  prepareClientSettings(directory);
  assert.equal(readFileSync(path.join(directory, "settings.js"), "utf8"), settings);
  assert.equal(warning.mock.calls.length, 0);
});

test("reports read errors instead of replacing existing settings", (t) => {
  const directory = fixture(t);
  mkdirSync(path.join(directory, "settings.js"));
  assert.throws(() => prepareClientSettings(directory), { code: "EISDIR" });
});
