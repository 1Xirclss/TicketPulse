import { test, expect } from '@playwright/test';
import { credentials, eventName } from '../scripts/e2e-fixtures.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(credentials.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'El pulso de tu evento.' })).toBeVisible();

  // Navegar a Control en Puerta
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByText('Control en puerta').click();
  await expect(page.getByRole('heading', { name: 'Control en Puerta' })).toBeVisible();
});

test('módulo de puerta muestra aforómetro en tiempo real y componentes operativos', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Verificar aforómetro y KPIs
  await expect(page.locator('.gate-attendance-meter')).toBeVisible();
  await expect(page.locator('.meter-caption')).toContainText('AFORO TOTAL OCUPADO');
  await expect(page.locator('.meter-stat-card', { hasText: 'Ingresados' })).toBeVisible();
  await expect(page.locator('.meter-stat-card', { hasText: 'Pendientes' })).toBeVisible();
  await expect(page.locator('.meter-stat-card', { hasText: 'Pulseras' })).toBeVisible();
  await expect(page.locator('.meter-stat-card', { hasText: 'Aforo máx.' })).toBeVisible();

  // Verificar pestañas operativas
  await expect(page.getByRole('tab', { name: 'Escanear con Cámara' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Búsqueda Manual / Sin QR' })).toBeVisible();

  // Pestaña de cámara por defecto
  await expect(page.locator('.gate-scanner-box')).toBeVisible();
  await expect(page.locator('.idle-title')).toContainText('Cámara en espera');

  // Captura de pantalla de la interfaz de puerta en escritorio
  await page.screenshot({ path: 'test-results/gate-desktop.png', fullPage: true });

  expect(errors).toEqual([]);
});

test('flujo completo de ingreso manual sin QR, validación atómica y detección de duplicado', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Cambiar a la pestaña de Búsqueda Manual / Sin QR
  await page.getByRole('tab', { name: 'Búsqueda Manual / Sin QR' }).click();
  await expect(page.locator('.gate-manual-search-box')).toBeVisible();
  await expect(page.getByPlaceholder('Nombre, teléfono, colegio o código de boleto…')).toBeVisible();

  // Buscar un asistente de prueba
  const searchInput = page.getByPlaceholder('Nombre, teléfono, colegio o código de boleto…');
  await searchInput.fill('Transferencia');

  // Esperar resultados
  await expect(page.locator('.manual-result-card')).toBeVisible();

  // Obtener código de boleto del primer resultado
  const ticketCode = (await page.locator('.result-ticket-code').first().textContent()).trim();
  expect(ticketCode).toBe('NX222222222222222222222222');

  // Alternar entrega de pulsera manualmente
  const wristbandBtn = page.locator('.wristband-toggle-button').first();
  await wristbandBtn.click();
  await expect(wristbandBtn).toHaveClass(/delivered/);

  // Marcar ingreso del asistente
  const admitButton = page.locator('.gate-admit-button').first();
  await admitButton.click();

  // Verificar tarjeta gigante de resultado: PERMITIDO o ya ingresado si se reintenta
  const resultBanner = page.locator('.gate-result-banner');
  await expect(resultBanner).toBeVisible();

  const isSuccess = await resultBanner.locator('h2').textContent();
  if (isSuccess.includes('ACCESO PERMITIDO')) {
    await expect(resultBanner).toHaveClass(/result-success/);
    await expect(resultBanner).toContainText('Entregar pulsera');
    await page.screenshot({ path: 'test-results/gate-admitted.png', fullPage: true });

    // Segundo escaneo / validación inmediata para probar idempotencia (rechazo de duplicado)
    await searchInput.fill(ticketCode);
    await searchInput.press('Enter');

    // Debe mostrar ACCESO DENEGADO con advertencia de reingreso
    await expect(page.locator('.gate-result-banner.result-error')).toBeVisible();
    await expect(page.locator('.gate-result-banner.result-error h2')).toContainText('ACCESO DENEGADO');
    await expect(page.locator('.result-duplicate-warning')).toBeVisible();
    await page.screenshot({ path: 'test-results/gate-duplicate-rejected.png', fullPage: true });
  } else {
    // Si ya había ingresado previamente en pruebas anteriores, debe mostrar el aviso de duplicado
    await expect(resultBanner).toHaveClass(/result-error/);
    await expect(resultBanner.locator('h2')).toContainText('ACCESO DENEGADO');
    await expect(page.locator('.result-duplicate-warning')).toBeVisible();
  }

  expect(errors).toEqual([]);
});

test('interfaz de puerta responsive optimizada para móvil y tableta', async ({ page }) => {
  // Simular iPhone 14 Pro
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/puerta');

  await expect(page.getByRole('heading', { name: 'Control en Puerta' })).toBeVisible();
  await expect(page.locator('.gate-attendance-meter')).toBeVisible();
  await expect(page.locator('.meter-stats-grid')).toBeVisible();

  // Navegar a manual en móvil
  await page.getByRole('tab', { name: 'Búsqueda Manual / Sin QR' }).click();
  await expect(page.locator('.gate-search-field')).toBeVisible();

  await page.screenshot({ path: 'test-results/gate-mobile.png', fullPage: true });
});
