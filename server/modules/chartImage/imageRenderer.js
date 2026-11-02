const { composeImageSvg } = require("../../visualization/image/composeImageSvg");
const { renderPng } = require("../../visualization/image/renderPng");

function renderImageSvg(document) {
  return composeImageSvg(document);
}

async function renderImagePng(document) {
  const svg = renderImageSvg(document);
  return renderPng(svg, document);
}

module.exports = {
  renderImagePng,
  renderImageSvg,
};
