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
  await page.getByRole('button', { name: 'Language English' }).click();
  await page.getByRole('option', { name: 'Español' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('dialog', { name: 'Ajustes' })).toBeVisible();
});

test('the theme dropdown opens inside the screen and a tap outside closes it', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /^Theme / }).click();
  const list = page.getByRole('listbox');
  const box = await list.boundingBox();
  const view = page.viewportSize();
  if (box === null || view === null) throw new Error('no list');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  await page.mouse.click(5, view.height / 2);
  await expect(list).toHaveCount(0);
  // The settings window stays open, like OpenTTD's windows.
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});
