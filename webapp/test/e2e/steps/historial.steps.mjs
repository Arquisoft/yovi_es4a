import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

// La clave real que usa la app en localStorage (ver webapp/src/utils/session.ts)
const SESSION_KEY = 'userSession';

Given('no hay sesión activa', async function () {
  await this.page.goto(BASE);
  await this.page.evaluate((key) => localStorage.removeItem(key), SESSION_KEY);
});

When('navego a {string}', async function (ruta) {
  await this.page.goto(`${BASE}${ruta}`);
});

Then('soy redirigido a la página de inicio', async function () {
  // Esperar a que aparezca el texto de bienvenida (la app redirige a "/" con <Navigate>)
  await this.page.waitForSelector('text=Bienvenido a YOVI', { timeout: 8_000 });

  // Verificar la URL usando BASE (no hardcodear localhost:5173)
  const url = this.page.url();
  // La URL puede ser "/" o "/index.html" — lo importante es que no sea "/historial"
  assert.ok(!url.includes('/historial'), `Esperaba salir de /historial, URL actual: ${url}`);
});

Given('tengo una sesión activa con usuario {string}', async function (username) {
  // Navegar primero para tener el contexto de la página cargado
  await this.page.goto(BASE);

  // Inyectar la sesión con la clave correcta que usa la app
  await this.page.evaluate(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
  }, { key: SESSION_KEY, session: { username, profilePicture: 'seniora.png' } });
});

Then('veo la página de historial de partidas', async function () {
  // El componente UserHistory renderiza el título "Historial de partidas"
  await this.page.waitForSelector('text=Historial', { timeout: 10_000 });
});

Then('veo las estadísticas del usuario', async function () {
  // UserStats muestra tarjetas con datos del usuario
  // Buscar cualquier elemento visible relacionado con estadísticas
  const stats = this.page.locator('[class*="stat"], .ant-statistic, .ant-card').first();
  await stats.waitFor({ state: 'visible', timeout: 8_000 });
  assert.ok(await stats.isVisible(), 'No se ven las estadísticas del usuario');
});
