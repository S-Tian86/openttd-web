import { Math as PMath, Scene, type GameObjects, type Input, type Tilemaps } from 'phaser';
import { takeDirtyTiles, type GameState } from '../sim/game';
import { tileX, tileXY, tileY } from '../sim/map/map';
import { townName } from '../sim/town/town-names';
import { ATLAS_COLUMNS, atlasCell } from './atlas';
import { clampScrollToMap, pinchZoom, wheelZoom } from './camera';
import {
  buildPointerAction,
  buildPressEnds,
  classifyPress,
  LONG_PRESS_MS,
  TAP_SLOP_PX,
  type BuildGesture,
} from './gesture';
import { groundSprite } from './ground';
import { chunkObjects } from './objects';
import { previewShapes, type MapPreview } from './preview';
import {
  CHUNK_TILES,
  TILE_PX,
  chunkCellToTile,
  tileToChunkCell,
  visibleChunks,
  worldToOttd,
  worldToTile,
  type OttdPoint,
} from './projection';
import {
  GROUND_SPRITE_IDS,
  OBJECT_PX_HEIGHT,
  OBJECT_SPRITE_IDS,
  resolveSprite,
  type SpriteId,
  type Theme,
} from './theme';

/** What the map reports back: taps and long presses on tiles, and build-tool gestures. */
export interface MapInput {
  onTap(tile: number): void;
  onLongPress(tile: number): void;
  onBuildGesture(g: BuildGesture): void;
}

interface Chunk {
  map: Tilemaps.Tilemap;
  layer: Tilemaps.TilemapLayer;
  objects: GameObjects.Blitter;
}

const GROUND_INDEX: readonly SpriteId[] = GROUND_SPRITE_IDS;
const CHUNK_PX = CHUNK_TILES * TILE_PX;

/** Draws the ground layer in 32×32-tile chunks, keeping only the visible ones alive. */
export class MapScene extends Scene {
  private readonly chunks = new Map<string, Chunk>();
  private labels: GameObjects.Text[] = [];
  private pending: { state: GameState; focusTile: number | undefined } | null = null;
  private justSwapped = false;
  private pinchStartZoom = 1;
  private pinchStartDistance = 0;
  private pinching = false;
  private cameraReadout = '';
  /** The single-pointer press in progress, classified once when it ends. */
  private press: { x: number; y: number; at: number; moved: boolean; consumed: boolean } | null =
    null;
  /** Whether a build tool is on: one pointer then builds instead of panning and tapping (R30). */
  private buildMode = false;
  /** The press of a build tool in progress. */
  private build: {
    pointerId: number;
    button: number;
    press: OttdPoint;
    current: OttdPoint;
    touch: boolean;
  } | null = null;
  /** Created in create(); the latest preview is kept so one shown earlier is drawn then. */
  private ghost: GameObjects.Graphics | undefined;
  private preview: MapPreview | null = null;

  constructor(
    private state: GameState,
    private readonly theme: Theme,
    private readonly fallback: Theme,
    private readonly themeBase: string,
    private readonly fallbackBase: string,
    private readonly callbacks: MapInput,
  ) {
    super('map');
  }

  /** Swaps the world at the next update and centres on `focusTile` (or the map centre). */
  showGame(state: GameState, focusTile?: number): void {
    this.pending = { state, focusTile };
  }

  /** Turns build gestures on or off; turning them off cancels a gesture in progress. */
  setBuildMode(on: boolean): void {
    this.buildMode = on;
    // A press already held must not turn into a long press under a build tool (R30).
    if (on) this.press = null;
    else this.cancelBuild();
  }

  /** Draws the construction ghost (R31), or clears it for null. Safe before the scene starts. */
  showPreview(preview: MapPreview | null): void {
    this.preview = preview;
    this.drawPreview();
  }

