import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

When('navego al Lobby de Multijugador', async function () {
  await this.page.goto(`${BASE}/multiplayer`);
  await this.page.waitForSelector('text=Unirse a Sala', { timeout: 8_000 });
});

When('selecciono el modo de juego y guardo la sala', async function () {
  await this.page.click('button:has-text("Generar Código")');
});

Then('veo el panel de espera con el código generado', async function () {
  await this.page.waitForSelector('text=Esperando a tu rival...', { timeout: 10_000 });
  const cancelButton = this.page.locator('button:has-text("Cancelar sala")');
  assert.ok(await cancelButton.isVisible());
});

When('introduzco el código {string} y pulso entrar', async function (code) {
  // Input con "Ej: A4F92" placeholder
  const input = this.page.getByPlaceholder('Ej: A4F92').first();
  await input.fill(code);
  await this.page.click('button:has-text("Entrar a la partida")');
});

Then('debería ver un mensaje de error de sala no encontrada', async function () {
  const SELECTORS = ['.ant-message-error', '.ant-message-notice-content', '[class*="ant-message"][class*="error"]'];
  const locator = this.page.locator(SELECTORS.join(', '));
  await locator.first().waitFor({ state: 'visible', timeout: 8_000 });
  assert.ok(await locator.first().isVisible());
});
