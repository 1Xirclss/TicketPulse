import { test, expect } from '@playwright/test';

test('TicketPulse y Pulse funcionan en móvil y respetan movimiento reducido', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  await page.goto('/login');
  await expect(page).toHaveTitle(/TicketPulse/);
  await expect(page.locator('.mobile-brand').getByRole('link', { name: 'TicketPulse, inicio' })).toBeVisible();
  await page.locator('.mobile-mascot').getByRole('button', { name: 'Saludar a Pulse, la mascota de TicketPulse' }).click();
  await expect(page.locator('.mobile-mascot canvas')).toBeVisible();
  await expect(page.locator('.mobile-mascot .scene')).toHaveAttribute('data-rendered', 'true');
  await page.screenshot({ path: 'test-results/ticketpulse-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.mobile-mascot canvas')).toHaveCount(0);
  await expect(page.locator('.mobile-mascot .mascot-fallback')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.experience canvas')).toBeVisible();
  await expect(page.locator('.experience .scene')).toHaveAttribute('data-rendered', 'true');
  await page.screenshot({ path: 'test-results/ticketpulse-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