  private drawPreview(): void {
    const ghost = this.ghost;
    if (ghost === undefined) return;
    ghost.clear();
    if (this.preview === null) return;
    const { colour, lines, rects } = previewShapes(this.state.map, this.preview);
    ghost.lineStyle(12, colour, 0.8);
    for (const { x1, y1, x2, y2 } of lines) ghost.lineBetween(x1, y1, x2, y2);
    ghost.fillStyle(colour, 0.35);
    for (const { x, y, w, h } of rects) ghost.fillRect(x, y, w, h);
  }

  preload(): void {
    const load = (
      id: (typeof GROUND_SPRITE_IDS)[number] | (typeof OBJECT_SPRITE_IDS)[number],
      height: number,
    ): void => {
      const base = this.theme.sprites[id] === undefined ? this.fallbackBase : this.themeBase;
      this.load.svg(id, base + resolveSprite(this.theme, this.fallback, id), {
        width: TILE_PX,
        height,
      });
    };
    for (const id of GROUND_SPRITE_IDS) load(id, TILE_PX);
    for (const id of OBJECT_SPRITE_IDS) load(id, OBJECT_PX_HEIGHT);
  }

  create(): void {
    this.createAtlases();
    this.ghost = this.add.graphics().setDepth(9000); // under the town labels
    this.drawPreview();
    this.resetView(undefined);
    this.setupInput();
  }

  private createAtlases(): void {
    if (!this.textures.exists('ground-atlas')) {
      const rows = Math.ceil(GROUND_SPRITE_IDS.length / ATLAS_COLUMNS);
      const atlas = this.textures.createCanvas(
        'ground-atlas',
        ATLAS_COLUMNS * TILE_PX,
        rows * TILE_PX,
      );
      if (atlas === null) throw new Error('Cannot create the ground atlas');
      GROUND_SPRITE_IDS.forEach((id, i) => {
        const { x, y } = atlasCell(i, TILE_PX, TILE_PX);
        atlas.context.drawImage(
          this.textures.get(id).getSourceImage() as CanvasImageSource,
          x,
          y,
          TILE_PX,
          TILE_PX,
        );
      });
      atlas.refresh();
    }
    if (!this.textures.exists('object-atlas')) {
      const rows = Math.ceil(OBJECT_SPRITE_IDS.length / ATLAS_COLUMNS);
      const atlas = this.textures.createCanvas(
        'object-atlas',
        ATLAS_COLUMNS * TILE_PX,
        rows * OBJECT_PX_HEIGHT,
      );
      if (atlas === null) throw new Error('Cannot create the object atlas');
      OBJECT_SPRITE_IDS.forEach((id, i) => {
        const { x, y } = atlasCell(i, TILE_PX, OBJECT_PX_HEIGHT);
        atlas.context.drawImage(
          this.textures.get(id).getSourceImage() as CanvasImageSource,
          x,
          y,
          TILE_PX,
          OBJECT_PX_HEIGHT,
        );
        atlas.add(id, 0, x, y, TILE_PX, OBJECT_PX_HEIGHT);
      });
      atlas.refresh();
    }
  }

  /** Centres the camera on the focus tile (or the map) and builds the town labels. */
  private resetView(focusTile: number | undefined): void {
    const { map, towns } = this.state;
    const camera = this.cameras.main;
    if (focusTile === undefined) {
      camera.centerOn((map.sizeY * TILE_PX) / 2, (map.sizeX * TILE_PX) / 2);
    } else {
      camera.centerOn(
        (tileY(map, focusTile) + 0.5) * TILE_PX,
        (tileX(map, focusTile) + 0.5) * TILE_PX,
      );
    }
    this.labels = towns.map((town) =>
      this.add
        .text(
          (tileY(map, town.xy) + 0.5) * TILE_PX,
          (tileX(map, town.xy) + 0.5) * TILE_PX,
          townName(town.nameParts),
          {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '28px',
            color: '#1f2a33',
            backgroundColor: '#fffaf2',
            padding: { x: 8, y: 4 },
          },
        )
        .setOrigin(0.5, 1)
        .setDepth(10000),
    );
  }

