import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

Given('no hay sesión activa', async function () {
  await this.page.goto(BASE);
  await this.page.evaluate(() => localStorage.removeItem('yovi_session'));
});

When('navego a {string}', async function (ruta) {
  await this.page.goto(`${BASE}${ruta}`);
});

Then('soy redirigido a la página de inicio', async function () {
  await this.page.waitForSelector('text=Bienvenido a YOVI', { timeout: 8_000 });
  assert.ok(this.page.url().includes('localhost:5173'));
});

Given('tengo una sesión activa con usuario {string}', async function (username) {
  await this.page.goto(BASE);
  // Inyectar sesión directamente en localStorage como hace la app
  await this.page.evaluate((u) => {
    localStorage.setItem('yovi_session', JSON.stringify({ username: u, profilePicture: 'seniora.png' }));
  }, username);
});

Then('veo la página de historial de partidas', async function () {
  await this.page.waitForSelector('text=Historial', { timeout: 8_000 });
});

Then('veo las estadísticas del usuario', async function () {
  // UserStats muestra gamesPlayed, gamesWon, etc.
  const stats = this.page.locator('[class*="stat"], text=Partidas, text=jugadas').first();
  await stats.waitFor({ state: 'visible', timeout: 8_000 });
  assert.ok(await stats.isVisible());
});