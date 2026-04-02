import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

Given('estoy en la página de inicio', async function () {
  await this.page.goto(BASE);
  await this.page.waitForSelector('text=Bienvenido a YOVI', { timeout: 10_000 });
});

Then('veo el título {string}', async function (titulo) {
  await this.page.waitForSelector(`text=${titulo}`);
  const el = await this.page.locator(`text=${titulo}`).first();
  assert.ok(await el.isVisible(), `No se ve el título "${titulo}"`);
});

Then('veo las pestañas {string} y {string}', async function (tab1, tab2) {
  await this.page.waitForSelector(`[role="tab"]:has-text("${tab1}")`);
  await this.page.waitForSelector(`[role="tab"]:has-text("${tab2}")`);
});

When('cambio a la pestaña {string}', async function (label) {
  await this.page.click(`[role="tab"]:has-text("${label}")`);
  await this.page.waitForTimeout(300);
});

When('relleno el registro con username {string}, email {string} y contraseña {string}',
  async function (username, email, password) {
    // Antd Form con name="register_form" — los inputs tienen id por el name del campo
    await this.page.fill('#register_form_email', email);
    await this.page.fill('#register_form_username', username);
    await this.page.fill('#register_form_password', password);
    await this.page.fill('#register_form_confirmPassword', password);
  }
);

When('envío el formulario de registro', async function () {
  await this.page.click('button[type="submit"]');
});

Then('veo un mensaje de éxito que contiene {string}', async function (texto) {
  // Antd Alert de tipo success o antd message
  const locator = this.page.locator('.ant-alert-success, .ant-message-success');
  await locator.first().waitFor({ state: 'visible', timeout: 8_000 });
  const content = await locator.first().textContent();
  assert.ok(content?.includes(texto), `Esperaba "${texto}" en el mensaje de éxito, recibí: "${content}"`);
});

Then('veo un mensaje de error en el formulario', async function () {
  // Puede ser un Alert de error o un antd message error
  const locator = this.page.locator('.ant-alert-error, .ant-message-error, .ant-form-item-explain-error');
  await locator.first().waitFor({ state: 'visible', timeout: 8_000 });
  assert.ok(await locator.first().isVisible(), 'No se ve ningún mensaje de error');
});