  private applyPending(): void {
    if (this.pending === null) return;
    const { state, focusTile } = this.pending;
    this.pending = null;
    for (const chunk of this.chunks.values()) this.destroyChunk(chunk);
    this.chunks.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];
    this.preview = null;
    this.ghost?.clear();
    this.state = state;
    this.resetView(focusTile);
    this.justSwapped = true;
  }

  private destroyChunk(chunk: Chunk): void {
    chunk.objects.destroy();
    chunk.map.destroy();
  }

  private fillObjects(chunk: Chunk, col: number, row: number): void {
    chunk.objects.clear();
    for (const { sprite, px, py } of chunkObjects(this.state.map, col, row)) {
      chunk.objects.create(px - TILE_PX / 2, py - OBJECT_PX_HEIGHT, sprite);
    }
  }

  override update(): void {
    this.applyPending();
    const { map } = this.state;
    const camera = this.cameras.main;
    camera.scrollX = clampScrollToMap(camera.scrollX, camera.width, map.sizeY, TILE_PX);
    camera.scrollY = clampScrollToMap(camera.scrollY, camera.height, map.sizeX, TILE_PX);
    const wanted = visibleChunks(this.cameras.main.worldView, map.sizeX, map.sizeY);
    const wantedKeys = new Set<string>();
    for (const { col, row } of wanted) {
      const key = `${col},${row}`;
      wantedKeys.add(key);
      if (!this.chunks.has(key)) this.chunks.set(key, this.buildChunk(col, row));
    }
    for (const [key, chunk] of this.chunks) {
      if (wantedKeys.has(key)) continue;
      this.destroyChunk(chunk);
      this.chunks.delete(key);
    }

    const dirtyChunks = new Set<string>();
    for (const t of takeDirtyTiles(this.state)) {
      const { col, row, cx, cy } = tileToChunkCell(tileX(map, t), tileY(map, t));
      const key = `${col},${row}`;
      const chunk = this.chunks.get(key);
      if (chunk === undefined) continue;
      chunk.layer.putTileAt(GROUND_INDEX.indexOf(groundSprite(map, t)), cx, cy);
      dirtyChunks.add(key);
    }
    for (const key of dirtyChunks) {
      const [col, row] = key.split(',').map(Number) as [number, number];
      this.fillObjects(this.chunks.get(key)!, col, row);
    }

    this.publishCamera();

    if (this.justSwapped) {
      this.justSwapped = false;
      document.documentElement.dataset['gameReady'] = 'true';
    }
  }

  private setupInput(): void {
    const camera = this.cameras.main;
    this.input.addPointer(1);
    this.input.mouse?.disableContextMenu(); // a right-drag pans while a build tool is on

    const startPinch = (): void => {
      const { pointer1, pointer2 } = this.input;
      if (this.press !== null) this.press.moved = true; // a pinch is never a tap
      this.pinching = true;
      this.pinchStartZoom = camera.zoom;
      this.pinchStartDistance = Math.max(1, this.pointerDistance(pointer1, pointer2));
    };

    this.input.on('pointerdown', (pointer: Input.Pointer) => {
      const { pointer1, pointer2 } = this.input;
      if (this.buildMode) {
        this.buildPointerDown(pointer, startPinch);
        return;
      }
      if (pointer1.isDown && pointer2.isDown) {
        startPinch();
        return;
      }
      this.press = {
        x: pointer.x,
        y: pointer.y,
        at: performance.now(),
        moved: false,
        consumed: false,
      };
      const press = this.press;
      // A wall-clock timer, not the scene clock: Phaser slows its clock on a slow frame rate,
      // which would stretch the hold time on exactly the devices that need it to be 500 ms.
      window.setTimeout(() => {
        if (this.press !== press || press.moved || press.consumed || this.pinching) return;
        if (!pointer.isDown) return;
        press.consumed = true;
        const tile = this.tileUnder(pointer);
        if (tile !== undefined) this.callbacks.onLongPress(tile);
      }, LONG_PRESS_MS);
    });

    const buildPointerUp = (pointer: Input.Pointer): boolean => {
      const build = this.build;
      if (build === null || pointer.id !== build.pointerId) return false;
      if (!buildPressEnds(build, pointer)) return true; // another mouse button: not the build's
      this.build = null;
      this.sendBuild('end', build.press, this.ottdUnder(pointer), build.touch, pointer);
      return true;
    };
    // A drag released outside the canvas still ends, as OpenTTD builds on any mouse-up.
    this.input.on('pointerupoutside', buildPointerUp);

    this.input.on('pointerup', (pointer: Input.Pointer) => {
      if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) {
        this.pinching = false;
      }
      // Before classifyPress: a build press is neither a tap nor a long press (R30).
      if (buildPointerUp(pointer)) return;
      const press = this.press;
      if (press === null) return;
      if (this.input.pointer1.isDown || this.input.pointer2.isDown) return; // pinch still ending
      this.press = null;
      if (press.consumed) return;
      const kind = classifyPress(
        press,
        { x: pointer.x, y: pointer.y, at: performance.now() },
        press.moved,
      );
      if (kind === 'drag') return;
      const tile = this.tileUnder(pointer);
      if (tile === undefined) return;
      // A busy page can run the release before the hold timer (browsers favour input over
      // timers); the press is then still unconsumed here, and it is a long press all the same.
      if (kind === 'long') this.callbacks.onLongPress(tile);
      else this.callbacks.onTap(tile);
    });

    this.input.on('pointermove', (pointer: Input.Pointer) => {
      const { pointer1, pointer2 } = this.input;
      const build = this.build;
      if (build !== null && pointer.id === build.pointerId) {
        build.current = this.ottdUnder(pointer);
        this.sendBuild('move', build.press, build.current, build.touch, pointer);
        return;
      }
      if (this.buildMode && !pointer.isDown && !pointer.wasTouch) {
        const p = this.ottdUnder(pointer);
        this.sendBuild('hover', p, p, false, pointer);
        return;
      }
      if (
        this.press !== null &&
        Math.max(Math.abs(pointer.x - this.press.x), Math.abs(pointer.y - this.press.y)) >
          TAP_SLOP_PX
      ) {
        this.press.moved = true;
      }
      if (this.pinching && pointer1.isDown && pointer2.isDown) {
        // The two-finger midpoint moves by half of this finger's movement.
        camera.scrollX -= (pointer.x - pointer.prevPosition.x) / 2 / camera.zoom;
        camera.scrollY -= (pointer.y - pointer.prevPosition.y) / 2 / camera.zoom;
        const zoom = pinchZoom(
          this.pinchStartZoom,
          this.pinchStartDistance,
          this.pointerDistance(pointer1, pointer2),
        );
        this.zoomAt((pointer1.x + pointer2.x) / 2, (pointer1.y + pointer2.y) / 2, zoom);
        return;
      }
      if (this.pinching || !pointer.isDown) return;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
      camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
    });

    this.input.on('wheel', (pointer: Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      this.zoomAt(pointer.x, pointer.y, wheelZoom(camera.zoom, dy));
    });
  }

  /** A press while a build tool is on: build, pan or pinch (R30); never a long-press timer. */
  private buildPointerDown(pointer: Input.Pointer, startPinch: () => void): void {
    // Another button of the mouse that is building: the build drag goes on (one pointer id).
    if (this.build?.pointerId === pointer.id) return;
    const { pointer1, pointer2 } = this.input;
    const action = buildPointerAction({
      button: pointer.button,
      touch: pointer.wasTouch,
      pointers: (pointer1.isDown ? 1 : 0) + (pointer2.isDown ? 1 : 0),
    });
    if (action === 'build') {
      const press = this.ottdUnder(pointer);
      this.build = {
        pointerId: pointer.id,
        button: pointer.button,
        press,
        current: press,
        touch: pointer.wasTouch,
      };
      this.sendBuild('move', press, press, pointer.wasTouch, pointer);
    } else if (action === 'pinch') {
      this.cancelBuild();
      startPinch();
    } else {
      // A pan: consumed up front, so its release is never a tap.
      const at = performance.now();
      this.press = { x: pointer.x, y: pointer.y, at, moved: true, consumed: true };
    }
  }

  /** Ends a build press without building. */
  private cancelBuild(): void {
    const build = this.build;
    if (build === null) return;
    this.build = null;
    this.callbacks.onBuildGesture({
      phase: 'cancel',
      press: build.press,
      current: build.current,
      touch: build.touch,
      ctrl: false,
    });
  }

  private sendBuild(
    phase: BuildGesture['phase'],
    press: OttdPoint,
    current: OttdPoint,
    touch: boolean,
    pointer: Input.Pointer,
  ): void {
    const ctrl = (pointer.event as MouseEvent | undefined)?.ctrlKey === true;
    this.callbacks.onBuildGesture({ phase, press, current, touch, ctrl });
  }

  /** The OpenTTD world point under a pointer; outside the map is fine (planBuild clamps it). */
  private ottdUnder(pointer: Input.Pointer): OttdPoint {
    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return worldToOttd(w.x, w.y);
  }

  /** The map tile under a pointer, or undefined outside the map. */
  private tileUnder(pointer: Input.Pointer): number | undefined {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const { x, y } = worldToTile(world.x, world.y);
    const { map } = this.state;
    if (x < 0 || y < 0 || x >= map.sizeX || y >= map.sizeY) return undefined;
    return tileXY(map, x, y);
  }

  private pointerDistance(a: Input.Pointer, b: Input.Pointer): number {
    return PMath.Distance.Between(a.x, a.y, b.x, b.y);
  }

  /** Zooms while keeping the world point under the screen position fixed. */
  private zoomAt(screenX: number, screenY: number, zoom: number): void {
    const camera = this.cameras.main;
    const before = camera.getWorldPoint(screenX, screenY);
    camera.setZoom(zoom);
    camera.preRender();
    const after = camera.getWorldPoint(screenX, screenY);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
  }

  private publishCamera(): void {
    const camera = this.cameras.main;
    const x = camera.scrollX.toFixed(2);
    const y = camera.scrollY.toFixed(2);
    const zoom = camera.zoom.toFixed(2);
    const readout = `${x}|${y}|${zoom}`;
    if (readout === this.cameraReadout) return;
    this.cameraReadout = readout;
    const game = document.getElementById('game');
    if (game === null) return;
    game.dataset['cameraX'] = x;
    game.dataset['cameraY'] = y;
    game.dataset['cameraZoom'] = zoom;
  }

  private buildChunk(col: number, row: number): Chunk {
    const map = this.make.tilemap({
      width: CHUNK_TILES,
      height: CHUNK_TILES,
      tileWidth: TILE_PX,
      tileHeight: TILE_PX,
    });
    const tileset = map.addTilesetImage('ground', 'ground-atlas', TILE_PX, TILE_PX, 0, 0);
    const layer =
      tileset === null ? null : map.createBlankLayer('g', tileset, col * CHUNK_PX, row * CHUNK_PX);
    if (layer === null) throw new Error('Cannot create a map chunk');
    for (let cy = 0; cy < CHUNK_TILES; cy++) {
      for (let cx = 0; cx < CHUNK_TILES; cx++) {
        const tile = chunkCellToTile(col, row, cx, cy);
        const t = tileXY(this.state.map, tile.x, tile.y);
        layer.putTileAt(GROUND_INDEX.indexOf(groundSprite(this.state.map, t)), cx, cy);
      }
    }
    const chunk: Chunk = {
      map,
      layer,
      objects: this.add.blitter(col * CHUNK_PX, row * CHUNK_PX, 'object-atlas').setDepth(1 + row),
    };
    this.fillObjects(chunk, col, row);
    return chunk;
  }
}
