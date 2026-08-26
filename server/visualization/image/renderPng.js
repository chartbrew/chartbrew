const sharp = require("sharp");

const { IMAGE_RENDER_LIMITS, assertImageDimensions } = require("../../modules/chartImage/imageLimits");

async function renderPng(svg, { height, width }) {
  assertImageDimensions(width, height);
  if (typeof svg !== "string" || Buffer.byteLength(svg) > IMAGE_RENDER_LIMITS.maxSvgBytes) {
    throw new Error("SVG input exceeds the image size limit");
  }
  const { data, info } = await sharp(Buffer.from(svg), {
    density: 72,
    limitInputPixels: IMAGE_RENDER_LIMITS.maxPixels,
  })
    .png({ adaptiveFiltering: true, compressionLevel: 9, palette: false })
    .toBuffer({ resolveWithObject: true });

  if (info.width !== width || info.height !== height) {
    throw new Error("PNG dimensions do not match the image request");
  }
  if (data.length > IMAGE_RENDER_LIMITS.maxPngBytes) {
    throw new Error("PNG output exceeds the image size limit");
  }
  return data;
}

module.exports = {
  renderPng,
};
