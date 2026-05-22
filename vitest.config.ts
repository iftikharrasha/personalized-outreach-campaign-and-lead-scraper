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
          // Serial execution: integration tests share a real DB — parallel file
          // execution causes FK races between beforeAll/afterAll across files.
          fileParallelism: false,
        },
        resolve: {
          alias: {
            "@shared": resolve(__dirname, "packages/shared/src"),
            // "@/" is the web app's path alias — needed when integration tests
            // import Next.js route handlers (Slice 4.12 outreach lifecycle).
            "@/": resolve(__dirname, "apps/web") + "/",
          },
        },
      },
    ],
  },
});
