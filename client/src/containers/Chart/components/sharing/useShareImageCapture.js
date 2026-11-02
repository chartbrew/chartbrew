import { useCallback, useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";

const CAPTURE_DELAY_MS = 180;
const CHART_WAIT_MS = 2000;

function waitForFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForChart(node) {
  const renderer = node.querySelector("[data-echarts-renderer]");
  if (!renderer) {
    await waitForFrame();
    await waitForFrame();
    return;
  }
  const deadline = Date.now() + CHART_WAIT_MS;
  while (!renderer.querySelector("svg") && Date.now() < deadline) {
    await waitForFrame();
  }
  await waitForFrame();
  await waitForFrame();
}

async function waitForImages(node) {
  const images = [...node.querySelectorAll("img")];
  await Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }
    if (image.decode) await image.decode().catch(() => {});
  }));
}

function createCaptureError(error) {
  const next = new Error("The image could not be created. Try again.");
  next.cause = error;
  return next;
}

export default function useShareImageCapture({
  dimensions,
  enabled,
  fingerprint,
  nodeRef,
}) {
  const cacheRef = useRef({ blob: null, fingerprint: null });
  const activeRef = useRef(null);
  const generationRef = useRef(0);
  const [error, setError] = useState(null);
  const [isRendering, setIsRendering] = useState(false);

  const capture = useCallback(async () => {
    if (!enabled) throw new Error("Image export is not available for this chart.");
    if (cacheRef.current.fingerprint === fingerprint && cacheRef.current.blob) {
      return cacheRef.current.blob;
    }
    if (activeRef.current?.fingerprint === fingerprint) return activeRef.current.promise;

    const node = nodeRef.current;
    if (!node) throw new Error("The image preview is not ready.");
    const generation = ++generationRef.current;
    setError(null);
    setIsRendering(true);

    const promise = (async () => {
      try {
        await document.fonts?.ready;
        await waitForImages(node);
        await waitForChart(node);
        const blob = await toBlob(node, {
          cacheBust: true,
          canvasHeight: dimensions.height,
          canvasWidth: dimensions.width,
          height: dimensions.height,
          pixelRatio: 1,
          skipFonts: true,
          width: dimensions.width,
        });
        if (!blob) throw new Error("Image capture returned no data");
        if (generation === generationRef.current) {
          cacheRef.current = { blob, fingerprint };
        }
        return blob;
      } catch (captureError) {
        const nextError = createCaptureError(captureError);
        if (generation === generationRef.current) setError(nextError);
        throw nextError;
      } finally {
        if (generation === generationRef.current) setIsRendering(false);
        if (activeRef.current?.generation === generation) activeRef.current = null;
      }
    })();
    activeRef.current = { fingerprint, generation, promise };
    return promise;
  }, [dimensions.height, dimensions.width, enabled, fingerprint, nodeRef]);

  useEffect(() => {
    generationRef.current += 1;
    if (!enabled) {
      setError(null);
      setIsRendering(false);
      return undefined;
    }
    cacheRef.current = { blob: null, fingerprint: null };
    setError(null);
    const timer = window.setTimeout(() => {
      capture().catch(() => {});
    }, CAPTURE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [capture, enabled, fingerprint]);

  const retry = useCallback(() => {
    generationRef.current += 1;
    cacheRef.current = { blob: null, fingerprint: null };
    activeRef.current = null;
    return capture();
  }, [capture]);

  return {
    error,
    getCurrentBlob: capture,
    isRendering,
    retry,
  };
}
