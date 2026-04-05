import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

// (ELIMINAMOS EL BLOQUE "When('navego a {string}')" QUE ESTABA AQUÍ)

Then('veo el título del ranking', async function () {
  await this.page.waitForSelector('text=Ranking', { timeout: 8_000 });
});

Then('la tabla de clasificación', async function () {
  await this.page.waitForSelector('.ant-table, table', { timeout: 8_000 });
});

Then('veo la tabla de clasificación', async function () {
  await this.page.waitForSelector('.ant-table, table', { timeout: 8_000 });
  const tabla = this.page.locator('.ant-table, table').first();
  assert.ok(await tabla.isVisible());
});

Given('estoy en la página de ranking', async function () {
  await this.page.goto(`${BASE}/ranking`);
  await this.page.waitForSelector('text=Ranking', { timeout: 8_000 });
});

When('cambio el criterio a {string}', async function (criterio) {
  await this.page.click('.ant-select-selector');
  await this.page.click(`.ant-select-item-option:has-text("${criterio}")`);
});

Then('la tabla se actualiza con el nuevo criterio', async function () {
  await this.page.waitForTimeout(1_000);
  const tabla = this.page.locator('.ant-table, table').first();
  assert.ok(await tabla.isVisible());
});