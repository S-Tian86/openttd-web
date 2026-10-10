import { Math as PMath, Scene, type Input, type Tilemaps } from 'phaser';
import { takeDirtyTiles, type GameState } from '../sim/game';
import { tileX, tileXY, tileY } from '../sim/map/map';
import { pinchZoom, wheelZoom } from './camera';
import { groundSprite } from './ground';
import {
  CHUNK_TILES,
  TILE_PX,
  chunkCellToTile,
  tileToChunkCell,
  visibleChunks,
} from './projection';
import { resolveSprite, SPRITE_IDS, type Theme } from './theme';

interface Chunk {
  map: Tilemaps.Tilemap;
  layer: Tilemaps.TilemapLayer;
}

const CHUNK_PX = CHUNK_TILES * TILE_PX;

/** Draws the ground layer in 32×32-tile chunks, keeping only the visible ones alive. */
export class MapScene extends Scene {
  private readonly chunks = new Map<string, Chunk>();
  private firstFrameDone = false;
  private pinchStartZoom = 1;
  private pinchStartDistance = 0;
  private pinching = false;
  private cameraReadout = '';

  constructor(
    private readonly state: GameState,
    private readonly theme: Theme,
    private readonly fallback: Theme,
    private readonly themeBase: string,
    private readonly fallbackBase: string,
  ) {
    super('map');
  }

  preload(): void {
    for (const id of SPRITE_IDS) {
      const base = this.theme.sprites[id] === undefined ? this.fallbackBase : this.themeBase;
      this.load.svg(id, base + resolveSprite(this.theme, this.fallback, id), {
        width: TILE_PX,
        height: TILE_PX,
      });
    }
  }

  create(): void {
    const atlas = this.textures.createCanvas('ground-atlas', TILE_PX * SPRITE_IDS.length, TILE_PX);
    if (atlas === null) throw new Error('Cannot create the ground atlas');
    SPRITE_IDS.forEach((id, i) => {
      atlas.context.drawImage(
        this.textures.get(id).getSourceImage() as CanvasImageSource,
        i * TILE_PX,
        0,
        TILE_PX,
        TILE_PX,
      );
    });
    atlas.refresh();

    const { sizeX, sizeY } = this.state.map;
    const camera = this.cameras.main;
    camera.setBounds(0, 0, sizeY * TILE_PX, sizeX * TILE_PX);
    camera.centerOn((sizeY * TILE_PX) / 2, (sizeX * TILE_PX) / 2);
    this.setupInput();
  }

  override update(): void {
    const { map } = this.state;
    const wanted = visibleChunks(this.cameras.main.worldView, map.sizeX, map.sizeY);
    const wantedKeys = new Set<string>();
    for (const { col, row } of wanted) {
      const key = `${col},${row}`;
      wantedKeys.add(key);
      if (!this.chunks.has(key)) this.chunks.set(key, this.buildChunk(col, row));
    }
    for (const [key, chunk] of this.chunks) {
      if (wantedKeys.has(key)) continue;
      chunk.map.destroy();
      this.chunks.delete(key);
    }

    for (const t of takeDirtyTiles(this.state)) {
      const { col, row, cx, cy } = tileToChunkCell(tileX(map, t), tileY(map, t));
      this.chunks
        .get(`${col},${row}`)
        ?.layer.putTileAt(SPRITE_IDS.indexOf(groundSprite(map, t)), cx, cy);
    }

    this.publishCamera();

    if (!this.firstFrameDone) {
      this.firstFrameDone = true;
      document.documentElement.dataset['gameReady'] = 'true';
    }
  }

  private setupInput(): void {
    const camera = this.cameras.main;
    this.input.addPointer(1);

    this.input.on('pointerdown', () => {
      const { pointer1, pointer2 } = this.input;
      if (pointer1.isDown && pointer2.isDown) {
        this.pinching = true;
        this.pinchStartZoom = camera.zoom;
        this.pinchStartDistance = Math.max(1, this.pointerDistance(pointer1, pointer2));
      }
    });

    this.input.on('pointerup', () => {
      if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) {
        this.pinching = false;
      }
    });

    this.input.on('pointermove', (pointer: Input.Pointer) => {
      const { pointer1, pointer2 } = this.input;
      if (this.pinching && pointer1.isDown && pointer2.isDown) {
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
        layer.putTileAt(SPRITE_IDS.indexOf(groundSprite(this.state.map, t)), cx, cy);
      }
    }
    return { map, layer };
  }
}
