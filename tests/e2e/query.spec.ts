import { expect, test, type Page } from '@playwright/test';
import { hashGameState } from '../../src/sim/game';
import { getIndustryIndex } from '../../src/sim/map/industry-map';
import { getTileType, TileType, tileX, tileY } from '../../src/sim/map/map';
import { getClearGround, ClearGround } from '../../src/sim/map/clear';
import { townName } from '../../src/sim/town/town-names';
import { createGame } from '../../src/sim/world/generate';

const SEED = 7; // Step 5 checks this 64×64 world has a town and an industry; pick another seed if not
const world = createGame({ mapLogX: 6, mapLogY: 6, seed: SEED });
const tiles = Array.from({ length: world.map.size }, (_, t) => t);
const houseTile = tiles.find((t) => getTileType(world.map, t) === TileType.House) ?? -1;
const industryTile = tiles.find((t) => getTileType(world.map, t) === TileType.Industry) ?? -1;
const grassTile =
  tiles.find(
    (t) =>
      getTileType(world.map, t) === TileType.Clear &&
      getClearGround(world.map, t) === ClearGround.Grass &&
      tileX(world.map, t) > 8 &&
      tileY(world.map, t) > 8,
  ) ?? -1;

/** Title of the town window for the town that owns the house tile. */
function townTitle(): string {
  const town = world.towns[world.map.m2[houseTile] ?? 0]!;
  return town.isCity ? `${townName(town.nameParts)} (City)` : townName(town.nameParts);
}

async function openWorld(page: Page, tile: number): Promise<void> {
  await page.goto(
    `./?seed=${SEED}&size=64x64&tile=${tileX(world.map, tile)},${tileY(world.map, tile)}`,
  );
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-world-hash', hashGameState(world));
}

/** Screen point of a tile centre: camera zoom is 1 at start, so screen = world - scroll. */
async function tileCentre(page: Page, tile: number): Promise<{ x: number; y: number }> {
  const game = page.locator('#game');
  const box = (await game.boundingBox())!;
  const scrollX = Number(await game.getAttribute('data-camera-x'));
  const scrollY = Number(await game.getAttribute('data-camera-y'));
  return {
    x: box.x + tileY(world.map, tile) * 64 + 32 - scrollX,
    y: box.y + tileX(world.map, tile) * 64 + 32 - scrollY,
  };
}

async function tapTile(page: Page, isMobile: boolean, tile: number): Promise<void> {
  const { x, y } = await tileCentre(page, tile);
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('the seed gives a world with a house, an industry and inland grass', () => {
  expect([houseTile, industryTile, grassTile].every((t) => t >= 0)).toBe(true);
});

test('querying a house opens its town window', async ({ page, isMobile }) => {
  await openWorld(page, houseTile);
  await page.getByRole('button', { name: 'Query tile' }).click();
  await tapTile(page, isMobile, houseTile);
  const dialog = page.getByRole('dialog', { name: townTitle() });
  await expect(dialog).toContainText('Population:');
  await expect(dialog).toContainText('Houses:');
});

test('querying an industry opens its industry window', async ({ page, isMobile }) => {
  await openWorld(page, industryTile);
  await page.getByRole('button', { name: 'Query tile' }).click();
  await tapTile(page, isMobile, industryTile);
  const industry = world.industries[getIndustryIndex(world.map, industryTile)]!;
  await expect(page.getByRole('dialog')).toContainText(
    industry.type === 0 ? 'Coal Mine' : 'Power Station',
  );
});

test('querying grass shows land information', async ({ page, isMobile }) => {
  await openWorld(page, grassTile);
  await page.getByRole('button', { name: 'Query tile' }).click();
  await tapTile(page, isMobile, grassTile);
  await expect(page.getByRole('dialog', { name: 'Land area information' })).toContainText('Grass');
});

test('dragging the map with the query tool does not query (Review Focus 4)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'mouse drag');
  await openWorld(page, grassTile);
  await page.getByRole('button', { name: 'Query tile' }).click();
  const { x, y } = await tileCentre(page, grassTile);
  const game = page.locator('#game');
  const before = [
    await game.getAttribute('data-camera-x'),
    await game.getAttribute('data-camera-y'),
  ];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y - 60, { steps: 6 });
  await page.mouse.up();
  // Positive control: the gesture really scrolled the map, so "no dialog" is not vacuous.
  await expect
    .poll(async () => [
      await game.getAttribute('data-camera-x'),
      await game.getAttribute('data-camera-y'),
    ])
    .not.toEqual(before);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a long press queries without the tool', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Playwright has no touch long-press');
  await openWorld(page, grassTile);
  const { x, y } = await tileCentre(page, grassTile);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Land area information' })).toBeVisible();
});

test('a two-finger pinch with the query tool does not query', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch pinch');
  await openWorld(page, grassTile);
  await page.getByRole('button', { name: 'Query tile' }).click();
  const game = page.locator('#game');
  const zoomBefore = await game.getAttribute('data-camera-zoom');
  const { x, y } = await tileCentre(page, grassTile);
  const cdp = await page.context().newCDPSession(page);
  const touch = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    gap: number,
  ): Promise<void> => {
    const touchPoints =
      type === 'touchEnd'
        ? []
        : [
            { x: x - gap, y, id: 1 },
            { x: x + gap, y, id: 2 },
          ];
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  };
  await touch('touchStart', 20);
  for (const gap of [30, 45, 60, 80]) await touch('touchMove', gap);
  await touch('touchEnd', 0);
  // Positive control: the fingers really pinched the map.
  await expect.poll(() => game.getAttribute('data-camera-zoom')).not.toBe(zoomBefore);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
