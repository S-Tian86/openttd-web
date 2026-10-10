import { expect, test, type Page } from '@playwright/test';
import { getTileType, TileType, tileXY, type MapState } from '../../src/sim/map/map';
import { isTileFlat } from '../../src/sim/map/slope';
import { createGame } from '../../src/sim/world/generate';
import { lastCommand, mouseDrag, openWorld, tileCentre, touchDrag } from './helpers';

const SEED = 7;
const world = createGame({ mapLogX: 6, mapLogY: 6, seed: SEED });

/** First run of `length` flat clear tiles along X, away from the edge (or -1). */
function findRun(map: MapState, length: number): number {
  for (let y = 6; y < map.sizeY - 6; y++) {
    for (let x = 6; x < map.sizeX - 6 - length; x++) {
      const tiles = Array.from({ length }, (_, i) => tileXY(map, x + i, y));
      if (tiles.every((t) => getTileType(map, t) === TileType.Clear && isTileFlat(map, t)))
        return tiles[0]!;
    }
  }
  return -1;
}
const gbp = (n: number): string =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(n);

const A = findRun(world.map, 5);
const C = A + 2; // two tiles further along X
const E = A + 4;

async function gestureAndConfirm(
  page: Page,
  isMobile: boolean,
  from: number,
  to: number,
): Promise<void> {
  const a = await tileCentre(page, world, from);
  const b = await tileCentre(page, world, to);
  if (isMobile) {
    const before = await lastCommand(page);
    await touchDrag(page, a, b);
    const confirm = page.getByRole('button', { name: 'Build', exact: true });
    await expect(confirm).toBeVisible();
    expect(await lastCommand(page)).toEqual(before); // nothing until Confirm (R20)
    await confirm.tap();
  } else {
    await mouseDrag(page, a, b);
  }
}

/** The camera readout, to tell whether a gesture moved or zoomed the map. */
async function camera(page: Page): Promise<(string | null)[]> {
  const game = page.locator('#game');
  return [
    await game.getAttribute('data-camera-x'),
    await game.getAttribute('data-camera-y'),
    await game.getAttribute('data-camera-zoom'),
  ];
}

test('the seed has five flat clear tiles in a row', () => {
  expect(A).toBeGreaterThanOrEqual(0);
});

test('a rail drag builds the piece OpenTTD would and charges for it (Review Focus 1)', async ({
  page,
  isMobile,
}) => {
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build railway track' }).click();
  await gestureAndConfirm(page, isMobile, A, E);
  await expect
    .poll(() => lastCommand(page))
    .toEqual({ type: 'buildRailroadTrack', endTile: E, startTile: A, track: 0 });
  const cost = Number(await page.locator('html').getAttribute('data-last-cost'));
  expect(cost).toBeGreaterThanOrEqual(5 * 75);
  await expect(page.getByLabel('Money')).toHaveText(gbp(100000 - cost));
});

test('a station drag builds one platform along X', async ({ page, isMobile }) => {
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build railway station' }).click();
  await gestureAndConfirm(page, isMobile, A, C);
  await expect
    .poll(() => lastCommand(page))
    .toEqual({ type: 'buildRailStation', tile: A, axis: 0, numTracks: 1, platLength: 3 });
});

test('a depot faces north-west by default and the bulldozer clears a tile', async ({
  page,
  isMobile,
}) => {
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build train depot' }).click();
  await gestureAndConfirm(page, isMobile, A, A);
  await expect.poll(() => lastCommand(page)).toEqual({ type: 'buildTrainDepot', tile: A, dir: 3 });
  await page.getByRole('button', { name: 'Demolish' }).click();
  await gestureAndConfirm(page, isMobile, E, E);
  await expect
    .poll(() => lastCommand(page))
    .toEqual({ type: 'clearArea', endTile: E, startTile: E, diagonal: false });
});

test('building while paused explains why and builds nothing (Review Focus 4)', async ({
  page,
  isMobile,
}) => {
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Build railway track' }).click();
  await gestureAndConfirm(page, isMobile, A, A);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText("Can't build railway track here...");
  await expect(alert).toContainText('Not allowed while paused');
  expect(await lastCommand(page)).toBeNull();
});

