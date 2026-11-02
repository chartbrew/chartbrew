const { isMainThread, parentPort } = require("worker_threads");

const { renderImagePng } = require("./imageRenderer");

if (!isMainThread && parentPort) {
  parentPort.on("message", async ({ document, id }) => {
    try {
      const png = await renderImagePng(document);
      const bytes = new Uint8Array(png);
      parentPort.postMessage({ id, png: bytes }, [bytes.buffer]);
    } catch (error) {
      parentPort.postMessage({
        error: {
          code: error.code || "IMAGE_RENDER_FAILED",
          message: error.message || "Image rendering failed",
        },
        id,
      });
    }
  });
}
