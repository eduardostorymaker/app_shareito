import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "clave-segura-123";

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@test.dev`;
}

/** Ejecuta SQL en el Postgres del Supabase local (solo para preparar escenarios de prueba). */
export function sql(query: string): string {
  const container = process.env.E2E_DB_CONTAINER ?? "supabase_db_registro-gastos";
  return execFileSync("docker", ["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", query], {
    encoding: "utf8",
  }).trim();
}

export async function signUp(page: Page, name: string, email: string, opts: { shared?: boolean } = {}) {
  await page.goto("/registro");
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/bienvenida");
  if (opts.shared) await page.getByRole("button", { name: /Compartir gastos/ }).click();
  await page.getByRole("button", { name: opts.shared ? "Continuar y crear un grupo" : "Empezar" }).click();
  await page.waitForURL(opts.shared ? "**/grupos?nuevo=1" : (url) => url.pathname === "/");
}

export async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

/** Registra un gasto con el formulario: importe → categoría → guardar. */
export async function addExpense(
  page: Page,
  amount: string,
  category: string,
  opts: { description?: string; shared?: boolean; personal?: boolean } = {},
) {
  const dialog = page.getByRole("dialog");
  // El panel del gasto anterior puede seguir cerrándose (animación): esperar a que salga.
  await expect(dialog).toHaveCount(0);
  // Tras un page.goto el botón puede pulsarse antes de que React hidrate: se reintenta.
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.getByRole("button", { name: "Nuevo gasto" }).first().click();
    await expect(dialog.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await dialog.getByLabel("Importe").fill(amount);
  if (opts.personal) await dialog.getByRole("radio", { name: "Personal" }).click();
  if (opts.shared) await dialog.getByRole("radio", { name: /^Compartido/ }).click();
  const chip = dialog.getByRole("button", { name: category, exact: true });
  if (await chip.count()) {
    await chip.first().click();
  } else {
    await dialog.getByRole("button", { name: /Ver todas/ }).click();
    await dialog.getByLabel("Buscar categoría").fill(category);
    await dialog.getByRole("button", { name: new RegExp(category) }).first().click();
  }
  if (opts.description) await dialog.getByLabel("Descripción").fill(opts.description);
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Gasto guardado").first()).toBeVisible();
}
