export const activeConversationStorageKey = (userId, teamId) => `cb-active-chat:${userId}:${teamId}`;

export function readActiveConversation(userId, teamId, storage) {
  try {
    const id = (storage || window.sessionStorage).getItem(activeConversationStorageKey(userId, teamId));
    return id ? { id, key: id, userId, teamId, title: "Continue conversation" } : null;
  } catch (_) {
    return null;
  }
}

export function writeActiveConversation(userId, teamId, conversation, storage) {
  try {
    const target = storage || window.sessionStorage;
    const key = activeConversationStorageKey(userId, teamId);
    if (conversation?.id) target.setItem(key, conversation.id);
    else target.removeItem(key);
  } catch (_) {
    // Navigation still works when browser storage is unavailable.
  }
}

export function isActiveConversationFor(conversation, userId, teamId) {
  return Boolean(conversation && String(conversation.userId) === String(userId)
    && String(conversation.teamId) === String(teamId));
}
