/** Industry types that exist in Stage 1 (ruling R6). */
export const IndustryType = { CoalMine: 0, PowerStation: 1 } as const;
export type IndustryType = (typeof IndustryType)[keyof typeof IndustryType];

/** Port of industry.h:IndustryTileLayoutTile (offset from the north tile, tile graphics). */
export interface LayoutTile {
  dx: number;
  dy: number;
  gfx: number;
}

export interface IndustrySpec {
  type: IndustryType;
  layouts: readonly (readonly LayoutTile[])[];
  /** The type that must be more than 14 tiles away. */
  conflicting: IndustryType;
  /** Initial production rate of the first produced cargo (0 when none). */
  productionRate: number;
}

/** Port of table/build_industry.h:MK. */
const mk = (dx: number, dy: number, gfx: number): LayoutTile => ({ dx, dy, gfx });

/** Port of table/build_industry.h:_origin_industry_specs (coal mine, power station; temperate). */
export const INDUSTRY_SPECS: readonly IndustrySpec[] = [
  {
    type: IndustryType.CoalMine,
    layouts: [
      [mk(1, 1, 0), mk(1, 2, 2), mk(0, 0, 5), mk(1, 0, 6), mk(2, 0, 3), mk(2, 2, 3)],
      [
        mk(1, 1, 0),
        mk(1, 2, 2),
        mk(2, 0, 0),
        mk(2, 1, 2),
        mk(1, 0, 3),
        mk(0, 0, 3),
        mk(0, 1, 4),
        mk(0, 2, 4),
        mk(2, 2, 4),
      ],
      [mk(0, 0, 0), mk(0, 1, 2), mk(0, 2, 5), mk(1, 0, 3), mk(1, 1, 3), mk(1, 2, 6)],
      [
        mk(0, 1, 0),
        mk(0, 2, 2),
        mk(0, 3, 4),
        mk(1, 0, 5),
        mk(1, 1, 0),
        mk(1, 2, 2),
        mk(1, 3, 3),
        mk(2, 0, 6),
        mk(2, 1, 4),
        mk(2, 2, 3),
      ],
    ],
    conflicting: IndustryType.PowerStation,
    productionRate: 15,
  },
  {
    type: IndustryType.PowerStation,
    layouts: [
      [
        mk(0, 0, 7),
        mk(0, 1, 9),
        mk(1, 0, 7),
        mk(1, 1, 8),
        mk(2, 0, 7),
        mk(2, 1, 8),
        mk(3, 0, 10),
        mk(3, 1, 10),
      ],
      [
        mk(0, 1, 7),
        mk(0, 2, 7),
        mk(1, 0, 8),
        mk(1, 1, 8),
        mk(1, 2, 7),
        mk(2, 0, 9),
        mk(2, 1, 10),
        mk(2, 2, 9),
      ],
      [mk(0, 0, 7), mk(0, 1, 7), mk(1, 0, 9), mk(1, 1, 8), mk(2, 0, 10), mk(2, 1, 9)],
    ],
    conflicting: IndustryType.CoalMine,
    productionRate: 0,
  },
];

/**
 * Temperate land industries with a creation chance (appear_creation[temperate] > 0), in OpenTTD's
 * type order (ruling R10). `stage1` is the Stage 1 type a pick places, or null (draw consumed).
 */
export const TEMPERATE_LAND_INDUSTRIES: readonly {
  openttdType: number;
  chance: number;
  scale1D: boolean;
  stage1: IndustryType | null;
}[] = [
  { openttdType: 0, chance: 8, scale1D: false, stage1: IndustryType.CoalMine }, // coal mine
  { openttdType: 1, chance: 5, scale1D: false, stage1: IndustryType.PowerStation }, // power station
  { openttdType: 2, chance: 5, scale1D: false, stage1: null }, // sawmill
  { openttdType: 3, chance: 5, scale1D: false, stage1: null }, // forest
  { openttdType: 4, chance: 4, scale1D: true, stage1: null }, // oil refinery (CHECK_REFINERY)
  { openttdType: 6, chance: 5, scale1D: false, stage1: null }, // factory
  { openttdType: 8, chance: 5, scale1D: false, stage1: null }, // steel mill
  { openttdType: 9, chance: 9, scale1D: false, stage1: null }, // farm
  { openttdType: 11, chance: 4, scale1D: false, stage1: null }, // oil wells
  { openttdType: 18, chance: 5, scale1D: false, stage1: null }, // iron ore mine
];

/** Port of industry.h:PRODLEVEL_DEFAULT. */
export const PRODLEVEL_DEFAULT = 0x10;
