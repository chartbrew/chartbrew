import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/browser/echartsFixedSize.test.js"],
    maxWorkers: 1,
    pool: "forks",
  },
});
