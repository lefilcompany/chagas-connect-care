import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/test/example.test.ts", "tests/e2e/**", "node_modules/**", "dist/**"],
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: process.env.CI ? { junit: "test-results/unit-junit.xml" } : undefined,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "json-summary", "html", "lcov"],
      include: [
        "src/lib/templates.ts",
        "src/lib/segments.ts",
        "src/lib/whatsapp.ts",
        "src/lib/auth.tsx",
        "src/lib/access.tsx",
        "src/components/auth/RequireSuperAdmin.tsx",
      ],
      exclude: [
        "src/integrations/**",
        "src/**/*.d.ts",
        "src/test/**",
        "**/*.config.*",
      ],
      thresholds: {
        statements: 45,
        branches: 35,
        functions: 45,
        lines: 45,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
