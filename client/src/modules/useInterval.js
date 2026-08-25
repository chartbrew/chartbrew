import { useEffect, useRef } from "react";

export function startInterval(callback, delay, timers = {
  clearInterval: (id) => globalThis.clearInterval(id),
  setInterval: (intervalCallback, intervalDelay) => globalThis.setInterval(intervalCallback, intervalDelay),
}) {
  let requestPending = false;

  const tick = () => {
    if (requestPending) return;

    const result = callback();
    if (!result || typeof result.then !== "function") return;

    requestPending = true;
    Promise.resolve(result).then(
      () => { requestPending = false; },
      () => { requestPending = false; }
    );
  };

  const id = timers.setInterval(tick, delay);
  return () => timers.clearInterval(id);
}

export default (callback, delay) => {
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      return startInterval(() => savedCallback.current(), delay);
    }
  }, [delay]);
};
