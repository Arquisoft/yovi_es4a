import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function navigateToVariantConfig(page, variantLabel) {
  await page.goto(`${BASE}/home`);
  
  // Si no estamos directamente en la pantalla de selección, pulsamos "Cambiar variante"
  const isSelectScreen = await page.isVisible('text=Elige una variante');
  if (!isSelectScreen) {
    const btn = page.locator('button:has-text("Cambiar variante")').first();
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
    await btn.click();
    await page.waitForSelector('text=Elige una variante', { timeout: 10_000 });
  }

  if (variantLabel && variantLabel !== 'Clásico') {
    await page.click(`.ant-card:has-text("${variantLabel}")`);
    await page.waitForTimeout(200);
  }

  await page.click('[data-testid="variant-confirm-btn"]');
  // Esperar a que cargue la pantalla de configuración HvB/HvH
  await page.waitForSelector('text=Human vs. Bot', { timeout: 12_000 });
}

/**
 * Espera a que el tablero aparezca O a que se muestre un error del backend.
 * En entornos de CI sin backend Rust, la partida no puede crearse y se muestra
 * un <Alert type="error"> en GameShell. En ese caso el test se marca como
 * pendiente/incompleto en lugar de fallar con timeout.
 */
async function waitForBoard(page, timeout = 20_000) {
  // El tablero usa <Button class="hexBtn"> — esperamos tanto el tablero como un error
  const result = await Promise.race([
    page.waitForSelector('.hexBtn', { timeout }).then(() => 'board'),
    page.waitForSelector('.ant-alert-error', { timeout }).then(() => 'error'),
  ]).catch(() => 'timeout');

  if (result === 'error') {
    const msg = await page.locator('.ant-alert-error').first().textContent().catch(() => '');
    throw new Error(
      `El backend de juego no está disponible (se necesita gamey corriendo). ` +
      `Error: ${msg.trim()}. ` +
      `Asegúrate de que el servidor Rust está corriendo en local antes de ejecutar los tests E2E.`
    );
  }

  if (result === 'timeout') {
    throw new Error(
      `Timeout esperando el tablero (.hexBtn). ` +
      `El backend gamey probablemente no está disponible. ` +
      `Levanta el servidor Rust con 'cargo run' antes de ejecutar los tests E2E.`
    );
  }

  // result === 'board' — OK
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
    classic: 'Clásico',
    tabu: 'Tabu Y',
    holey: 'Holey Y',
    pastel: 'Regla del Pastel',
    master: 'Master Y',
    fortune_coin: 'Fortune Y — Moneda',
    fortune_dice: 'Fortune Y — Dado',
    why_not: 'WhY not',
    poly_y: 'Poly-Y',
    hex: 'Hex',
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

// Las opciones de dificultad dependen de los bots que devuelva /api/v1/meta.
// Si el backend no está disponible, Home usa el fallback ["random_bot", "mcts_bot"].
// Con el fallback correcto (ver fix en Home.tsx) debería haber 4 bots.
// El step verifica que al menos "Fácil" (random_bot) sea visible;
// para los demás espera con un timeout más generoso.
Then('veo las opciones {string}, {string}, {string} y {string}', async function (o1, o2, o3, o4) {
  // Primero aseguramos que la pantalla de dificultad está completamente cargada
  await this.page.waitForSelector('text=Selecciona la dificultad', { timeout: 10_000 });

  for (const opcion of [o1, o2, o3, o4]) {
    // Buscamos el texto dentro de las tarjetas de dificultad (Text strong)
    const locator = this.page.locator(`.ant-card:has-text("${opcion}")`).first();
    await locator.waitFor({ state: 'visible', timeout: 8_000 }).catch(async () => {
      // Fallback: buscar por texto suelto en la página
      await this.page.waitForSelector(`text=${opcion}`, { timeout: 3_000 });
    });
    const visible = await this.page.locator(`text=${opcion}`).first().isVisible();
    assert.ok(visible, `No se ve la opción de dificultad "${opcion}"`);
  }
});

When('selecciono la dificultad {string}', async function (label) {
  await this.page.click(`.ant-card:has-text("${label}")`);
});

When('pulso {string}', async function (texto) {
  const button = this.page.getByRole('button', { name: texto }).first();

  if (await button.count()) {
    await button.click();
    return;
  }

  await this.page.locator(`text=${texto}`).first().click();
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
