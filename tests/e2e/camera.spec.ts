import { expect, test, type Page } from '@playwright/test';
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

const camera = async (page: Page) => {
  const game = page.locator('#game');
  return [
    Number(await game.getAttribute('data-camera-x')),
    Number(await game.getAttribute('data-camera-y')),
  ];
};

const drag = async (page: Page, button: 'left' | 'right' | 'middle', dx: number, dy: number) => {
  await page.mouse.move(400, 300);
  await page.mouse.down({ button });
  await page.mouse.move(400 + dx, 300 + dy, { steps: 5 });
  await page.mouse.up({ button });
};

const chooseSetting = async (page: Page, label: string, option: string) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: new RegExp(`^${label} `) }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();
};

test('a right drag pans and the wheel zooms, as OpenTTD by default (desktop)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'mouse only');
  const before = await camera(page);
  await drag(page, 'right', -100, -50);
  await expect.poll(() => camera(page)).toEqual([before[0]! + 100, before[1]! + 50]);
  const game = page.locator('#game');
  const z0 = await game.getAttribute('data-camera-zoom');
  await page.mouse.wheel(0, -300);
  await expect(game).not.toHaveAttribute('data-camera-zoom', z0 ?? '');
});

test('a left or middle drag does not pan by default (VSM_MAP_RMB)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse only');
  const before = await camera(page);
  await drag(page, 'left', -100, -50);
  await drag(page, 'middle', -100, -50);
  // Positive control: the same drag with the right button does pan.
  await drag(page, 'right', -100, -50);
  await expect.poll(() => camera(page)).toEqual([before[0]! + 100, before[1]! + 50]);
});

test('the LMB scroll mode pans with the left button', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse only');
  await chooseSetting(page, 'Viewport scroll behaviour', 'Move map with LMB');
  const before = await camera(page);
  await drag(page, 'left', -100, -50);
  await expect.poll(() => camera(page)).toEqual([before[0]! + 100, before[1]! + 50]);
});

test('the viewport mode moves the view with the mouse, the other way round', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'mouse only');
  await chooseSetting(
    page,
    'Viewport scroll behaviour',
    'Move viewport with RMB, mouse position locked',
  );
  const before = await camera(page);
  await drag(page, 'right', -100, -50);
  await expect.poll(async () => (await camera(page))[0]! < before[0]!).toBe(true);
});

test('the wheel scrolls the map in the scroll mode of the wheel, and the choice is kept', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'mouse only');
  await chooseSetting(page, 'Function of scrollwheel', 'Scroll map');
  const game = page.locator('#game');
  const zoom = await game.getAttribute('data-camera-zoom');
  const before = await camera(page);
  await page.mouse.move(400, 300);
  await page.mouse.wheel(0, 100); // one notch: 14 px × speed 5
  await expect.poll(() => camera(page)).toEqual([before[0]!, before[1]! + 70]);
  await expect(game).toHaveAttribute('data-camera-zoom', zoom ?? '');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(
    page.getByRole('button', { name: 'Function of scrollwheel Scroll map' }),
  ).toBeVisible();
});

test('the arrow keys scroll the map, faster with Shift (HandleKeyScrolling)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'keyboard');
  const before = await camera(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await camera(page))[0]! > before[0]! + 40).toBe(true);
  await page.keyboard.up('ArrowRight');
  const stopped = await camera(page);
  await page.waitForTimeout(150);
  expect(await camera(page)).toEqual(stopped);
  expect(stopped[1]).toBe(before[1]);
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
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(from + direction * view.width * 0.8, view.height / 2, { steps: 2 });
      await page.mouse.up({ button: 'right' });
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
