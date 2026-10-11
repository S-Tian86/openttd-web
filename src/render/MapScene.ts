import {
  Math as PMath,
  Scene,
  type GameObjects,
  type Input,
  type Tilemaps,
  type Types,
} from 'phaser';
import { takeDirtyTiles, type GameState } from '../sim/game';
import { tileX, tileXY, tileY } from '../sim/map/map';
import type { Town } from '../sim/town/town';
import { ATLAS_COLUMNS, atlasCell } from './atlas';
import { clampScrollToMap, pinchZoom, wheelZoom } from './camera';
import {
  DEFAULT_MAP_CONTROLS,
  KEY_SCROLL_INTERVAL_MS,
  keyScrollDelta,
  scrollButton,
  scrollDirection,
  scrollLocksPointer,
  wheelScrollDelta,
  type MapControls,
} from './controls';
import {
  buildPointerAction,
  buildPressEnds,
  classifyPress,
  idlePointerRoles,
  LONG_PRESS_MS,
  TAP_SLOP_PX,
  type BuildGesture,
} from './gesture';
import { groundSprite } from './ground';
import { isSmallLabel, LABEL_FONT_PX } from './labels';
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

/** What the map reports back: taps and long presses on tiles, build-tool gestures and clicks. */
export interface MapInput {
  onTap(tile: number): void;
  onLongPress(tile: number): void;
  onBuildGesture(g: BuildGesture): void;
  /** A right click that did not drag the map. */
  onRightClick(): void;
}

/** Text the map draws, written by the app in the player's language. */
export interface MapText {
  townLabel(town: Town, small: boolean): string;
}

