import { Scene, type Tilemaps } from 'phaser';
import { takeDirtyTiles, type GameState } from '../sim/game';
import { tileXY } from '../sim/map/map';
import { groundSprite } from './ground';
import { CHUNK_TILES, TILE_PX, visibleChunks } from './projection';
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
      const x = t & (map.sizeX - 1);
      const y = t >>> map.logX;
      const chunk = this.chunks.get(
        `${Math.floor(y / CHUNK_TILES)},${Math.floor(x / CHUNK_TILES)}`,
      );
      chunk?.layer.putTileAt(
        SPRITE_IDS.indexOf(groundSprite(map, t)),
        y % CHUNK_TILES,
        x % CHUNK_TILES,
      );
    }

    if (!this.firstFrameDone) {
      this.firstFrameDone = true;
      document.documentElement.dataset['gameReady'] = 'true';
    }
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
        const t = tileXY(this.state.map, col * CHUNK_TILES + cx, row * CHUNK_TILES + cy);
        layer.putTileAt(SPRITE_IDS.indexOf(groundSprite(this.state.map, t)), cx, cy);
      }
    }
    return { map, layer };
  }
}
