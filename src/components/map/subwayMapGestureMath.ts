/**
 * Pure geometry helpers for the interactive subway map.
 *
 * Every exported function is tagged `'worklet'` so it can run on the
 * reanimated UI thread (called from Gesture callbacks and useAnimatedStyle).
 * In jest the directive is inert, so these run as plain JS and are unit-tested.
 *
 * Coordinate model (top-left origin): screen = content * scale + translate.
 * RN 0.72 has no `transformOrigin`, so `toTransform` re-adds the center-origin
 * compensation term the native transform introduces.
 */

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3.0;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const clampScale = (value: number): number => {
  'worklet';
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
};

const clampAxis = (
  translate: number,
  scaledLength: number,
  viewportLength: number,
): number => {
  'worklet';
  if (scaledLength <= viewportLength) {
    // Content narrower than the viewport → center it.
    return (viewportLength - scaledLength) / 2;
  }
  // Content wider → keep it covering the viewport (no empty gutters).
  const min = viewportLength - scaledLength;
  const max = 0;
  return Math.min(Math.max(translate, min), max);
};

export const clampTranslate = (
  translate: Vec2,
  scale: number,
  content: Size,
  viewport: Size,
): Vec2 => {
  'worklet';
  return {
    x: clampAxis(translate.x, content.width * scale, viewport.width),
    y: clampAxis(translate.y, content.height * scale, viewport.height),
  };
};

export const focalZoom = (
  focal: Vec2,
  prevScale: number,
  nextScale: number,
  prevTranslate: Vec2,
): Vec2 => {
  'worklet';
  const ratio = nextScale / prevScale;
  return {
    x: focal.x - (focal.x - prevTranslate.x) * ratio,
    y: focal.y - (focal.y - prevTranslate.y) * ratio,
  };
};

export const toTransform = (
  scale: number,
  translate: Vec2,
  content: Size,
): ReadonlyArray<{ translateX: number } | { translateY: number } | { scale: number }> => {
  'worklet';
  // RN scales about the view center; convert the top-left-origin translate
  // into the array RN needs by subtracting (size/2)*(1-scale).
  return [
    { translateX: translate.x - (content.width / 2) * (1 - scale) },
    { translateY: translate.y - (content.height / 2) * (1 - scale) },
    { scale },
  ];
};
