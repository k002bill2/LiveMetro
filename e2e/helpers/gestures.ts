/**
 * Gesture helpers for E2E testing
 * Cross-platform swipe, scroll, and tap utilities
 */
import { browser } from '@wdio/globals';

/**
 * Swipe direction options
 */
export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Coordinates for gestures
 */
interface Coordinates {
  x: number;
  y: number;
}

/**
 * Perform a swipe gesture
 * @param direction - Direction to swipe
 * @param percentage - How far to swipe (0-1)
 * @param speed - Duration of swipe in ms
 */
export async function swipe(
  direction: SwipeDirection,
  percentage = 0.5,
  speed = 500
): Promise<void> {
  const { width, height } = await browser.getWindowSize();
  const centerX = width / 2;
  const centerY = height / 2;

  let start: Coordinates;
  let end: Coordinates;

  switch (direction) {
    case 'up':
      start = { x: centerX, y: height * 0.7 };
      end = { x: centerX, y: height * (0.7 - percentage) };
      break;
    case 'down':
      start = { x: centerX, y: height * 0.3 };
      end = { x: centerX, y: height * (0.3 + percentage) };
      break;
    case 'left':
      start = { x: width * 0.8, y: centerY };
      end = { x: width * (0.8 - percentage), y: centerY };
      break;
    case 'right':
      start = { x: width * 0.2, y: centerY };
      end = { x: width * (0.2 + percentage), y: centerY };
      break;
  }

  await browser.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: start.x, y: start.y },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: speed, x: end.x, y: end.y },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
}

/**
 * Swipe on a specific element
 * @param element - Element to swipe on
 * @param direction - Direction to swipe
 * @param percentage - How far to swipe (0-1)
 */
export async function swipeOnElement(
  element: WebdriverIO.Element,
  direction: SwipeDirection,
  percentage = 0.5
): Promise<void> {
  const location = await element.getLocation();
  const size = await element.getSize();

  const centerX = location.x + size.width / 2;
  const centerY = location.y + size.height / 2;

  let start: Coordinates;
  let end: Coordinates;

  switch (direction) {
    case 'up':
      start = { x: centerX, y: location.y + size.height * 0.8 };
      end = { x: centerX, y: location.y + size.height * (0.8 - percentage) };
      break;
    case 'down':
      start = { x: centerX, y: location.y + size.height * 0.2 };
      end = { x: centerX, y: location.y + size.height * (0.2 + percentage) };
      break;
    case 'left':
      start = { x: location.x + size.width * 0.8, y: centerY };
      end = { x: location.x + size.width * (0.8 - percentage), y: centerY };
      break;
    case 'right':
      start = { x: location.x + size.width * 0.2, y: centerY };
      end = { x: location.x + size.width * (0.2 + percentage), y: centerY };
      break;
  }

  await browser.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: start.x, y: start.y },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 500, x: end.x, y: end.y },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
}

/**
 * Tap at specific coordinates
 * @param x - X coordinate
 * @param y - Y coordinate
 */
export async function tapAt(x: number, y: number): Promise<void> {
  await browser.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 100 },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
}

/**
 * Long press at specific coordinates
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param duration - Press duration in ms
 */
export async function longPressAt(
  x: number,
  y: number,
  duration = 1000
): Promise<void> {
  await browser.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
}

/**
 * Long press on element
 * @param element - Element to long press
 * @param duration - Press duration in ms
 */
export async function longPressElement(
  element: WebdriverIO.Element,
  duration = 1000
): Promise<void> {
  const location = await element.getLocation();
  const size = await element.getSize();

  const centerX = location.x + size.width / 2;
  const centerY = location.y + size.height / 2;

  await longPressAt(centerX, centerY, duration);
}

/**
 * Pinch gesture (zoom out)
 * @param scale - Scale factor (0-1)
 */
export async function pinch(scale = 0.5): Promise<void> {
  const { width, height } = await browser.getWindowSize();
  const centerX = width / 2;
  const centerY = height / 2;
  const offset = Math.min(width, height) * 0.3;

  await browser.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: centerX - offset, y: centerY },
        { type: 'pointerDown', button: 0 },
        {
          type: 'pointerMove',
          duration: 500,
          x: centerX - offset * scale,
          y: centerY,
        },
        { type: 'pointerUp', button: 0 },
      ],
    },
    {
      type: 'pointer',
      id: 'finger2',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: centerX + offset, y: centerY },
        { type: 'pointerDown', button: 0 },
        {
          type: 'pointerMove',
          duration: 500,
          x: centerX + offset * scale,
          y: centerY,
        },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
}

/**
 * Zoom gesture (zoom in)
 * @param scale - Scale factor (1+)
 */
export async function zoom(scale = 1.5): Promise<void> {
  const { width, height } = await browser.getWindowSize();
  const centerX = width / 2;
  const centerY = height / 2;
  const startOffset = Math.min(width, height) * 0.1;
  const endOffset = startOffset * scale;

  await browser.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        {
          type: 'pointerMove',
          duration: 0,
          x: centerX - startOffset,
          y: centerY,
        },
        { type: 'pointerDown', button: 0 },
        {
          type: 'pointerMove',
          duration: 500,
          x: centerX - endOffset,
          y: centerY,
        },
        { type: 'pointerUp', button: 0 },
      ],
    },
    {
      type: 'pointer',
      id: 'finger2',
      parameters: { pointerType: 'touch' },
      actions: [
        {
          type: 'pointerMove',
          duration: 0,
          x: centerX + startOffset,
          y: centerY,
        },
        { type: 'pointerDown', button: 0 },
        {
          type: 'pointerMove',
          duration: 500,
          x: centerX + endOffset,
          y: centerY,
        },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
}

/**
 * Double tap at coordinates
 * @param x - X coordinate
 * @param y - Y coordinate
 */
export async function doubleTapAt(x: number, y: number): Promise<void> {
  await browser.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 50 },
        { type: 'pointerUp', button: 0 },
        { type: 'pause', duration: 100 },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 50 },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
}

/**
 * Double tap on element
 * @param element - Element to double tap
 */
export async function doubleTapElement(
  element: WebdriverIO.Element
): Promise<void> {
  const location = await element.getLocation();
  const size = await element.getSize();

  const centerX = location.x + size.width / 2;
  const centerY = location.y + size.height / 2;

  await doubleTapAt(centerX, centerY);
}
