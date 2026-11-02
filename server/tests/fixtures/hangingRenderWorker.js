const { parentPort } = require("worker_threads");

parentPort.on("message", ({ document, id }) => {
  if (document?.hang) return;
  const png = new Uint8Array([137, 80, 78, 71]);
  parentPort.postMessage({ id, png }, [png.buffer]);
});
