/**
 * Stage 1 world settings: OpenTTD 15.3 defaults that the new-game window does not expose.
 * Sources: table/settings/world_settings.ini, difficulty_settings.ini, economy_settings.ini.
 */
export const WORLD = {
  /** difficulty.terrain_type: 1 = Flat. */
  terrainType: 1,
  /** game_creation.tgen_smoothness: 1 = Smooth. */
  smoothness: 1,
  /** difficulty.quantity_sea_lakes: 0 = Very low. */
  quantitySeaLakes: 0,
  /** construction.map_height_limit, fixed for Stage 1 (ruling R2; "auto" gives 30 on maps up to 1024²). */
  mapHeightLimit: 30,
  /** economy.larger_towns: one town in four is a city. */
  largerTowns: 4,
  /** economy.initial_city_size. */
  initialCitySize: 2,
  /** construction.industry_platform. */
  industryPlatform: 1,
} as const;
