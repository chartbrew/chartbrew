import assert from "node:assert/strict";
import test from "node:test";

import {
  getSeenNewsIds,
  getUnreadNewsItems,
  getNewsFeedUrl,
  normalizeNewsFeed,
  saveSeenNewsIds,
} from "./newsFeed.js";

function createStorage(initialValue) {
  const data = new Map(initialValue ? [["__cb_news_seen_ids", initialValue]] : []);

  return {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("normalizeNewsFeed keeps only renderable news items", () => {
  const items = normalizeNewsFeed({
    items: [
      {
        id: "chartbrew-v5-launch",
        title: "Chartbrew v5 Launch",
        excerpt: "Cleaner dashboards.",
        publishedAt: "2026-05-01T06:01:17.000Z",
        category: "updates",
        tags: ["updates", "story", ""],
        coverImage: "https://chartbrew.com/banner.webp",
        coverImageAlt: "Chartbrew v5 banner",
        url: "https://chartbrew.com/blog/chartbrew-v5-launch",
      },
      {
        id: "",
        title: "Missing id",
        excerpt: "Invalid.",
      },
    ],
  });

  assert.deepEqual(items, [
    {
      id: "chartbrew-v5-launch",
      title: "Chartbrew v5 Launch",
      excerpt: "Cleaner dashboards.",
      publishedAt: "2026-05-01T06:01:17.000Z",
      category: "updates",
      tags: ["updates", "story"],
      coverImage: "https://chartbrew.com/banner.webp",
      coverImageAlt: "Chartbrew v5 banner",
      url: "https://chartbrew.com/blog/chartbrew-v5-launch",
    },
  ]);
});

test("seen news ids are persisted and used to calculate unread items", () => {
  const storage = createStorage();

  saveSeenNewsIds(["chartbrew-v5-launch", "", "chartbrew-v5-launch"], storage);

  assert.deepEqual(getSeenNewsIds(storage), ["chartbrew-v5-launch"]);
  assert.deepEqual(
    getUnreadNewsItems(
      [
        { id: "chartbrew-v5-launch" },
        { id: "chartbrew-fair-source" },
      ],
      getSeenNewsIds(storage),
    ),
    [{ id: "chartbrew-fair-source" }],
  );
});

test("getNewsFeedUrl supports defaults, overrides, and disabling", () => {
  assert.equal(getNewsFeedUrl({}), "https://chartbrew.com/api/news");
  assert.equal(getNewsFeedUrl({ VITE_APP_NEWS_FEED_URL: "https://example.com/news" }), "https://example.com/news");
  assert.equal(getNewsFeedUrl({ VITE_APP_NEWS_FEED_URL: "off" }), "");
});
