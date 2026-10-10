import { expect, type Page } from '@playwright/test';
import type { Command } from '../../src/sim/command/command';
import { hashGameState, type GameState } from '../../src/sim/game';
import { tileX, tileY } from '../../src/sim/map/map';

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Opens the world of `seed` centred on `tile` and waits until it is the one shown. */
export async function openWorld(
  page: Page,
  world: GameState,
  seed: number,
  tile: number,
): Promise<void> {
  const { map } = world;
  await page.goto(
    `./?seed=${seed}&size=${map.sizeX}x${map.sizeY}&tile=${tileX(map, tile)},${tileY(map, tile)}`,
  );
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-world-hash', hashGameState(world));
}

/** Screen point of a tile centre: camera zoom is 1 at start, so screen = world - scroll. */
export async function tileCentre(page: Page, world: GameState, tile: number): Promise<ScreenPoint> {
  const game = page.locator('#game');
  const box = (await game.boundingBox())!;
  const scrollX = Number(await game.getAttribute('data-camera-x'));
  const scrollY = Number(await game.getAttribute('data-camera-y'));
  return {
    x: box.x + tileY(world.map, tile) * 64 + 32 - scrollX,
    y: box.y + tileX(world.map, tile) * 64 + 32 - scrollY,
  };
}

/** A left-button mouse drag from one screen point to another. */
export async function mouseDrag(page: Page, from: ScreenPoint, to: ScreenPoint): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** A one-finger drag through CDP touch events (Playwright has no touch drag). */
export async function touchDrag(page: Page, from: ScreenPoint, to: ScreenPoint): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y, id: 1 }],
  });
  for (let i = 1; i <= 6; i++) {
    const x = from.x + ((to.x - from.x) * i) / 6;
    const y = from.y + ((to.y - from.y) * i) / 6;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 1 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** The last construction command the game executed (`data-last-command`), or null. */
export async function lastCommand(page: Page): Promise<Command | null> {
  const json = await page.locator('html').getAttribute('data-last-command');
  return json === null ? null : (JSON.parse(json) as Command);
}
