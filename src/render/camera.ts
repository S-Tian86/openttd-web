export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const wheelZoom = (zoom: number, deltaY: number): number =>
  clampZoom(zoom * Math.pow(1.2, -deltaY / 100));

export const pinchZoom = (startZoom: number, startDistance: number, distance: number): number =>
  clampZoom((startZoom * distance) / startDistance);

/**
 * Port of viewport.cpp ClampViewportToMap with landscape.cpp InverseRemapCoords2(clamp_to_map):
 * the centre of the view stays over the map, from its first edge up to the corner of the last
 * (void) tile, so every edge can be scrolled into view past any bar or window drawn over the
 * map. A Phaser camera's centre is `scroll + viewSize / 2` at any zoom. The extra rows OpenTTD
 * allows at the north for tall terrain are not ported: the top-down view draws no height.
 */
export const clampScrollToMap = (
  scroll: number,
  viewSize: number,
  mapTiles: number,
  tilePx: number,
): number => Math.min(Math.max(scroll, -viewSize / 2), (mapTiles - 1) * tilePx - viewSize / 2);
