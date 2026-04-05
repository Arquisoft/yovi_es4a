import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function navigateToVariantConfig(page, variantLabel) {
  await page.goto(`${BASE}/home`);
  await page.waitForSelector('text=Elige una variante', { timeout: 15_000 });

  if (variantLabel && variantLabel !== 'Clásico') {
    await page.click(`.ant-card:has-text("${variantLabel}")`);
    await page.waitForTimeout(200);
  }

  await page.click('[data-testid="variant-confirm-btn"]');
  await page.waitForSelector('text=Human vs. Bot', { timeout: 10_000 });
}

async function waitForBoard(page, timeout = 20_000) {
  // El tablero usa <Button class="hexBtn"> — no SVG ni polygon
  await page.waitForSelector('.hexBtn', { timeout });
}

// ─── Steps ────────────────────────────────────────────────────────────────────

Then('veo la pantalla de selección de variantes', async function () {
  await this.page.waitForSelector('text=Elige una variante', { timeout: 10_000 });
});

Then('veo la variante {string}', async function (label) {
  const el = this.page.locator(`text=${label}`).first();
  assert.ok(await el.isVisible(), `No se ve la variante "${label}"`);
});

Given('estoy en la pantalla de configuración de la variante {string}', async function (variantId) {
  const LABEL_MAP = {
    classic:      'Clásico',
    tabu:         'Tabu Y',
    holey:        'Holey Y',
    pastel:       'Regla del Pastel',
    master:       'Master Y',
    fortune_coin: 'Fortune Y — Moneda',
    fortune_dice: 'Fortune Y — Dado',
    why_not:      'WhY not',
    poly_y:       'Poly-Y',
    hex:          'Hex',
  };
  await navigateToVariantConfig(this.page, LABEL_MAP[variantId] ?? variantId);
});

When('pulso el botón {string} en la sección HvB', async function (label) {
  await this.page.locator(`button:has-text("${label}")`).first().click();
});

When('pulso el botón {string} en la sección HvH', async function (label) {
  await this.page.locator(`button:has-text("${label}")`).nth(1).click();
});

Then('veo la pantalla de selección de dificultad', async function () {
  await this.page.waitForSelector('text=Selecciona la dificultad', { timeout: 10_000 });
});

// FIX: el step tiene 4 parámetros en Gherkin — la función debe declararlos todos
Then('veo las opciones {string}, {string}, {string} y {string}', async function (o1, o2, o3, o4) {
  for (const opcion of [o1, o2, o3, o4]) {
    await this.page.waitForSelector(`text=${opcion}`, { timeout: 8_000 });
    assert.ok(
      await this.page.locator(`text=${opcion}`).first().isVisible(),
      `No se ve la opción "${opcion}"`
    );
  }
});

When('selecciono la dificultad {string}', async function (label) {
  await this.page.click(`.ant-card:has-text("${label}")`);
});

When('pulso {string}', async function (texto) {
  await this.page.click(`text="${texto}"`);
});

Then('veo el tablero de juego', async function () {
  await waitForBoard(this.page);
});

Then('veo el indicador de turno', async function () {
  await this.page.waitForSelector('text=Turno', { timeout: 10_000 });
});

Then('veo el tablero de juego HvH', async function () {
  await waitForBoard(this.page);
});

Given('estoy jugando una partida HvB con bot {string}', async function (botId) {
  await this.page.goto(`${BASE}/game-hvb?size=5&bot=${botId}&hvbstarter=human&variant=classic`);
  await waitForBoard(this.page);
});

Then('el tablero tiene celdas clicables', async function () {
  await this.page.waitForSelector('.hexBtn', { timeout: 8_000 });
  const cells = this.page.locator('.hexBtn');
  assert.ok(await cells.count() > 0, 'No se encontraron celdas en el tablero');
});

Then('la barra de estado indica de quién es el turno', async function () {
  await this.page.waitForSelector('text=Turno', { timeout: 8_000 });
});

Given('estoy en la pantalla de selección de dificultad para HvB', async function () {
  await navigateToVariantConfig(this.page, 'Clásico');
  await this.page.locator('button:has-text("Jugar")').first().click();
  await this.page.waitForSelector('text=Selecciona la dificultad', { timeout: 10_000 });
});
