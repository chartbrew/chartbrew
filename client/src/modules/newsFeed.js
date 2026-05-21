export const NEWS_FEED_STORAGE_KEY = "__cb_news_seen_ids";
export const DEFAULT_NEWS_FEED_URL = "https://chartbrew.com/api/news";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean)));
}

export function normalizeNewsFeed(rawFeed) {
  const safeFeed = rawFeed && typeof rawFeed === "object" ? rawFeed : {};
  const rawItems = Array.isArray(safeFeed.items) ? safeFeed.items : [];

  return rawItems
    .map((item) => {
      const id = normalizeString(item?.id);
      const title = normalizeString(item?.title);
      const excerpt = normalizeString(item?.excerpt);

      if (!id || !title || !excerpt) return null;

      return {
        id,
        title,
        excerpt,
        publishedAt: normalizeString(item?.publishedAt),
        category: normalizeString(item?.category),
        tags: uniqueStrings(item?.tags),
        coverImage: normalizeString(item?.coverImage),
        coverImageAlt: normalizeString(item?.coverImageAlt) || title,
        url: normalizeString(item?.url),
      };
    })
    .filter(Boolean);
}

export function getSeenNewsIds(storage = globalThis.localStorage) {
  if (!storage) return [];

  try {
    return uniqueStrings(JSON.parse(storage.getItem(NEWS_FEED_STORAGE_KEY) || "[]"));
  } catch (_error) {
    return [];
  }
}

export function saveSeenNewsIds(ids, storage = globalThis.localStorage) {
  if (!storage) return;

  try {
    storage.setItem(NEWS_FEED_STORAGE_KEY, JSON.stringify(uniqueStrings(ids)));
  } catch (_error) {
    // Ignore private-mode or storage quota failures; the badge can reset safely.
  }
}

export function getUnreadNewsItems(items, seenIds) {
  const seenIdSet = new Set(uniqueStrings(seenIds));

  return (Array.isArray(items) ? items : []).filter((item) => item?.id && !seenIdSet.has(item.id));
}

export function getNewsFeedUrl(env = import.meta.env) {
  const configuredUrl = normalizeString(env?.VITE_APP_NEWS_FEED_URL);

  if (configuredUrl.toLowerCase() === "off") return "";

  return configuredUrl || DEFAULT_NEWS_FEED_URL;
}
