import { expect, test } from '@playwright/test';
import { hashGameState } from '../../src/sim/game';
import { tileX, tileY } from '../../src/sim/map/map';
import { townName } from '../../src/sim/town/town-names';
import { createGame } from '../../src/sim/world/generate';

const SEED = 7;
const world = createGame({ mapLogX: 6, mapLogY: 6, seed: SEED });
const town = world.towns[0]!;
const name = townName(town.nameParts);

test('town names keep their screen size and go small far out', async ({ page, isMobile }) => {
  test.skip(isMobile, 'wheel zoom');
  await page.goto(
    `./?seed=${SEED}&size=64x64&tile=${tileX(world.map, town.xy)},${tileY(world.map, town.xy)}`,
  );
  await expect(page.locator('html')).toHaveAttribute('data-world-hash', hashGameState(world));
  const game = page.locator('#game');
  const label = async (): Promise<{ text: string; height: number; zoom: string }> => ({
    text: (await game.getAttribute('data-town-label')) ?? '',
    height: Number(await game.getAttribute('data-town-label-height')),
    zoom: (await game.getAttribute('data-camera-zoom')) ?? '',
  });

  await expect(game).toHaveAttribute('data-town-label', new RegExp(`^${name} \\(\\d`));
  const near = await label();
  expect(near.zoom).toBe('1.00');

  const box = (await game.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 380); // ÷1.2^3.8 ≈ 0.5: still the normal sign
  await expect(game).not.toHaveAttribute('data-camera-zoom', '1.00');
  const half = await label();
  expect(Number(half.zoom)).toBeGreaterThan(0.25);
  expect(half.height).toBe(near.height);

  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 300);
  await expect(game).toHaveAttribute('data-town-label', name);
  const far = await label();
  expect(far.height).toBeGreaterThan(0);
  expect(far.height).toBeLessThan(near.height);
});
