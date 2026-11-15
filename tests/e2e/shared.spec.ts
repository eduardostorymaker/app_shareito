import { expect, test, type Browser } from "@playwright/test";
import { addExpense, signUp, sql, uniqueEmail } from "./helpers";

async function newUser(browser: Browser, name: string, opts: { shared?: boolean } = {}) {
  const context = await browser.newContext({
    ...test.info().project.use,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const email = uniqueEmail(name.toLowerCase());
  await signUp(page, name, email, opts);
  return { context, page, email };
}

test("grupo compartido: invitación, balance en vivo, cierre, bloqueo, reapertura y pagos", async ({ browser }) => {
  test.setTimeout(180_000);

  // Ana crea el grupo con cierre el día 15.
  const ana = await newUser(browser, "Ana", { shared: true });
  const dialog = ana.page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Nuevo grupo" })).toBeVisible();
  await dialog.getByLabel("Nombre").fill("Casa");
  await dialog.getByRole("radio", { name: "Día fijo" }).click();
  await dialog.getByRole("radio", { name: "15", exact: true }).click();
  await expect(dialog.getByText("Cada periodo va del día 16 de un mes al 15 del siguiente.")).toBeVisible();
  await dialog.getByRole("button", { name: "Crear grupo" }).click();
  await ana.page.waitForURL("**/ajustes/grupos/*?invitar=1");
  const groupId = new URL(ana.page.url()).pathname.split("/").pop()!;

  // Enlace de invitación.
  await ana.page.getByRole("button", { name: "Crear enlace" }).click();
  const link = (await ana.page.locator("span.font-mono").first().textContent())!;
  expect(link).toContain("/invitacion/");

  // Beto se registra y acepta.
  const beto = await newUser(browser, "Beto");
  await beto.page.goto(new URL(link).pathname);
  await expect(beto.page.getByText("Ana te invita a")).toBeVisible();
  await beto.page.getByRole("button", { name: "Unirme al grupo" }).click();
  await beto.page.waitForURL(`**/grupos/${groupId}`);

  // Ana registra 300 (su tipo por defecto es compartido) y mira el grupo.
  await ana.page.goto(`/grupos/${groupId}`);
  await addExpense(ana.page, "300", "Supermercado y mercado");
  await expect(ana.page.getByText("Beto te debe S/ 150.00")).toBeVisible();

  // Beto registra 100 compartido; Ana lo ve sin recargar (Realtime).
  await beto.page.goto(`/grupos/${groupId}`);
  await addExpense(beto.page, "100", "Restaurantes", { shared: true });
  await expect(beto.page.getByText("Le debes S/ 100.00 a Ana")).toBeVisible();
  await expect(ana.page.getByText("Beto te debe S/ 100.00")).toBeVisible({ timeout: 15_000 });

  // Simula que el periodo ya venció: grupo creado hace 70 días y gastos de hace 40.
  sql(`update public.groups set created_at = now() - interval '70 days' where id = '${groupId}'`);
  sql(`update public.expenses set expense_date = current_date - 40 where group_id = '${groupId}'`);

  // Al abrir el grupo se cierran los periodos vencidos.
  await ana.page.reload();
  await expect(ana.page.getByRole("heading", { name: "Cierres anteriores" })).toBeVisible();
  await expect(ana.page.getByText("Aún no hay gastos en este periodo")).toBeVisible();
  const closedWithData = ana.page.getByRole("link", { name: /0 de 1 pagos hechos/ });
  await expect(closedWithData).toBeVisible();
  await closedWithData.click();
  await expect(ana.page.getByText("Quién le paga a quién")).toBeVisible();
  await expect(ana.page.getByText("S/ 400.00").first()).toBeVisible();

  // Un gasto cerrado no se puede editar.
  await ana.page.getByRole("link", { name: /Supermercado y mercado/ }).click();
  await expect(ana.page.getByText(/pertenece a un periodo cerrado/)).toBeVisible();
  await expect(ana.page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
  await ana.page.goBack();

  // Beto (no propietario) no ve "Reabrir"; marca su pago.
  await beto.page.goto(ana.page.url());
  await expect(beto.page.getByRole("button", { name: "Reabrir periodo" })).toHaveCount(0);
  await beto.page.getByRole("button", { name: "Marcar pagada" }).click();
  await expect(beto.page.getByText("Todo pagado")).toBeVisible();

  // Ana reabre, el gasto vuelve a ser editable, y vuelve a cerrar.
  await ana.page.reload();
  await ana.page.getByRole("button", { name: "Reabrir periodo" }).click();
  await ana.page.getByRole("alertdialog").getByRole("button", { name: "Reabrir" }).click();
  await expect(ana.page.getByText(/Periodo reabierto/).first()).toBeVisible();
  await ana.page.goto(`/grupos/${groupId}`);
  await expect(ana.page.getByText("Periodo reabierto para correcciones")).toBeVisible();
  await expect(ana.page.getByText("Beto te debe S/ 100.00")).toBeVisible();
  await ana.page.getByRole("button", { name: "Volver a cerrar" }).click();
  await expect(ana.page.getByText("Periodo cerrado de nuevo")).toBeVisible();
  await expect(ana.page.getByText("Periodo reabierto para correcciones")).toHaveCount(0);

  // Actividad del grupo legible y en la persona correcta.
  await expect(ana.page.getByText("Creaste el grupo")).toBeVisible();
  await expect(ana.page.getByText("Beto registró S/ 100.00 en Restaurantes")).toBeVisible();

  // Aislamiento: un tercero no ve el grupo ni los gastos.
  const caro = await newUser(browser, "Caro");
  await caro.page.goto(`/grupos/${groupId}`);
  await expect(caro.page.getByText("No encontramos esta página")).toBeVisible();
  const expenseId = sql(`select id from public.expenses where group_id = '${groupId}' limit 1`);
  await caro.page.goto(`/gastos/${expenseId}`);
  await expect(caro.page.getByText("No encontramos esta página")).toBeVisible();

  for (const u of [ana, beto, caro]) await u.context.close();
});
