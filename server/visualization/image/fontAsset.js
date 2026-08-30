const fs = require("fs");

const FONT_FAMILY = "Chartbrew Inter Tight";
const FONT_FILE = require.resolve(
  "@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2"
);
const FONT_DATA = fs.readFileSync(FONT_FILE).toString("base64");

function getEmbeddedFontCss() {
  return `@font-face{font-family:'${FONT_FAMILY}';font-style:normal;font-weight:100 900;`
    + `src:url(data:font/woff2;base64,${FONT_DATA}) format('woff2')}`;
}

module.exports = {
  FONT_FAMILY,
  getEmbeddedFontCss,
};
