import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getDecision } from '../shared/admissionModel.js';
import { getExplorerLensGeometry } from './explorerLensGeometry.js';
import './explorer-point-lens.css';

const ZOOM = 4;
const OPEN_DELAY = 300;
const LEAVE_DELAY = 240;
// Only the active or pending lens installs document listeners.
let dismissActiveLens = null;
let activeLensId = null;
const COPY = {
  en: { detail: 'Point detail', admitted: 'Admitted', rejected: 'Not admitted', cutoff: 'Current cutoff' },
  zh: { detail: '数据点详情', admitted: '录取', rejected: '未录取', cutoff: '当前录取线' },
  es: { detail: 'Detalle de puntos', admitted: 'Admitido', rejected: 'No admitido', cutoff: 'Corte actual' },
};
const coordinate = (value, domain, start, length) => start + (value - domain[0]) / (domain[1] - domain[0]) * length;
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// Hover updates only this component, leaving the original SVG marks untouched.
export function ExplorerPointLens({ svgRef, panelId, panelLabel, records = [], width, height = 220,
  margin = { left: 43, right: 16, top: 22, bottom: 42 }, domains, boundary,
  selectedStudentId, policy, colors, isLight, lang = 'en', onSelect, disabled = false }) {
  const t = COPY[lang] || COPY.en;
  const clipId = useId().replace(/:/g, '');
  const portalRef = useRef(null);
  const sourceElement = useRef(null);
  const suppressFocus = useRef(false);
  const openTimer = useRef(null);
  const leaveTimer = useRef(null);
  const focusFrame = useRef(null);
  const pointerFrame = useRef(null);
  const pendingPointer = useRef(null);
  const latestAnchor = useRef(null);
  const sessionRef = useRef(null);
  const measuredGeometry = useRef(null);
  const removeGlobalListeners = useRef(null);
  const [session, setSession] = useState(null);
  const [inspectedId, setInspectedId] = useState(null);
  const { left, right, top, bottom } = margin;
  const [gpaMin, gpaMax] = domains.gpa;
  const [satMin, satMax] = domains.sat;
  const points = useMemo(() => records.filter(record => Number.isFinite(record.gpa) && Number.isFinite(record.sat)).map(record => ({
    record,
    x: coordinate(record.gpa, [gpaMin, gpaMax], left, width - left - right),
    y: coordinate(record.sat, [satMin, satMax], height - bottom, -(height - top - bottom)),
    admitted: getDecision(record, policy),
  })), [records, policy, gpaMin, gpaMax, satMin, satMax, left, right, top, bottom, width, height]);

  const cancelPointerFrame = useCallback(() => {
    cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = null;
    pendingPointer.current = null;
  }, []);
  const dismiss = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(leaveTimer.current);
    cancelAnimationFrame(focusFrame.current);
    cancelPointerFrame();
    openTimer.current = null;
    leaveTimer.current = null;
    focusFrame.current = null;
    latestAnchor.current = null;
    measuredGeometry.current = null;
    sessionRef.current = null;
    setSession(null);
    setInspectedId(null);
    removeGlobalListeners.current?.();
    removeGlobalListeners.current = null;
    if (activeLensId === clipId) {
      dismissActiveLens = null;
      activeLensId = null;
    }
  }, [cancelPointerFrame, clipId]);
  const keepOpen = useCallback(() => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const scheduleLeave = useCallback(() => {
    cancelPointerFrame();
    clearTimeout(openTimer.current);
    openTimer.current = null;
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(dismiss, LEAVE_DELAY);
  }, [cancelPointerFrame, dismiss]);

  useEffect(() => {
    const svg = svgRef.current;
    // Switching to a drag tears down the previous effect and its pending lens.
    if (!svg || disabled) return undefined;
    const activate = () => {
      if (dismissActiveLens && activeLensId !== clipId) dismissActiveLens();
      dismissActiveLens = dismiss;
      activeLensId = clipId;
      if (removeGlobalListeners.current) return;
      const outsideScroll = event => {
        if (!portalRef.current?.contains(event.target)) dismiss();
      };
      const outsidePointer = event => {
        // Grabbing a source point or cutoff must also clear the lens before
        // the drag captures the pointer. Clicks inside the lens still select.
        if (!portalRef.current?.contains(event.target)) dismiss();
      };
      const escape = event => {
        if (event.key !== 'Escape') return;
        const restore = portalRef.current?.contains(document.activeElement) && sourceElement.current?.isConnected;
        dismiss();
        if (restore) {
          suppressFocus.current = true;
          sourceElement.current.focus({ preventScroll: true });
        }
      };
      window.addEventListener('resize', dismiss);
      document.addEventListener('scroll', outsideScroll, true);
      document.addEventListener('pointerdown', outsidePointer, true);
      document.addEventListener('keydown', escape, true);
      removeGlobalListeners.current = () => {
        window.removeEventListener('resize', dismiss);
        document.removeEventListener('scroll', outsideScroll, true);
        document.removeEventListener('pointerdown', outsidePointer, true);
        document.removeEventListener('keydown', escape, true);
      };
    };
    const measure = () => {
      if (measuredGeometry.current) return measuredGeometry.current;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const scrollport = svg.closest('.fex-matrix-viewport');
      const clip = scrollport?.getBoundingClientRect();
      const visible = clip ? {
        left: Math.max(rect.left, clip.left + scrollport.clientLeft),
        right: Math.min(rect.right, clip.left + scrollport.clientLeft + scrollport.clientWidth),
        top: Math.max(rect.top, clip.top + scrollport.clientTop),
        bottom: Math.min(rect.bottom, clip.top + scrollport.clientTop + scrollport.clientHeight),
      } : rect;
      const popup = getExplorerLensGeometry(visible, { width: window.innerWidth, height: window.innerHeight });
      if (popup.diameter < 24) return null;
      const chartSize = popup.diameter - 2;
      return { rect, popup, chartSize, radius: (chartSize / 2 - 1) / ZOOM };
    };
    const commit = anchor => {
      sessionRef.current = anchor;
      setSession(anchor);
      setInspectedId(null);
    };
    const prepare = (point, geometry, immediate = false) => {
      if (!points.some(candidate => distanceSquared(candidate, point) <= geometry.radius ** 2)) {
        // Briefly retain the last neighborhood across the gap to the lens.
        scheduleLeave();
        return;
      }
      keepOpen();
      activate();
      // Cache only after activation installs scroll/resize invalidation.
      measuredGeometry.current = geometry;
      const anchor = { point, ...geometry };
      latestAnchor.current = anchor;
      if (immediate || sessionRef.current) {
        clearTimeout(openTimer.current);
        openTimer.current = null;
        if (!sessionRef.current || distanceSquared(sessionRef.current.point, point) >= .25) commit(anchor);
      } else if (openTimer.current === null) {
        // Pending movement changes refs, without rerendering the plot.
        openTimer.current = setTimeout(() => {
          openTimer.current = null;
          if (latestAnchor.current && activeLensId === clipId) commit(latestAnchor.current);
        }, OPEN_DELAY);
      }
    };
    const processPointer = () => {
      pointerFrame.current = null;
      const pointer = pendingPointer.current;
      pendingPointer.current = null;
      if (!pointer || !svg.isConnected) return;
      const geometry = measure();
      if (!geometry) return;
      const point = {
        x: (pointer.x - geometry.rect.left) * width / geometry.rect.width,
        y: (pointer.y - geometry.rect.top) * height / geometry.rect.height,
      };
      if (point.x < left || point.x > width - right || point.y < top || point.y > height - bottom) {
        scheduleLeave();
        return;
      }
      if (pointer.element) sourceElement.current = pointer.element;
      prepare(point, geometry);
    };
    const pointerMove = event => {
      if (event.pointerType === 'touch' || event.buttons) return;
      cancelAnimationFrame(focusFrame.current);
      focusFrame.current = null;
      pendingPointer.current = {
        x: event.clientX, y: event.clientY,
        element: event.target.closest?.('[data-explorer-student]'),
      };
      // Coalesce events to the latest location once per animation frame.
      if (pointerFrame.current === null) pointerFrame.current = requestAnimationFrame(processPointer);
    };
    const focus = event => {
      if (suppressFocus.current) {
        suppressFocus.current = false;
        return;
      }
      const element = event.target.closest?.('[data-explorer-student]');
      const point = points.find(candidate => candidate.record.id === element?.dataset.explorerStudent);
      if (!point) return;
      dismiss();
      if (dismissActiveLens) dismissActiveLens();
      sourceElement.current = element;
      focusFrame.current = requestAnimationFrame(() => {
        focusFrame.current = null;
        if (!svg.isConnected || !element.isConnected || document.activeElement !== element) return;
        const geometry = measure();
        if (geometry) prepare({ x: point.x, y: point.y }, geometry, true);
      });
    };
    const blur = event => {
      if (!svg.contains(event.relatedTarget) && !portalRef.current?.contains(event.relatedTarget)) scheduleLeave();
    };
    const blankClick = event => {
      if (!event.target.closest?.('[data-explorer-student], [data-draft-student]')) dismiss();
    };
    svg.addEventListener('pointerdown', dismiss, true);
    svg.addEventListener('pointermove', pointerMove, { passive: true });
    svg.addEventListener('pointerenter', keepOpen);
    svg.addEventListener('pointerleave', scheduleLeave);
    svg.addEventListener('focusin', focus);
    svg.addEventListener('focusout', blur);
    svg.addEventListener('click', blankClick);
    return () => {
      svg.removeEventListener('pointerdown', dismiss, true);
      svg.removeEventListener('pointermove', pointerMove);
      svg.removeEventListener('pointerenter', keepOpen);
      svg.removeEventListener('pointerleave', scheduleLeave);
      svg.removeEventListener('focusin', focus);
      svg.removeEventListener('focusout', blur);
      svg.removeEventListener('click', blankClick);
      dismiss();
    };
  }, [svgRef, panelId, points, policy, boundary, width, height, left, right, top, bottom, clipId, dismiss, keepOpen, scheduleLeave, disabled]);

  const nearby = useMemo(() => session ? points
    .map(point => ({ ...point, distance: distanceSquared(point, session.point) }))
    .filter(point => point.distance <= session.radius ** 2)
    .sort((a, b) => a.distance - b.distance || String(a.record.id).localeCompare(String(b.record.id))) : [], [session, points]);
  const coincident = useMemo(() => {
    const result = new Map();
    for (const point of nearby) {
      const key = JSON.stringify([point.record.gpa, point.record.sat]);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(point);
    }
    return result;
  }, [nearby]);
  const inspected = nearby.find(point => point.record.id === inspectedId)
    || (nearby[0]?.distance <= 12 ** 2 ? nearby[0] : null);
  const pick = (event, record) => {
    event.stopPropagation();
    onSelect(record.id);
  };
  const pickPointer = (event, point) => {
    const members = coincident.get(JSON.stringify([point.record.gpa, point.record.sat]));
    const selected = members.findIndex(item => item.record.id === selectedStudentId);
    pick(event, members[(selected + 1) % members.length].record);
  };
  const describe = point => point.record.id + ' · GPA ' + point.record.gpa + ' · SAT ' + point.record.sat
    + ' · ' + (point.admitted ? t.admitted : t.rejected);
  if (disabled || !session || !nearby.length) return null;
  const { popup, chartSize, radius } = session;
  const center = chartSize / 2;
  const projectedBoundary = boundary?.points?.length > 1 ? boundary.points.slice(0, 2).map(point => ({
    x: center + (coordinate(point.x, [gpaMin, gpaMax], left, width - left - right) - session.point.x) * ZOOM,
    y: center + (coordinate(point.y, [satMin, satMax], height - bottom, -(height - top - bottom)) - session.point.y) * ZOOM,
  })) : null;

  return <>
    <svg className="exl-source-overlay" width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} aria-hidden="true">
      <circle className="fex-lens-source" cx={session.point.x} cy={session.point.y} r={radius} />
    </svg>
    {createPortal(<div ref={portalRef}
      className={'explorer-point-lens' + (isLight ? ' is-light' : '')} data-explorer-lens={panelId} data-lens-side={popup.side}
      role="dialog" aria-label={'4× ' + t.detail + ': ' + panelLabel} aria-modal="false"
      style={{ left: popup.left, top: popup.top, width: popup.diameter, height: popup.diameter }}
      onPointerEnter={keepOpen} onPointerLeave={scheduleLeave} onFocus={keepOpen}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !svgRef.current?.contains(event.relatedTarget)) scheduleLeave(); }}
      onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <svg className="exl-chart" width={chartSize} height={chartSize} viewBox={'0 0 ' + chartSize + ' ' + chartSize}
        role="group" aria-label={t.detail}>
        <defs><clipPath id={clipId}><circle cx={center} cy={center} r={radius * ZOOM} /></clipPath></defs>
        <g clipPath={'url(#' + clipId + ')'}>
          {projectedBoundary && projectedBoundary.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))
            && <line className="exl-cutoff" aria-label={t.cutoff} x1={projectedBoundary[0].x} y1={projectedBoundary[0].y} x2={projectedBoundary[1].x} y2={projectedBoundary[1].y} />}
          {nearby.map(point => {
            const cx = center + (point.x - session.point.x) * ZOOM;
            const cy = center + (point.y - session.point.y) * ZOOM;
            const overlap = coincident.get(JSON.stringify([point.record.gpa, point.record.sat])).length;
            return <g key={point.record.id} role="button" tabIndex={0} data-lens-student={point.record.id} data-lens-overlap={overlap}
              aria-label={describe(point)} aria-pressed={point.record.id === selectedStudentId}
              onPointerEnter={() => setInspectedId(point.record.id)} onFocus={() => setInspectedId(point.record.id)}
              onClick={event => pickPointer(event, point)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(event, point.record); } }}>
              <title>{describe(point)}</title>
              <circle className="exl-hit" cx={cx} cy={cy} r={9} />
              {point.record.id === selectedStudentId && <circle className="exl-selected" cx={cx} cy={cy} r={7.5} />}
              {point.admitted ? <circle cx={cx} cy={cy} r={4.5} fill={colors.admitted} />
                : <path d={'M' + cx + ',' + (cy - 5.5) + ' L' + (cx + 5.5) + ',' + cy + ' L' + cx + ',' + (cy + 5.5) + ' L' + (cx - 5.5) + ',' + cy + ' Z'} fill={colors.rejected} />}
            </g>;
          })}
        </g>
        <path transform={'translate(' + center + ' ' + center + ')'} d="M 0 -12 V -4 M 0 4 V 12 M -12 0 H -4 M 4 0 H 12" className="exl-crosshair" aria-hidden="true" />
      </svg>
      {inspected && <div className="exl-info" data-lens-detail={inspected.record.id}>
        <span><strong>{inspected.record.id}</strong> · <span style={{ color: inspected.admitted ? colors.admitted : colors.rejected }}>{inspected.admitted ? t.admitted : t.rejected}</span></span>
        <span>GPA {inspected.record.gpa} · SAT {inspected.record.sat}</span>
      </div>}
    </div>, document.body)}
  </>;
}
