export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const wheelZoom = (zoom: number, deltaY: number): number =>
  clampZoom(zoom * Math.pow(1.2, -deltaY / 100));

export const pinchZoom = (startZoom: number, startDistance: number, distance: number): number =>
  clampZoom((startZoom * distance) / startDistance);
