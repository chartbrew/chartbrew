function getRemainingScrollDistance(container) {
  return Math.max(
    Number(container?.scrollHeight || 0)
      - Number(container?.scrollTop || 0)
      - Number(container?.clientHeight || 0),
    0
  );
}

function isChatPinned(container, threshold = 48) {
  return getRemainingScrollDistance(container) <= threshold;
}

function scrollChatToBottom(container) {
  if (!container) return;
  container.scrollTop = container.scrollHeight;
}

export {
  getRemainingScrollDistance,
  isChatPinned,
  scrollChatToBottom,
};