test('a mouse hovering with a build tool shows the ghost (R30)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'no hover on touch');
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build railway track' }).click();
  const a = await tileCentre(page, world, A);
  await page.mouse.move(a.x + 20, a.y + 20, { steps: 4 });
  await expect(page.locator('html')).toHaveAttribute('data-preview', 'ok');
  expect(await lastCommand(page)).toBeNull();
});

for (const button of ['right', 'middle'] as const) {
  test(`a ${button}-button drag pans the map with a build tool on (R30)`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mouse buttons');
    await openWorld(page, world, SEED, A);
    await page.getByRole('button', { name: 'Build railway track' }).click();
    const a = await tileCentre(page, world, A);
    const before = await camera(page);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button });
    await page.mouse.move(a.x - 120, a.y - 60, { steps: 6 });
    await page.mouse.up({ button });
    await expect.poll(() => camera(page)).not.toEqual(before);
    await expect(page.getByRole('status')).toHaveCount(0); // no cost bar: nothing was planned
    expect(await lastCommand(page)).toBeNull();
  });
}

test('a second finger turns a build drag into a pinch that builds nothing (R30)', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'touch pinch');
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build railway track' }).click();
  const { x, y } = await tileCentre(page, world, A);
  const zoomBefore = await page.locator('#game').getAttribute('data-camera-zoom');
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: number[][]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(([px, py], i) => ({ x: px!, y: py!, id: i + 1 })),
    });
  await touch('touchStart', [[x, y]]);
  await touch('touchMove', [[x, y + 40]]);
  // Positive control: the first finger really started a build.
  await expect(page.getByRole('status')).toContainText('Estimated Cost');
  await touch('touchStart', [
    [x, y + 40],
    [x + 30, y + 40],
  ]);
  for (const gap of [45, 60, 80, 100]) {
    await touch('touchMove', [
      [x, y + 40],
      [x + gap, y + 40],
    ]);
  }
  await touch('touchEnd', []);
  await expect
    .poll(() => page.locator('#game').getAttribute('data-camera-zoom'))
    .not.toBe(zoomBefore);
  await expect(page.getByRole('button', { name: 'Build', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(await lastCommand(page)).toBeNull();
});

test('a build drag held past the long-press time builds and opens no query (R30)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Playwright has no touch long-press');
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build railway track' }).click();
  const a = await tileCentre(page, world, A);
  const c = await tileCentre(page, world, C);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.move(c.x, c.y, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(() => lastCommand(page))
    .toEqual({ type: 'buildRailroadTrack', endTile: C, startTile: A, track: 0 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a build drag released outside the map canvas still ends', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a finger keeps its target');
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build railway track' }).click();
  const a = await tileCentre(page, world, A);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x, a.y + 100, { steps: 4 });
  await expect(page.getByRole('status')).toBeVisible(); // the drag is under way
  const bar = (await page.locator('.status-bar').boundingBox())!;
  await page.mouse.move(a.x, bar.y + bar.height / 2, { steps: 8 });
  await page.mouse.up(); // over the status bar, not the canvas
  // The gesture ended as an 'end', not a 'cancel': the command was posted, so it either built
  // or was refused with an error message; a cancel would do neither.
  await expect
    .poll(async () => ({
      built: (await lastCommand(page)) !== null,
      refused: (await page.getByRole('alert').count()) > 0,
    }))
    .not.toEqual({ built: false, refused: false });
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('turning a tool on while a press is held opens no query (R30)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Playwright has no touch long-press');
  await openWorld(page, world, SEED, A);
  const a = await tileCentre(page, world, A);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.getByRole('button', { name: 'Build railway track' }).dispatchEvent('click');
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.mouse.move(a.x + 4, a.y + 4);
  await expect(page.locator('html')).toHaveAttribute('data-preview', 'ok'); // the tool is on
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await lastCommand(page)).toBeNull();
});
