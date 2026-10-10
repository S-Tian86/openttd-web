import { expect, test } from '@playwright/test';
import { MIN_ZOOM } from '../../src/render/camera';
import { TILE_PX } from '../../src/render/projection';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('hands touch gestures to the game', async ({ page }) => {
  await expect(page.locator('#game')).toHaveCSS('touch-action', 'none');
  await expect(page.locator('.status-bar')).toHaveCSS('touch-action', 'none');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('touch-action', 'pan-y');
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

test('the map edges can be dragged to the middle of the screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drag; the clamp is the same code on phones');
  // A small world: at the lowest zoom a full one redraws too much per drag on CI runners.
  await page.goto('./?seed=1&size=64x64');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  const game = page.locator('#game');
  const lastCorner = (64 - 1) * TILE_PX;
  const view = page.viewportSize();
  if (view === null) throw new Error('no viewport');
  await page.mouse.move(view.width / 2, view.height / 2);
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 300);
  await expect(game).toHaveAttribute('data-camera-zoom', MIN_ZOOM.toFixed(2));

  // Drags across the screen until the camera stops, then returns the world x under its middle.
  const dragToEnd = async (direction: 1 | -1): Promise<number> => {
    const from = view.width / 2 - direction * view.width * 0.4;
    let last = '';
    for (;;) {
      await page.mouse.move(from, view.height / 2);
      await page.mouse.down();
      await page.mouse.move(from + direction * view.width * 0.8, view.height / 2, { steps: 2 });
      await page.mouse.up();
      // Let two frames publish the clamped camera before reading it.
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done(null))),
          ),
      );
      const x = (await game.getAttribute('data-camera-x')) ?? '';
      if (x === last) return Number(x) + view.width / 2;
      last = x;
    }
  };
  // Dragging right scrolls towards the west edge, dragging left towards the east edge.
  expect(await dragToEnd(1)).toBeCloseTo(0, 1);
  expect(await dragToEnd(-1)).toBeCloseTo(lastCorner, 1);
});
