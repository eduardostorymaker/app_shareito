import { expect, test } from "@playwright/test";
import { addExpense, signUp, uniqueEmail } from "./helpers";

test("ocultar categorías del sistema: formulario, gastos antiguos, panel y restablecer", async ({ page }) => {
  await signUp(page, "Eva Categorías", uniqueEmail("eva"));
  // Gasto previo en una categoría que luego se ocultará.
  await addExpense(page, "30", "Restaurantes", { description: "Almuerzo" });

  // Ajustes → Categorías: oculta Alimentación entera y solo "Bares y vida nocturna" de Ocio.
  await page.goto("/ajustes/categorias");
  await expect(page.getByText("Ves todas las categorías al registrar un gasto.")).toBeVisible();
  await page.getByRole("switch", { name: "Ocultar Alimentación" }).click();
  await expect(page.getByText("6 subcategorías ocultas en tu formulario.")).toBeVisible();
  await page.getByRole("button", { name: /Ocio y entretenimiento/ }).click();
  await page.getByRole("switch", { name: "Ocultar Bares y vida nocturna" }).click();
  await expect(page.getByText("7 subcategorías ocultas en tu formulario.")).toBeVisible();
  await expect(page.getByText("5 de 6 visibles")).toBeVisible();

  // "Sin categoría" no se puede ocultar.
  await page.getByRole("button", { name: /^Otros/ }).click();
  await expect(page.getByRole("switch", { name: /Sin categoría/ })).toBeDisabled();

  // Persiste al recargar.
  await page.reload();
  await expect(page.getByText("7 subcategorías ocultas en tu formulario.")).toBeVisible();

  // El formulario ya no las ofrece.
  await page.goto("/");
  await page.getByRole("button", { name: "Nuevo gasto" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Restaurantes", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: /Ver todas/ }).click();
  await expect(dialog.getByRole("button", { name: /Transporte/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Alimentación/ })).toHaveCount(0);
  const search = dialog.getByLabel("Buscar categoría");
  await search.fill("Restaurantes");
  await expect(dialog.getByText(/Ninguna categoría coincide/)).toBeVisible();
  await search.fill("Bares");
  await expect(dialog.getByText(/Ninguna categoría coincide/)).toBeVisible();
  await search.fill("Sin categ");
  await expect(dialog.getByRole("button", { name: /Sin categoría/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // El gasto antiguo se sigue viendo y, al editarlo, conserva su categoría marcada como oculta.
  await page.getByRole("link", { name: /Almuerzo/ }).click();
  await page.waitForURL("**/gastos/*");
  await expect(page.getByText("Restaurantes").first()).toBeVisible();
  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("dialog").getByText("Oculta para ti")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados").first()).toBeVisible();

  // El panel lo sigue contando.
  await page.goto("/panel");
  await expect(page.locator("section[aria-label=Indicadores]").getByText("S/ 30.00")).toBeVisible();
  await expect(page.getByRole("link", { name: /Alimentación/ })).toBeVisible();

  // Mostrar todas: vuelven al formulario.
  await page.goto("/ajustes/categorias");
  await page.getByRole("button", { name: "Mostrar todas" }).click();
  await expect(page.getByText("Ves todas las categorías al registrar un gasto.")).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Nuevo gasto" }).first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Restaurantes", exact: true })).toBeVisible();
});
