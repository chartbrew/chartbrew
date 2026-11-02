const { copyFileSync, readFileSync, writeFileSync, constants } = require("node:fs");
const path = require("node:path");

function prepareClientSettings(directory = path.join(__dirname, "../client/src/config")) {
  const settingsPath = path.join(directory, "settings.js");
  let settings;
  try {
    settings = readFileSync(settingsPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    copyFileSync(path.join(directory, "settings.template.js"), settingsPath, constants.COPYFILE_EXCL);
    return;
  }

  let updated = settings;
  for (const [name, variable, port] of [
    ["API_HOST", "VITE_APP_API_HOST", 4019],
    ["SITE_HOST", "VITE_APP_CLIENT_HOST", 4018],
  ]) {
    const oldDefinition = `export const ${name} = import.meta.env.PROD\n`
      + `  ? import.meta.env.${variable}\n`
      + `  : (import.meta.env.${variable}_DEV || "http://localhost:${port}");`;
    const newDefinition = `export const ${name} = import.meta.env.${variable} || "http://localhost:${port}";`;
    updated = updated.replace(oldDefinition, newDefinition)
      .replace(oldDefinition.replaceAll("\n", "\r\n"), newDefinition);
  }

  if (updated !== settings) writeFileSync(settingsPath, updated);
  if (/\bVITE_APP_\w+_DEV\b/.test(updated)) {
    console.warn("Custom settings in client/src/config/settings.js still use _DEV variables. Update these definitions manually to use the original variable names and preserve your custom values.");
  }
}

if (require.main === module) prepareClientSettings();

module.exports = prepareClientSettings;
