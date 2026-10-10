import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('shows the starting date and money', async ({ page }) => {
  await expect(page.getByLabel('Money')).toHaveText('£100,000');
  await expect(page.getByLabel('Date')).toContainText('1950');
});

test('the calendar runs and can be paused', async ({ page }) => {
  const date = page.getByLabel('Date');
  const start = await date.textContent();
  await expect(date).not.toHaveText(start ?? '', { timeout: 6000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  const paused = await date.textContent();
  await page.waitForTimeout(2500);
  await expect(date).toHaveText(paused ?? '');
});

test('switches to Spanish', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Language').selectOption('es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('dialog', { name: 'Ajustes' })).toBeVisible();
});
