import test from 'node:test';
import assert from 'node:assert/strict';
import { getExplorerLensGeometry } from './explorerLensGeometry.js';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
const viewport = (width, height) => ({ width, height });
const assertInside = (lens, view) => {
  assert.ok(Number.isFinite(lens.left) && Number.isFinite(lens.top));
  assert.ok(Number.isFinite(lens.diameter) && lens.diameter > 0);
  assert.ok(lens.left >= 0 && lens.top >= 0);
  assert.ok(lens.left + lens.diameter <= view.width + 1e-8);
  assert.ok(lens.top + lens.diameter <= view.height + 1e-8);
};
const assertOutside = (lens, source) => {
  assert.ok(lens.left >= source.right + 8 || lens.left + lens.diameter <= source.left - 8
    || lens.top >= source.bottom + 8 || lens.top + lens.diameter <= source.top - 8);
};

test('prefers the right side and aligns to the plot top, independent of its points', () => {
  const source = rect(40, 150, 440, 370);
  const view = viewport(1280, 800);
  const lens = getExplorerLensGeometry(source, view);
  assert.deepEqual(lens, { left: 448, top: 172, diameter: 196, side: 'right' });
  assertOutside(lens, source);
  assertInside(lens, view);
});

test('uses the left side when a full lens cannot fit to the right', () => {
  const source = rect(800, 160, 1230, 380);
  const view = viewport(1280, 800);
  const lens = getExplorerLensGeometry(source, view);
  assert.deepEqual(lens, { left: 596, top: 182, diameter: 196, side: 'left' });
  assertOutside(lens, source);
  assertInside(lens, view);
});

test('uses space below a full-width plot on a 390px viewport', () => {
  const source = rect(20, 150, 370, 430);
  const view = viewport(390, 844);
  const lens = getExplorerLensGeometry(source, view);
  assert.deepEqual(lens, { left: 174, top: 438, diameter: 196, side: 'below' });
  assertOutside(lens, source);
  assertInside(lens, view);
});

test('uses space above when the bottom and sides are blocked', () => {
  const source = rect(20, 420, 370, 830);
  const view = viewport(390, 844);
  const lens = getExplorerLensGeometry(source, view);
  assert.deepEqual(lens, { left: 174, top: 216, diameter: 196, side: 'above' });
  assertOutside(lens, source);
  assertInside(lens, view);
});

test('shrinks toward 144px to preserve external placement in a compact strip', () => {
  const source = rect(8, 8, 342, 392);
  const view = viewport(510, 400);
  const lens = getExplorerLensGeometry(source, view);
  assert.deepEqual(lens, { left: 350, top: 30, diameter: 152, side: 'right' });
  assertOutside(lens, source);
  assertInside(lens, view);
});

test('partially scrolled source bounds cannot push the lens outside the viewport', () => {
  const source = rect(-180, -120, 240, 240);
  const view = viewport(800, 600);
  const lens = getExplorerLensGeometry(source, view);
  assert.deepEqual(lens, { left: 248, top: 8, diameter: 196, side: 'right' });
  assertOutside(lens, source);
  assertInside(lens, view);
});

test('keeps right-side placement vertically bounded near the viewport bottom', () => {
  const source = rect(40, 680, 450, 940);
  const view = viewport(1280, 800);
  const lens = getExplorerLensGeometry(source, view);
  assert.equal(lens.top, 596);
  assert.equal(lens.side, 'right');
  assertOutside(lens, source);
  assertInside(lens, view);
});

test('uses a bounded fallback only when the visible source leaves no external strip', () => {
  const source = rect(-50, -20, 450, 870);
  const view = viewport(390, 844);
  const lens = getExplorerLensGeometry(source, view);
  assert.deepEqual(lens, { left: 186, top: 8, diameter: 196, side: 'fallback' });
  assertInside(lens, view);
});

test('even a small external strip is used before covering the source', () => {
  const source = rect(8, 8, 382, 720);
  const view = viewport(390, 844);
  const lens = getExplorerLensGeometry(source, view);
  assert.equal(lens.side, 'below');
  assert.equal(lens.diameter, 108);
  assertOutside(lens, source);
  assertInside(lens, view);
});

test('extreme viewport sizes always produce finite, positive, contained geometry', () => {
  for (const view of [viewport(390, 120), viewport(90, 90), viewport(15, 12), viewport(1, 1)]) {
    const lens = getExplorerLensGeometry(rect(-100, -100, 1000, 1000), view);
    assertInside(lens, view);
    assert.ok(lens.diameter <= 196);
  }
});
