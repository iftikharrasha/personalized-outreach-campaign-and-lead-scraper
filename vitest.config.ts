import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Minimal config — Slice 1.13 extends this into separate unit / integration
// projects. For now it runs the unit suite under tests/unit.
export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "packages/shared/src"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
