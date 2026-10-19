import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  test: {
    tags: [{ name: "historical-replay", timeout: 30_000 }],
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
