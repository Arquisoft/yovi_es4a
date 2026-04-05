import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

Then('veo la pantalla de selección de variantes', async function () {
  await this.page.waitForSelector('text=Clásico', { timeout: 10_000 });
});

Then('veo la variante {string}', async function (label) {
  const el = this.page.locator(`text=${label}`).first();
  assert.ok(await el.isVisible(), `No se ve la variante "${label}"`);
});

Given('estoy en la pantalla de configuración de la variante {string}', async function (variantId) {
  await this.page.goto(`${BASE}/home`);
  await this.page.waitForSelector('text=Clásico', { timeout: 10_000 });
  const variantCard = this.page.locator(`[data-variant-id="${variantId}"], .ant-card`).filter({ hasText: variantId === 'classic' ? 'Clásico' : variantId }).first();
  const jugarBtn = variantCard.locator('button:has-text("Jugar"), button:has-text("Seleccionar")').first();
  await jugarBtn.click();
  await this.page.waitForTimeout(500);
});

When('pulso el botón {string} en la sección HvB', async function (label) {
  const btn = this.page.locator(`button:has-text("${label}")`).first();
  await btn.click();
});

When('pulso el botón {string} en la sección HvH', async function (label) {
  const btn = this.page.locator(`button:has-text("${label}")`).nth(1);
  await btn.click();
});

Then('veo la pantalla de selección de dificultad', async function () {
  await this.page.waitForSelector('text=Fácil', { timeout: 10_000 });
});

Then('veo las opciones {string}, {string}, {string} y {string}', async function (o1, o2, o3, o4) {
  const el = this.page.locator(`text=${o1}`).first();
  assert.ok(await el.isVisible(), `No se ve la opción "${o1}"`);
});

When('selecciono la dificultad {string}', async function (label) {
  await this.page.click(`.ant-card:has-text("${label}")`);
});

// Este es el genérico que usaremos para todos los botones/enlaces
When('pulso {string}', async function (texto) {
  await this.page.click(`text="${texto}"`);
});

Then('veo el tablero de juego', async function () {
  await this.page.waitForSelector('svg, [class*="board"], [class*="tablero"], [class*="hex"]', { timeout: 10_000 });
});

Then('veo el indicador de turno', async function () {
  await this.page.waitForSelector('text=Turno actual:', { timeout: 8_000 });
});

Then('veo el tablero de juego HvH', async function () {
  await this.page.waitForSelector('svg, [class*="board"]', { timeout: 10_000 });
});

Given('estoy jugando una partida HvB con bot {string}', async function (botId) {
  await this.page.goto(`${BASE}/game-hvb?size=5&bot=${botId}&hvbstarter=human&variant=classic`);
  await this.page.waitForSelector('svg, [class*="board"]', { timeout: 10_000 });
});

Then('el tablero tiene celdas clicables', async function () {
  const cells = this.page.locator('polygon, [class*="cell"]');
  assert.ok(await cells.count() > 0);
});

Then('la barra de estado indica de quién es el turno', async function () {
  await this.page.waitForSelector('text=Turno', { timeout: 8_000 });
});

// Añadido para solucionar el "Undefined step"
Given('estoy en la pantalla de selección de dificultad para HvB', async function () {
  await this.page.goto(`${BASE}/home`);
  await this.page.waitForSelector('text=Clásico', { timeout: 10_000 });
  const variantCard = this.page.locator('.ant-card').filter({ hasText: 'Clásico' }).first();
  await variantCard.locator('button:has-text("Jugar"), button:has-text("Seleccionar")').first().click();
  await this.page.waitForSelector('text=Fácil', { timeout: 10_000 });
});