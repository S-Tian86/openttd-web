import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('hands touch gestures to the game', async ({ page }) => {
  await expect(page.locator('#game')).toHaveCSS('touch-action', 'none');
});

test('drag pans and wheel zooms (desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse only');
  const game = page.locator('#game');
  const x0 = await game.getAttribute('data-camera-x');
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(300, 250, { steps: 5 });
  await page.mouse.up();
  await expect(game).not.toHaveAttribute('data-camera-x', x0 ?? '');
  const z0 = await game.getAttribute('data-camera-zoom');
  await page.mouse.wheel(0, -300);
  await expect(game).not.toHaveAttribute('data-camera-zoom', z0 ?? '');
});
