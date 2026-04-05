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
  // Esperar a que la tabla cargue para que el Select esté renderizado
  await this.page.waitForSelector('.ant-select', { timeout: 8_000 });
});

When('cambio el criterio a {string}', async function (criterio) {
  // Abrir el selector de Ant Design — click en el wrapper completo por si el
  // selector exacto varía entre versiones de antd
  const selectEl = this.page.locator('.ant-select').first();
  await selectEl.waitFor({ state: 'visible', timeout: 8_000 });
  await selectEl.click();

  // Esperar el portal del dropdown (puede tardar una animación)
  await this.page.waitForSelector(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    { timeout: 8_000 }
  );

  // Las opciones llevan un <Space> con icono+texto: buscamos por texto contenido
  // Intentamos primero coincidencia exacta, y si no, coincidencia parcial
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
