import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./?seed=1&size=64x64');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('generates a new 64×128 world from the new-game window', async ({ page }) => {
  const html = page.locator('html');
  const first = await html.getAttribute('data-world-hash');
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByLabel('Map size X').selectOption('6');
  await dialog.getByLabel('Map size Y').selectOption('7');
  await dialog.getByLabel('Seed').fill('12345');
  await dialog.getByRole('button', { name: 'Generate' }).click();
  await expect(html).not.toHaveAttribute('data-world-hash', first ?? '');
  await expect(dialog).toBeHidden();
});

test('shows the generating state for a large map', async ({ page }) => {
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByLabel('Map size X').selectOption('10');
  await dialog.getByLabel('Map size Y').selectOption('10');
  await dialog.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByRole('status')).toContainText('Generating world');
});

test('refuses a bad seed', async ({ page }) => {
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByLabel('Seed').fill('abc');
  await expect(dialog.getByRole('button', { name: 'Generate' })).toBeDisabled();
});
