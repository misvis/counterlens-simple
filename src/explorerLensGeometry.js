const PREFERRED_DIAMETER = 196;
const COMPACT_DIAMETER = 144;
const VIEWPORT_PADDING = 8;
const SOURCE_GAP = 8;
const SOURCE_TOP_OFFSET = 22;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

/** Place a circular lens outside the visible source plot whenever space exists. */
export function getExplorerLensGeometry(rect, viewport) {
  const viewportWidth = Math.max(1, finite(viewport?.width, 1));
  const viewportHeight = Math.max(1, finite(viewport?.height, 1));
  // Retain a usable bound even when a viewport is smaller than both paddings.
  const padX = Math.min(VIEWPORT_PADDING, (viewportWidth - 1) / 2);
  const padY = Math.min(VIEWPORT_PADDING, (viewportHeight - 1) / 2);
  const page = { left: padX, top: padY, right: viewportWidth - padX, bottom: viewportHeight - padY };
  const pageWidth = page.right - page.left;
  const pageHeight = page.bottom - page.top;
  const preferred = Math.min(PREFERRED_DIAMETER, pageWidth, pageHeight);
  const compact = Math.min(COMPACT_DIAMETER, preferred);

  const rawLeft = finite(rect?.left, 0);
  const rawTop = finite(rect?.top, 0);
  const rawRight = finite(rect?.right, rawLeft + Math.max(0, finite(rect?.width, 0)));
  const rawBottom = finite(rect?.bottom, rawTop + Math.max(0, finite(rect?.height, 0)));
  const visible = {
    left: clamp(Math.min(rawLeft, rawRight), page.left, page.right),
    top: clamp(Math.min(rawTop, rawBottom), page.top, page.bottom),
    right: clamp(Math.max(rawLeft, rawRight), page.left, page.right),
    bottom: clamp(Math.max(rawTop, rawBottom), page.top, page.bottom),
  };
  // Four rectangular strips suffice; no cohort-point scan or pointer-dependent
  // candidate search is needed. A fixed position keeps the lens easy to enter.
  const spaces = [
    { side: 'right', capacity: Math.min(page.right - visible.right - SOURCE_GAP, pageHeight) },
    { side: 'left', capacity: Math.min(visible.left - page.left - SOURCE_GAP, pageHeight) },
    { side: 'below', capacity: Math.min(page.bottom - visible.bottom - SOURCE_GAP, pageWidth) },
    { side: 'above', capacity: Math.min(visible.top - page.top - SOURCE_GAP, pageWidth) },
  ];
  let choice = spaces.find(space => space.capacity >= preferred);
  let diameter = preferred;
  if (!choice) {
    choice = spaces.find(space => space.capacity >= compact);
    if (choice) diameter = Math.min(preferred, choice.capacity);
  }
  if (!choice) {
    // Prefer a smaller external lens over obscuring the source. This also
    // handles short/very narrow viewports and partially visible source plots.
    choice = spaces.reduce((best, space) => space.capacity > (best?.capacity ?? 0) ? space : best, null);
    if (choice) diameter = Math.min(preferred, choice.capacity);
  }
  if (choice) {
    if (choice.side === 'right' || choice.side === 'left') {
      return {
        left: choice.side === 'right' ? visible.right + SOURCE_GAP : visible.left - SOURCE_GAP - diameter,
        top: clamp(rawTop + SOURCE_TOP_OFFSET, page.top, page.bottom - diameter),
        diameter,
        side: choice.side,
      };
    }
    return {
      left: clamp(visible.right - diameter, page.left, page.right - diameter),
      top: choice.side === 'below' ? visible.bottom + SOURCE_GAP : visible.top - SOURCE_GAP - diameter,
      diameter,
      side: choice.side,
    };
  }

  // Only a source filling all available strips reaches this case. Put the
  // bounded lens at the corner farthest from the visible source's center.
  const sourceX = (visible.left + visible.right) / 2;
  const sourceY = (visible.top + visible.bottom) / 2;
  const corners = [
    { left: page.right - diameter, top: page.top },
    { left: page.right - diameter, top: page.bottom - diameter },
    { left: page.left, top: page.top },
    { left: page.left, top: page.bottom - diameter },
  ];
  const distance = corner => (corner.left + diameter / 2 - sourceX) ** 2 + (corner.top + diameter / 2 - sourceY) ** 2;
  const position = corners.reduce((best, corner) => distance(corner) > distance(best) ? corner : best);
  return { ...position, diameter, side: 'fallback' };
}