/** Sign style from the theme tokens: a panel box, or small text with a halo. */
function labelStyle(small: boolean): Types.GameObjects.Text.TextStyle {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string): string =>
    css.getPropertyValue(name).trim() || fallback;
  const text = token('--color-text', '#2d4a3e');
  const panel = token('--color-panel', '#fffaf2');
  const font = token('--font', 'sans-serif');
  // OpenTTD's small sign is white with a black shadow over its dark terrain; over the light
  // themes the same idea reads better inverted: dark text with a light halo.
  return small
    ? {
        fontFamily: font,
        fontSize: `${LABEL_FONT_PX.small}px`,
        fontStyle: 'bold',
        color: text,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        padding: { x: 3, y: 2 },
        stroke: panel,
        strokeThickness: 4,
      }
    : {
        fontFamily: font,
        fontSize: `${LABEL_FONT_PX.normal}px`,
        color: text,
        backgroundColor: panel,
        fontStyle: 'normal',
        padding: { x: 6, y: 3 },
        strokeThickness: 0,
      };
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
  /** Whether the labels carry the small style; null forces a restyle. */
  private labelsSmall: boolean | null = null;
  private labelReadout = '';
  private pending: { state: GameState; focusTile: number | undefined } | null = null;
  private justSwapped = false;
  private pinchStartZoom = 1;
  private pinchStartDistance = 0;
  private pinching = false;
  private cameraReadout = '';
  /**
   * The single-pointer press in progress, classified once when it ends; `pans` when it drags
   * the map, `consumed` when its release is not a tap.
   */
  private press: {
    x: number;
    y: number;
    at: number;
    moved: boolean;
    consumed: boolean;
    pans: boolean;
  } | null = null;
  /** The right-button press in progress and how far it dragged, in screen pixels. */
  private rightPress: { dx: number; dy: number } | null = null;
  private controls: MapControls = DEFAULT_MAP_CONTROLS;
  /** The held arrow keys (gfx.cpp _dirkeys), Shift, and the time of the last key scroll step. */
  private dirkeys = 0;
  private dirShift = false;
  private keyScrollAt: number | null = null;
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
    private readonly text: MapText,
  ) {
    super('map');
  }

  /** Re-reads the theme tokens for the town signs at the next update. */
  restyleLabels(): void {
    this.labelsSmall = null;
  }

  /** Swaps the world at the next update and centres on `focusTile` (or the map centre). */
  showGame(state: GameState, focusTile?: number): void {
    this.pending = { state, focusTile };
  }

  /** Applies OpenTTD's map control settings from the next press or wheel turn. */
  setControls(controls: MapControls): void {
    this.controls = controls;
  }

  /** Scrolls the map while arrow keys are held, as _dirkeys bits (window.cpp HandleKeyScrolling). */
  setDirKeys(dirkeys: number, shift: boolean): void {
    this.dirkeys = dirkeys;
    this.dirShift = shift;
    if (dirkeys === 0) this.keyScrollAt = null;
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

  /**
   * Starts every world at the normal zoom, centred on the focus tile (or the map), as OpenTTD
   * recreates its main window for a new game (genworld.cpp), and builds the town labels.
   */
  private resetView(focusTile: number | undefined): void {
    const { map, towns } = this.state;
    const camera = this.cameras.main;
    camera.setZoom(1);
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
        .text((tileY(map, town.xy) + 0.5) * TILE_PX, (tileX(map, town.xy) + 0.5) * TILE_PX, '')
        .setOrigin(0.5, 1)
        .setDepth(10000),
    );
    this.labelsSmall = null;
  }

  /**
   * Keeps every town sign at a constant screen size, like OpenTTD's viewport signs
   * (viewport.cpp ViewportDrawStrings), switching to the small sign far out.
   */
  private updateLabels(): void {
    const { zoom } = this.cameras.main;
    const small = isSmallLabel(zoom);
    const style = small === this.labelsSmall ? null : labelStyle(small);
    this.labelsSmall = small;
    this.state.towns.forEach((town, i) => {
      const label = this.labels[i];
      if (label === undefined) return;
      if (style !== null) label.setStyle(style);
      const text = this.text.townLabel(town, small);
      if (label.text !== text) label.setText(text);
      label.setScale(1 / zoom);
    });
    const first = this.labels[0];
    if (first === undefined) return;
    const height = String(Math.round(first.displayHeight * zoom));
    const readout = `${first.text}|${height}`;
    if (readout === this.labelReadout) return;
    this.labelReadout = readout;
    const game = document.getElementById('game');
    if (game === null) return;
    game.dataset['townLabel'] = first.text;
    game.dataset['townLabelHeight'] = height;
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

  /**
   * OpenTTD scrolls for held arrow keys on a 30 ms window timer; this runs the steps due since
   * the last frame, on the wall clock (a slow frame catches up, a hidden tab does not).
   */
  private keyScroll(now: number): void {
    if (this.dirkeys === 0) return;
    if (this.keyScrollAt === null || now - this.keyScrollAt > 10 * KEY_SCROLL_INTERVAL_MS) {
      this.keyScrollAt = now - KEY_SCROLL_INTERVAL_MS;
    }
    const camera = this.cameras.main;
    const [dx, dy] = keyScrollDelta(this.dirkeys, this.dirShift);
    while (now - this.keyScrollAt >= KEY_SCROLL_INTERVAL_MS) {
      this.keyScrollAt += KEY_SCROLL_INTERVAL_MS;
      camera.scrollX += dx / camera.zoom;
      camera.scrollY += dy / camera.zoom;
    }
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
    this.keyScroll(performance.now());
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

    this.updateLabels();
    this.publishCamera();

    if (this.justSwapped) {
      this.justSwapped = false;
      document.documentElement.dataset['gameReady'] = 'true';
    }
  }

  private setupInput(): void {
    const camera = this.cameras.main;
    this.input.addPointer(1);
    this.input.mouse?.disableContextMenu(); // the right button drags the map and drops tools

    const startPinch = (): void => {
      const { pointer1, pointer2 } = this.input;
      if (this.press !== null) this.press.moved = true; // a pinch is never a tap
      this.pinching = true;
      this.pinchStartZoom = camera.zoom;
      this.pinchStartDistance = Math.max(1, this.pointerDistance(pointer1, pointer2));
    };

    this.input.on('pointerdown', (pointer: Input.Pointer) => {
      const { pointer1, pointer2 } = this.input;
      // A right button pressed during a left-button build belongs to the build (R30).
      if (!pointer.wasTouch && pointer.button === 2 && this.build === null) {
        this.rightPress = { dx: 0, dy: 0 };
      }
      if (this.buildMode) {
        this.buildPointerDown(pointer, startPinch);
        return;
      }
      if (pointer1.isDown && pointer2.isDown) {
        startPinch();
        return;
      }
      const roles = idlePointerRoles({
        button: pointer.button,
        touch: pointer.wasTouch,
        scrollButton: scrollButton(this.controls.scrollMode),
      });
      if (!roles.tap && !roles.pan) return;
      this.press = {
        x: pointer.x,
        y: pointer.y,
        at: performance.now(),
        moved: false,
        consumed: !roles.tap,
        pans: roles.pan,
      };
      if (roles.pan) this.lockPointer(pointer);
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

    /** The end of a right-button press: a click drops the tool, as Esc does. */
    const rightPointerUp = (pointer: Input.Pointer): void => {
      if (pointer.wasTouch || pointer.button !== 2 || this.rightPress === null) return;
      const { dx, dy } = this.rightPress;
      this.rightPress = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= TAP_SLOP_PX) this.callbacks.onRightClick();
    };

    const buildPointerUp = (pointer: Input.Pointer): boolean => {
      const build = this.build;
      if (build === null || pointer.id !== build.pointerId) return false;
      if (!buildPressEnds(build, pointer)) return true; // another mouse button: not the build's
      this.build = null;
      this.sendBuild('end', build.press, this.ottdUnder(pointer), build.touch, pointer);
      return true;
    };
    // A drag released outside the canvas still ends, as OpenTTD builds on any mouse-up.
    this.input.on('pointerupoutside', (pointer: Input.Pointer) => {
      this.unlockPointer();
      this.rightPress = null;
      buildPointerUp(pointer);
    });

    this.input.on('pointerup', (pointer: Input.Pointer) => {
      if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) {
        this.pinching = false;
      }
      if (this.press?.pans === true) this.unlockPointer();
      rightPointerUp(pointer);
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
      // A locked pointer stays put and reports its movement instead (Pointer Lock API).
      const locked = this.input.mouse?.locked === true;
      const dx = locked ? pointer.movementX : pointer.x - pointer.prevPosition.x;
      const dy = locked ? pointer.movementY : pointer.y - pointer.prevPosition.y;
      if (this.rightPress !== null) {
        this.rightPress.dx += dx;
        this.rightPress.dy += dy;
      }
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
      if (this.pinching || !pointer.isDown || this.press?.pans !== true) return;
      // Port of window.cpp HandleViewportScroll: the map follows the mouse, or the viewport
      // does in VSM_VIEWPORT_RMB_FIXED. A finger always drags the map.
      const direction = pointer.wasTouch ? 1 : scrollDirection(this.controls.scrollMode);
      camera.scrollX -= (direction * dx) / camera.zoom;
      camera.scrollY -= (direction * dy) / camera.zoom;
    });

    // Port of window.cpp MouseLoop and main_gui.cpp OnMouseWheel for gui.scrollwheel_scrolling.
    this.input.on(
      'wheel',
      (pointer: Input.Pointer, _objects: unknown, deltaX: number, deltaY: number) => {
        const { wheel, wheelSpeed } = this.controls;
        if (wheel === 'zoom') {
          this.zoomAt(pointer.x, pointer.y, wheelZoom(camera.zoom, deltaY));
        } else if (wheel === 'scroll') {
          const [x, y] = wheelScrollDelta(deltaX, deltaY, wheelSpeed);
          camera.scrollX += x / camera.zoom;
          camera.scrollY += y / camera.zoom;
        }
      },
    );
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
      scrollButton: scrollButton(this.controls.scrollMode),
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
    } else if (action === 'pan') {
      // A pan: consumed up front, so its release is never a tap.
      const at = performance.now();
      this.press = { x: pointer.x, y: pointer.y, at, moved: true, consumed: true, pans: true };
      this.lockPointer(pointer);
    }
  }

  /** The "mouse position locked" scroll modes hold the cursor still while dragging the map. */
  private lockPointer(pointer: Input.Pointer): void {
    if (pointer.wasTouch || !scrollLocksPointer(this.controls.scrollMode)) return;
    this.input.mouse?.requestPointerLock();
  }

  private unlockPointer(): void {
    if (this.input.mouse?.locked === true) this.input.mouse.releasePointerLock();
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
