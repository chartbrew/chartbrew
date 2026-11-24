const { section } = require("./resultBlocks");

function formatError(error) {
  const text = String(error || "The request failed. Try again.").slice(0, 2800);
  return { text: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), blocks: [section(text)] };
}

module.exports = { formatError };
