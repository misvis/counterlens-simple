import test from 'node:test';
import assert from 'node:assert/strict';
import { getExplorerLensGeometry, getExplorerLensNeighbors, nearestExplorerPoint } from './explorerLensGeometry.js';

const desktop = { width: 1280, height: 800 };
const phone = { width: 390, height: 844 };

test('an overlapping hit area only breaks ties between equally near centers', () => {
  const s56 = { record: { id: 'S56' }, x: 470, y: 360 };
  const s112 = { record: { id: 'S112' }, x: 470, y: 375.25 };
  for (const points of [[s56, s112], [s112, s56]]) {
    assert.equal(nearestExplorerPoint(points, { x: 470, y: 364 }, 'S112'), s56);
    assert.equal(nearestExplorerPoint(points, { x: 470, y: 371 }, 'S56'), s112);
    assert.equal(nearestExplorerPoint(points, { x: 470, y: 367.625 }, 'S112'), s112);
  }
});

test('the neighborhood preserves coincident marks and includes all sides of the source circle', () => {
  const points = [[-6, 0], [-5, 0], [-3, 4], [0, 0], [0, 0], [0, 6], [5, 0], [6, 0]]
    .map(([x, y]) => ({ x, y }));
  const nearby = getExplorerLensNeighbors(points, { x: 0, y: 0 }, 5);
  assert.deepEqual(nearby, [points[1], points[2], points[3], points[4], points[6]]);
  assert.deepEqual(getExplorerLensNeighbors(points, { x: 100, y: 100 }, 5), []);
});
const assertInside = (lens, view) => {
  assert.ok(Number.isFinite(lens.left) && Number.isFinite(lens.top));
  assert.ok(Number.isFinite(lens.diameter) && lens.diameter > 0);
  assert.ok(lens.left >= 0 && lens.top >= 0);
  assert.ok(lens.left + lens.diameter <= view.width + 1e-8);
  assert.ok(lens.top + lens.diameter <= view.height + 1e-8);
};

test('positions the lens beside the sampled focus and centers it vertically', () => {
  const lens = getExplorerLensGeometry({ x: 320, y: 300 }, desktop);
  assert.equal(lens.side, 'right');
  assert.equal(lens.diameter, 196);
  assert.equal(lens.left - 320 - lens.radius, 9);
  assert.equal(lens.top + lens.diameter / 2, 300);
  const moved = getExplorerLensGeometry({ x: 340, y: 330 }, desktop);
  assert.equal(moved.left, lens.left + 20);
  assert.equal(moved.top, lens.top + 30);
});

test('uses the left side near the right edge', () => {
  const lens = getExplorerLensGeometry({ x: 1250, y: 300 }, desktop);
  assert.equal(lens.side, 'left');
  assert.equal(1250 - lens.radius - (lens.left + lens.diameter), 9);
  assertInside(lens, desktop);
});

test('fits a full-size lens below and above a central mobile focus', () => {
  for (const [y, expected] of [[180, 'below'], [700, 'above']]) {
    const lens = getExplorerLensGeometry({ x: 195, y }, phone);
    assert.equal(lens.side, expected);
    assert.equal(lens.diameter, 196);
    assert.equal(lens.left + lens.diameter / 2, 195);
    const nearestY = expected === 'below' ? lens.top : lens.top + lens.diameter;
    assert.equal(Math.abs(nearestY - y) - lens.radius, 9);
    assertInside(lens, phone);
  }
});

test('retains the current side while the full lens still fits there', () => {
  const focus = { x: 600, y: 400 };
  assert.equal(getExplorerLensGeometry(focus, desktop, 4, 1, 'left').side, 'left');
  assert.equal(getExplorerLensGeometry({ x: 20, y: 400 }, desktop, 4, 1, 'left').side, 'right');
});

test('reserves the screen-space source radius on scaled plots and for larger comparisons', () => {
  const lens = getExplorerLensGeometry({ x: 320, y: 300 }, desktop, 4, 1.5, 'right', 220);
  assert.equal(lens.diameter, 220);
  assert.equal(lens.left - 320 - lens.radius * 1.5, 9);
});

test('shrinks a lens only when it cannot fit beside the source at full size', () => {
  const view = { width: 300, height: 300 };
  const lens = getExplorerLensGeometry({ x: 150, y: 150 }, view);
  assert.ok(lens.diameter < 196 && lens.diameter > 100);
  assert.equal(lens.left - 150 - lens.radius, 9);
  assertInside(lens, view);
});

test('bounds the popup even when an edge focus needs an off-axis connector', () => {
  for (const y of [2, 798]) {
    const lens = getExplorerLensGeometry({ x: 150, y }, desktop);
    assert.equal(lens.side, 'right');
    assertInside(lens, desktop);
  }
});

test('a viewport too small to use still returns contained finite geometry', () => {
  for (const view of [{ width: 90, height: 90 }, { width: 1, height: 1 }]) {
    assertInside(getExplorerLensGeometry({ x: view.width / 2, y: view.height / 2 }, view), view);
  }
});
