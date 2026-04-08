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
  // Ant Design v5 puede usar diferentes clases para mensajes flotantes:
  //   - .ant-message-error  (v4 y algunos builds de v5)
  //   - .ant-message-notice-content (v5, el contenedor del texto)
  //   - [class*="message"][class*="error"] (selector tolerante)
  //
  // También aceptamos un Alert estático con type="error" por si el componente
  // usa ese mecanismo en lugar del message flotante.
  const SELECTORS = [
    '.ant-message-error',
    '.ant-message-notice-content',        // v5: contenedor del mensaje flotante
    '[class*="ant-message"][class*="error"]',
    '.ant-alert-error',
  ].join(', ');

  const locator = this.page.locator(SELECTORS);

  // Esperamos hasta 8s a que cualquiera de los selectores sea visible
  await locator.first().waitFor({ state: 'visible', timeout: 8_000 });
  assert.ok(await locator.first().isVisible(), 'No se ve ningún mensaje de error de login');
});
