/**
 * Viewport signs switch to the small font from 4× out of the normal zoom (viewport.cpp
 * ViewportAddKdtreeSigns: `dpi->zoom >= ZoomLevel::Out4x`); zoom 1 is OpenTTD's normal zoom.
 */
export const isSmallLabel = (zoom: number): boolean => zoom <= 0.25;

/** Sign font sizes in screen pixels, constant at every zoom (ViewportDrawStrings). */
export const LABEL_FONT_PX = { normal: 18, small: 13 } as const;
