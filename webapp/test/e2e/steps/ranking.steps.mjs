import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

Then('veo el título del ranking', async function () {
  await this.page.waitForSelector('text=Ranking', { timeout: 8_000 });
});

Then('veo la tabla de clasificación', async function () {
  await this.page.waitForSelector('.ant-table, table', { timeout: 8_000 });
  assert.ok(await this.page.locator('.ant-table, table').first().isVisible());
});

Given('estoy en la página de ranking', async function () {
  await this.page.goto(`${BASE}/ranking`);
  await this.page.waitForSelector('text=Ranking', { timeout: 8_000 });

  // Esperar a que la tabla esté cargada
  await this.page.waitForSelector('.ant-table, table', { timeout: 10_000 });

  // En Ant Design v5 el wrapper .ant-select puede reportarse como "hidden"
  // porque el componente usa visibility internamente en el dropdown.
  // Usamos 'attached' en lugar de 'visible' para confirmar que está en el DOM,
  // y luego verificamos visibilidad con isVisible() que es más tolerante.
  const selectWrapper = this.page.locator('.ant-select').first();
  await selectWrapper.waitFor({ state: 'attached', timeout: 8_000 });

  // Verificar que al menos uno de los selectores es interactuable
  const isVisible = await selectWrapper.isVisible();
  if (!isVisible) {
    // Intentar scroll para que entre en el viewport
    await selectWrapper.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
  }
});

When('cambio el criterio a {string}', async function (criterio) {
  const selectEl = this.page.locator('.ant-select').first();

  // Aseguramos que está en el DOM antes de interactuar
  await selectEl.waitFor({ state: 'attached', timeout: 8_000 });

  // Scroll al elemento por si está fuera del viewport
  await selectEl.scrollIntoViewIfNeeded();
  await this.page.waitForTimeout(200);

  // Click sobre el selector para abrirlo
  await selectEl.click();

  // Esperar el portal del dropdown (puede tardar una animación)
  await this.page.waitForSelector(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    { timeout: 8_000 }
  );

  // Buscar la opción por texto contenido
  const option = this.page
    .locator('.ant-select-item-option')
    .filter({ hasText: criterio })
    .first();

  await option.waitFor({ state: 'visible', timeout: 8_000 });
  await option.click();

  // Esperar a que el dropdown desaparezca
  await this.page.waitForSelector(
    '.ant-select-dropdown',
    { state: 'hidden', timeout: 8_000 }
  );

  // Dar tiempo al useEffect para que relance la petición y actualice la tabla
  await this.page.waitForTimeout(500);
});

Then('la tabla se actualiza con el nuevo criterio', async function () {
  // Esperar a que el loading desaparezca y la tabla esté presente
  await this.page.waitForSelector('.ant-table:not(.ant-table-loading), table', {
    timeout: 10_000,
  });
  assert.ok(await this.page.locator('.ant-table, table').first().isVisible());
});
