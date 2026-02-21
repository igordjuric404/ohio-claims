import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/html" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "on",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        "USE_MEMORY_STORAGE=true PORT=8099 HOST=127.0.0.1 npx tsx src/index.ts",
      cwd: "../services/claims-api",
      port: 8099,
      reuseExistingServer: true,
      timeout: 30_000,
      env: { USE_MEMORY_STORAGE: "true", PORT: "8099", HOST: "127.0.0.1" },
    },
    {
      command: "npx vite --port 5173",
      port: 5173,
      reuseExistingServer: true,
      timeout: 15_000,
      env: { API_TARGET: "http://127.0.0.1:8099" },
    },
  ],
});
