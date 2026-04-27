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

  // Detectar qué control de ordenación está visible (Segmented en desk, Select en movil)
  const segmented = this.page.locator('.ant-segmented').first();
  const select = this.page.locator('.ant-select').first();

  const isSegmented = await segmented.isVisible();
  const isSelect = await select.isVisible();

  assert.ok(isSegmented || isSelect, 'No se encontró ningún control de ordenación (Segmented o Select)');
});

When('cambio el criterio a {string}', async function (criterio) {
  // Intentar primero con Segmented (Escritorio)
  const segmentedOption = this.page.locator('.ant-segmented-item').filter({ hasText: criterio }).first();
  
  if (await segmentedOption.isVisible()) {
    await segmentedOption.click();
  } else {
    // Si no es visible, intentar con Select (Móvil)
    const selectEl = this.page.locator('.ant-select').first();
    await selectEl.waitFor({ state: 'attached', timeout: 8_000 });
    await selectEl.scrollIntoViewIfNeeded();
    await selectEl.click();

    // Esperar el portal del dropdown
    await this.page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 8_000 });

    const option = this.page.locator('.ant-select-item-option').filter({ hasText: criterio }).first();
    await option.waitFor({ state: 'visible', timeout: 8_000 });
    await option.click();

    // Esperar a que el dropdown desaparezca
    await this.page.waitForSelector('.ant-select-dropdown', { state: 'hidden', timeout: 8_000 });
  }

  // Dar tiempo al useEffect para que relance la petición y actualice la tabla
  await this.page.waitForTimeout(1000);
});

Then('la tabla se actualiza con el nuevo criterio', async function () {
  // Esperar a que el loading desaparezca y la tabla esté presente
  await this.page.waitForSelector('.ant-table:not(.ant-table-loading), table', {
    timeout: 10_000,
  });
  assert.ok(await this.page.locator('.ant-table, table').first().isVisible());
});
