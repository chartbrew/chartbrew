import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { isChatPinned, scrollChatToBottom } from "../chatScroll";

function useChatAutoScroll(contentVersion, resetKey = "default") {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const isPinnedRef = useRef(true);
  const resetKeyRef = useRef(resetKey);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    isPinnedRef.current = true;
    scrollChatToBottom(container);
  }, []);

  useLayoutEffect(() => {
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      isPinnedRef.current = true;
    }
    if (!isPinnedRef.current) return undefined;
    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [contentVersion, resetKey, scrollToBottom]);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content || typeof ResizeObserver === "undefined") return undefined;
    let frame = null;
    const handleScroll = () => {
      isPinnedRef.current = isChatPinned(container);
    };
    const observer = new ResizeObserver(() => {
      if (!isPinnedRef.current) return;
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(scrollToBottom);
    });
    container.addEventListener("scroll", handleScroll, { passive: true });
    observer.observe(content);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [contentVersion, scrollToBottom]);

  return { containerRef, contentRef };
}

export default useChatAutoScroll;
