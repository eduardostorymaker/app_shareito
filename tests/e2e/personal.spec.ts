import { expect, test } from "@playwright/test";
import { addExpense, logIn, signUp, uniqueEmail } from "./helpers";

test("registro → bienvenida → primer gasto, editar, historial, papelera y sesión persistente", async ({ page, context }) => {
  const email = uniqueEmail("ana");
  await signUp(page, "Ana Prueba", email);

  await expect(page.getByText("Registra tu primer gasto")).toBeVisible();
  await addExpense(page, "45,50", "Supermercado y mercado", { description: "Compra semanal" });

  // Aparece al instante en Inicio, en soles (locale es-PE → PEN).
  await expect(page.getByRole("link", { name: /Compra semanal/ })).toBeVisible();
  await expect(page.getByText("S/ 45.50").first()).toBeVisible();

  // La sesión sigue tras cerrar y abrir el navegador (cookies persistentes de 400 días).
  const cookies = await context.cookies();
  const auth = cookies.find((c) => c.name.includes("auth-token"));
  expect(auth, "cookie de sesión").toBeTruthy();
  expect(auth!.expires - Date.now() / 1000).toBeGreaterThan(300 * 24 * 3600);
  await page.reload();
  await expect(page.getByRole("link", { name: /Compra semanal/ })).toBeVisible();

  // Detalle → editar importe → el historial muestra el cambio.
  await page.getByRole("link", { name: /Compra semanal/ }).click();
  await page.waitForURL("**/gastos/*");
  await page.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Importe").fill("50");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados").first()).toBeVisible();
  await expect(page.getByText("S/ 50.00").first()).toBeVisible();
  await page.getByRole("tab", { name: /Historial/ }).click();
  await expect(page.getByText("Editaste el gasto")).toBeVisible();
  await expect(page.getByRole("tabpanel").locator(".line-through")).toHaveText("S/ 45.50");

  // Eliminar → papelera → restaurar.
  await page.getByRole("tab", { name: "Detalle" }).click();
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Gasto enviado a la papelera")).toBeVisible();
  await expect(page.getByText(/Este gasto está en la papelera/)).toBeVisible();
  await page.goto("/papelera");
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Gasto restaurado")).toBeVisible();
  await expect(page.getByText("La papelera está vacía")).toBeVisible();

  // Volver a entrar con contraseña.
  await context.clearCookies();
  await logIn(page, email);
  await expect(page.getByRole("link", { name: /Compra semanal/ })).toBeVisible();
});

test("el panel suma lo mismo que la lista de gastos", async ({ page }) => {
  await signUp(page, "Beto Panel", uniqueEmail("beto"));
  await addExpense(page, "100", "Supermercado y mercado");
  await addExpense(page, "30", "Restaurantes");
  await addExpense(page, "20", "Combustible");

  await page.goto("/gastos?rango=mes");
  await expect(page.getByText(/3 gastos/)).toBeVisible();
  await expect(page.getByText("S/ 150.00").first()).toBeVisible();

  await page.goto("/panel");
  await expect(page.getByText("Total gastado")).toBeVisible();
  const total = page.locator("section[aria-label=Indicadores]");
  await expect(total.getByText("S/ 150.00")).toBeVisible();
  await expect(page.getByRole("link", { name: /Alimentación/ })).toBeVisible();

  // Desglose por subcategoría.
  await page.getByRole("link", { name: /Alimentación/ }).click();
  await expect(page.getByText("Todas las categorías")).toBeVisible();
  await expect(page.getByText("Supermercado y mercado").first()).toBeVisible();
  await expect(page.getByText("Restaurantes").first()).toBeVisible();
});
