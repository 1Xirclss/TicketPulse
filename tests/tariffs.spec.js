import { test, expect } from '@playwright/test';
import { credentials } from '../scripts/e2e-fixtures.mjs';

test('gestión completa de tarifas y categorías desde la web', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // 1. Iniciar sesión como Admin
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(credentials.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // 2. Verificar carga de Dashboard
  await expect(page.getByRole('heading', { name: 'El pulso de tu evento.' })).toBeVisible();

  // 3. Ubicar panel de tarifas y botón Gestionar
  const tariffsPanel = page.locator('.tariffs-panel');
  await expect(tariffsPanel).toBeVisible();
  const manageBtn = tariffsPanel.locator('.manage-tariffs-btn');
  await expect(manageBtn).toBeVisible();
  await expect(manageBtn).toContainText('Gestionar');

  // 4. Abrir modal de gestión
  await manageBtn.click();
  const dialog = page.locator('.tariff-manager-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Gestión de Tarifas y Categorías' })).toBeVisible();

  // Captura del modal inicial
  await page.screenshot({ path: 'test-results/tariff-modal-desktop.png' });

  // 5. Crear una nueva tarifa con categoría personalizada "VIP"
  await dialog.getByLabel('Nombre de Tarifa').fill('VIP Backstage Access');
  await dialog.getByLabel('Categoría').selectOption('__NEW__');
  
  const customCatInput = dialog.getByLabel('Nombre de la Nueva Categoría');
  await expect(customCatInput).toBeVisible();
  await customCatInput.fill('VIP');

  await dialog.getByLabel('Etapa de Venta').selectOption('Preventa');
  await dialog.getByLabel('Precio en USD ($)').fill('50.00');

  await dialog.getByRole('button', { name: /Crear Tarifa/i }).click();

  // Verificar aviso de éxito y fila en la tabla de tarifas
  await expect(dialog.locator('.alert.success')).toContainText('creada correctamente.');
  await expect(dialog.locator('.tariff-table')).toContainText('VIP Backstage Access');
  await expect(dialog.locator('.tariff-table')).toContainText('VIP');
  await expect(dialog.locator('.tariff-table')).toContainText('$50.00');

  // Captura con la tarifa agregada
  await page.screenshot({ path: 'test-results/tariff-added-success.png' });

  // 5b. Probar MODIFICACIÓN / EDICIÓN de una tarifa existente (como Promo o VIP)
  const editBtn = dialog.locator('.tariff-table tr', { hasText: 'Promo' }).getByRole('button', { name: /Editar/i }).first();
  if (await editBtn.count() > 0) {
    await editBtn.click();
    await expect(dialog.getByRole('heading', { name: 'Modificar Tarifa' })).toBeVisible();
    await dialog.getByLabel('Precio en USD ($)').fill('18.00');
    await dialog.getByRole('button', { name: /Guardar Cambios/i }).click();

    // Comprobar que no hay error de identificador y que el éxito se muestra
    await expect(dialog.locator('.alert.error')).toHaveCount(0);
    await expect(dialog.locator('.alert.success')).toContainText('actualizada correctamente.');
    await expect(dialog.locator('.tariff-table tr', { hasText: 'Promo' })).toContainText('$18.00');
    await page.screenshot({ path: 'test-results/tariff-edited-success.png' });
  }

  // 6. Cambiar a la pestaña "Categorías del Evento"
  const catTab = dialog.getByRole('tab', { name: /Categorías del Evento/i });
  await catTab.click();
  await expect(dialog.locator('.category-list-section')).toBeVisible();
  await expect(dialog.locator('.category-items-grid')).toContainText('VIP');

  // Agregar categoría adicional "Estudiante"
  const newCatInput = dialog.locator('.category-add-row input');
  await newCatInput.fill('Estudiante');
  await dialog.locator('.category-add-row button').click();

  await expect(dialog.locator('.alert.success')).toContainText('creada con su tarifa correspondiente.');
  await expect(dialog.locator('.category-items-grid')).toContainText('Estudiante');

  // Captura de la pestaña de categorías
  await page.screenshot({ path: 'test-results/categories-tab-desktop.png' });

  // 7. Cerrar modal
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  // 8. Navegar a /ventas y verificar los nuevos filter chips
  await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByText('Ventas y asistentes').click();
  await expect(page.getByRole('heading', { name: 'Cada entrada cuenta.' })).toBeVisible();

  // Verificar que los botones de categoría ahora incluyen VIP y Estudiante
  const categoryFilters = page.locator('.sales-filters div[role="group"][aria-label="Filtrar por categoría"]');
  await expect(categoryFilters).toBeVisible();
  await expect(categoryFilters.getByRole('button', { name: 'VIP' })).toBeVisible();
  await expect(categoryFilters.getByRole('button', { name: 'Estudiante' })).toBeVisible();

  // Filtrar por la nueva categoría "VIP"
  await categoryFilters.getByRole('button', { name: 'VIP' }).click();
  await expect(categoryFilters.getByRole('button', { name: 'VIP' })).toHaveAttribute('aria-pressed', 'true');

  // Captura de pantalla de la página de ventas con las nuevas categorías
  await page.screenshot({ path: 'test-results/sales-new-categories.png' });

  expect(errors).toEqual([]);
});
