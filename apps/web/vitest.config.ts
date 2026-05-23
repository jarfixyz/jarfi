import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "lib/**/*.test.ts", "lib/**/*.test.tsx"],
    testTimeout: 30000,
    setupFiles: ["tests/setup.ts"],
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@jarfi/sdk": resolve(__dirname, "../../packages/sdk/src/index.ts"),
    },
  },
});
