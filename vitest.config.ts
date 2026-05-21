import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "packages/shared/src"),
    },
  },
  test: {
    projects: [
      {
        name: "unit",
        test: {
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
        resolve: {
          alias: { "@shared": resolve(__dirname, "packages/shared/src") },
        },
      },
      {
        name: "integration",
        test: {
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 30000,
        },
        resolve: {
          alias: { "@shared": resolve(__dirname, "packages/shared/src") },
        },
      },
    ],
  },
});
