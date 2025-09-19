import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    testTimeout: 30000, // 30s timeout for tests (useful for container startup)
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        "tests/**",
        "uploads/**",
        "models/migrations/**",
        "models/scripts/**",
        "*.config.js",
        "index.js", // Main entry point
      ],
      include: [
        "api/**",
        "controllers/**",
        "modules/**",
        "middlewares/**",
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    pool: "forks", // Use forks to avoid issues with database connections
    poolOptions: {
      forks: {
        singleFork: true // Use single fork to avoid database connection conflicts
      }
    },
    globalSetup: "./tests/globalSetup.js",
    globalTeardown: "./tests/globalTeardown.js"
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      "@tests": resolve(__dirname, "./tests"),
    },
  },
});
