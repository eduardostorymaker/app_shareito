import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Flujos críticos de extremo a extremo contra el Supabase LOCAL (`npx supabase start`
 * + data_supabase.sql cargado). Nunca contra el proyecto real: crean usuarios de prueba.
 *   npm run test:e2e
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

/** Variables del Supabase local. Se pasan al proceso y ganan a .env.local (tu proyecto real). */
const e2eEnv = Object.fromEntries(
  readFileSync(".env.e2e", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-PE",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "movil", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Compila con las variables locales (las NEXT_PUBLIC_* se incrustan al compilar).
    command: `npx next build && npx next start -p ${PORT}`,
    env: e2eEnv,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
