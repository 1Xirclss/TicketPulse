import { test, expect } from '@playwright/test';
import { credentials, eventName, emptyEventName } from '../scripts/e2e-fixtures.mjs';

async function settleDashboard(page) {
  await page.locator('.activity-panel').scrollIntoViewIfNeeded();
  await expect(page.locator('.activity-panel')).toHaveCSS('opacity', '1');
  await page.locator('.event-banner').scrollIntoViewIfNeeded();
  await expect(page.locator('.event-banner')).toHaveCSS('opacity', '1');
  await expect(page.locator('.kpi-card').first()).toHaveCSS('opacity', '1');
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(credentials.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'El pulso de tu evento.' })).toBeVisible();
});
test('dashboard obtiene importes reales, cambia de evento y muestra estados vacíos', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByRole('heading', { name: eventName })).toBeVisible();
  await expect(page.locator('.kpi-card').first()).toContainText('$40.00');
  await expect(page.getByText('Entrada general', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.locator('.chart-legend button').first().focus();
  await expect(page.locator('.donut-center')).toContainText('$30.00');
  await page.locator('.refresh-button').focus();
  await settleDashboard(page);
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.getByLabel('Evento seleccionado').selectOption({ label: emptyEventName });
  await expect(page.getByRole('heading', { name: emptyEventName })).toBeVisible();
  await expect(page.locator('.kpi-card').first()).toContainText('$0.00');
  await expect(page.getByText('No hay tarifas activas', { exact: true })).toBeVisible();
  await expect(page.getByText('Aún no hay ventas registradas para este evento.')).toBeVisible();
  expect(errors).toEqual([]);
});
test('Admin modifica evento, persiste al recargar y no hay edición de tarifas o cuenta bancaria', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByText('Datos del evento').click();
  await expect(page.getByLabel('Nombre del evento')).toHaveValue(eventName);
  await expect(page.getByText(/cuenta bancaria/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /tarifa/i })).toHaveCount(0);
  await page.getByLabel('Aforo máximo').fill('650');
  await page.getByRole('button', { name: 'Guardar evento' }).click();
  await expect(page.getByRole('status')).toHaveText('Los datos del evento se guardaron correctamente.');
  await page.reload();
  await expect(page.getByLabel('Aforo máximo')).toHaveValue('650');
  await page.screenshot({ path: 'test-results/event-settings-desktop.png', fullPage: true });
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByText('Dashboard').click();
  await expect(page.locator('.kpi-card').last()).toContainText('/ 650');
});
test('dashboard y formulario son utilizables en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'El pulso de tu evento.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await settleDashboard(page);
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByText('Evento', { exact: true }).click();
  await expect(page.getByLabel('Nombre del evento')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/event-settings-mobile.png', fullPage: true });
});

test('crear un evento no crea tarifas ni ventas', async ({ page }) => {
  await page.goto('/evento');
  await page.getByRole('button', { name: 'Nuevo evento', exact: true }).click();
  await page.getByLabel('Nombre del evento').fill('Evento creado desde la interfaz');
  await page.getByLabel('Fecha').fill('2026-10-25');
  await page.getByLabel('Hora de inicio').fill('19:30');
  await page.getByLabel('Zona horaria').fill('America/El_Salvador');
  await page.getByLabel('Lugar / venue').fill('Recinto de la prueba');
  await page.getByLabel('Dirección').fill('Dirección del recinto');
  await page.getByLabel('Aforo máximo').fill('100');
  await page.getByRole('button', { name: 'Guardar evento' }).click();
  await expect(page.getByLabel('Evento seleccionado').locator('option:checked')).toHaveText('Evento creado desde la interfaz · Inactivo');
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByText('Dashboard').click();
  await expect(page.getByRole('heading', { name: 'Evento creado desde la interfaz' })).toBeVisible();
  await expect(page.getByText('No hay tarifas activas', { exact: true })).toBeVisible();
  await expect(page.locator('.kpi-card').first()).toContainText('$0.00');
});
