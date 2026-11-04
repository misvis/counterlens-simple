const PREFERRED_DIAMETER = 196;
const VIEWPORT_PADDING = 8;
const SOURCE_GAP = 9;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Points are sorted by x once per plot. Inspect only the vertical strip
// intersecting the source circle, returning the original point references.
export function getExplorerLensNeighbors(points, focus, radius) {
  let low = 0, high = points.length;
  const left = focus.x - radius, right = focus.x + radius;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].x < left) low = mid + 1;
    else high = mid;
  }
  const neighbors = [];
  const squaredRadius = radius * radius;
  for (let index = low; index < points.length && points[index].x <= right; index++) {
    const point = points[index];
    if ((point.x - focus.x) ** 2 + (point.y - focus.y) ** 2 <= squaredRadius) neighbors.push(point);
  }
  return neighbors;
}

// Keep the popup tangent to the sampled region. The scale converts the SVG
// sampling radius to screen pixels if a panel is rendered at a different size.
export function getExplorerLensGeometry(focus, viewport, zoom = 4, scale = 1, previousSide, preferredDiameter = PREFERRED_DIAMETER) {
  const { width, height } = viewport;
  const padX = Math.min(VIEWPORT_PADDING, (width - 1) / 2);
  const padY = Math.min(VIEWPORT_PADDING, (height - 1) / 2);
  const preferred = Math.min(preferredDiameter, width - 2 * padX, height - 2 * padY);
  const available = [
    ['right', width - padX - focus.x],
    ['left', focus.x - padX],
    ['below', height - padY - focus.y],
    ['above', focus.y - padY],
  ];
  // The source circle grows with the popup, so reserve room for both.
  const capacity = space => Math.floor((space - SOURCE_GAP + 2 * scale / zoom) / (1 + scale / (2 * zoom)));
  const fitting = available.filter(([, space]) => capacity(space) >= preferred);
  const [side, space] = fitting.find(([name]) => name === previousSide) ?? fitting[0]
    ?? available.reduce((best, entry) => entry[1] > best[1] ? entry : best);
  const diameter = Math.max(1, Math.min(preferred, capacity(space)));
  const radius = Math.max(0, (diameter / 2 - 2) / zoom);
  const gap = radius * scale + SOURCE_GAP;
  let left = focus.x - diameter / 2;
  let top = focus.y - diameter / 2;
  if (side === 'right') left = focus.x + gap;
  if (side === 'left') left = focus.x - gap - diameter;
  if (side === 'below') top = focus.y + gap;
  if (side === 'above') top = focus.y - gap - diameter;
  left = clamp(left, padX, width - padX - diameter);
  top = clamp(top, padY, height - padY - diameter);
  return { left, top, diameter, side, radius };
}

// Freeze the source while crossing from it into the interactive popup.
// Allow a widening approach so the user can aim at points off its center.
export function approachesExplorerLens(pointer, focus, popup) {
  const dx = popup.left + popup.diameter / 2 - focus.x;
  const dy = popup.top + popup.diameter / 2 - focus.y;
  const length = Math.hypot(dx, dy);
  if (!length) return false;
  const x = pointer.x - focus.x, y = pointer.y - focus.y;
  const along = (x * dx + y * dy) / length;
  const across = Math.abs(x * dy - y * dx) / length;
  return along > 0 && along <= length && across <= 2 + along * popup.diameter / (2 * length);
}
