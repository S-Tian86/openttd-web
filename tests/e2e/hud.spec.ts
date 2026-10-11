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

test('icon buttons name themselves in a tooltip after hovering (misc_gui.cpp)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'hover');
  const tooltip = page.locator('.tooltip');
  await page.getByRole('button', { name: 'Build railway track' }).hover();
  await expect(tooltip).toHaveText('Build railway track');
  const box = (await tooltip.boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  await page.mouse.move(view.width / 2, view.height / 2);
  await expect(tooltip).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings' }).hover();
  await expect(tooltip).toHaveText('Settings');
});

test('a tap on an icon button acts and shows its name for a moment', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch');
  const tool = page.getByRole('button', { name: 'Build railway track' });
  await tool.tap();
  await expect(tool).toHaveAttribute('aria-pressed', 'true');
  const tooltip = page.locator('.tooltip');
  await expect(tooltip).toHaveText('Build railway track');
  const box = (await tooltip.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(tooltip).toHaveCount(0, { timeout: 4000 });
});
