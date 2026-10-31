import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" },
});
