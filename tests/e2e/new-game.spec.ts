import { expect, test } from '@playwright/test';
import { hashGameState } from '../../src/sim/game';
import { createGame } from '../../src/sim/world/generate';

test.beforeEach(async ({ page }) => {
  await page.goto('./?seed=1&size=64x64');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('generates a new 64×128 world from the new-game window', async ({ page }) => {
  const html = page.locator('html');
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByRole('button', { name: /^Map size X / }).click();
  await dialog.getByRole('option', { name: '64', exact: true }).click();
  await dialog.getByRole('button', { name: /^Map size Y / }).click();
  await dialog.getByRole('option', { name: '128', exact: true }).click();
  await dialog.getByLabel('Seed').fill('12345');
  await dialog.getByRole('button', { name: 'Generate' }).click();
  const expected = hashGameState(createGame({ mapLogX: 6, mapLogY: 7, seed: 12345 }));
  await expect(html).toHaveAttribute('data-world-hash', expected);
  await expect(dialog).toBeHidden();
});

test('a new game starts at the normal zoom (genworld.cpp)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'wheel zoom');
  const game = page.locator('#game');
  const box = (await game.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 600);
  await expect(game).not.toHaveAttribute('data-camera-zoom', '1.00');
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByLabel('Seed').fill('4242');
  await dialog.getByRole('button', { name: 'Generate' }).click();
  await expect(dialog).toBeHidden();
  await expect(game).toHaveAttribute('data-camera-zoom', '1.00');
});

test('shows the generating state for a large map', async ({ page }) => {
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByRole('button', { name: /^Map size X / }).click();
  await dialog.getByRole('option', { name: '1024', exact: true }).click();
  await dialog.getByRole('button', { name: /^Map size Y / }).click();
  await dialog.getByRole('option', { name: '1024', exact: true }).click();
  await dialog.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByRole('status')).toContainText('Generating world');
});

test('refuses a bad seed', async ({ page }) => {
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByLabel('Seed').fill('abc');
  await expect(dialog.getByRole('button', { name: 'Generate' })).toBeDisabled();
});
