import { When, Then } from '@cucumber/cucumber';
import assert from 'assert';

When('introduzco usuario {string} y contraseña {string}', async function (user, pass) {
  await this.page.fill('#login_form_username', user);
  await this.page.fill('#login_form_password', pass);
});

When('pulso iniciar sesión', async function () {
  await this.page.click('button[type="submit"]');
});

Then('soy redirigido a {string}', async function (ruta) {
  await this.page.waitForURL(`**${ruta}`, { timeout: 8_000 });
  assert.ok(this.page.url().includes(ruta), `URL esperada ${ruta}, actual: ${this.page.url()}`);
});

Then('veo un mensaje de error de login', async function () {
  const locator = this.page.locator('.ant-message-error');
  await locator.first().waitFor({ state: 'visible', timeout: 6_000 });
  assert.ok(await locator.first().isVisible());
});