import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getDecision, scoreStudent } from '../shared/admissionModel.js';
import { getExplorerLensGeometry, getExplorerLensNeighbors, nearestExplorerPoint } from './explorerLensGeometry.js';
import './explorer-point-lens.css';

const ZOOM = 4;
// Only the active lens installs document listeners.
let dismissActiveLens = null;
let activeLensId = null;
const COPY = {
  en: { detail: 'Point detail', admitted: 'Admitted', rejected: 'Not admitted', threshold: 'Threshold', original: 'Original', edited: 'Edited', score: 'Score', zipIncome: 'ZIP income' },
  zh: { detail: '数据点详情', admitted: '录取', rejected: '未录取', threshold: '阈值', original: '原始', edited: '修改后', score: '得分', zipIncome: '邮区收入' },
  es: { detail: 'Detalle de puntos', admitted: 'Admitido', rejected: 'No admitido', threshold: 'Umbral', original: 'Original', edited: 'Editado', score: 'Puntuación', zipIncome: 'Ingreso ZIP' },
};
const coordinate = (value, domain, start, length) => start + (value - domain[0]) / (domain[1] - domain[0]) * length;
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// Moving the lens over the same student only repositions the drawing.
const LensComparison = memo(function LensComparison({ original, edited, policy, colors, lang, t }) {
  const format = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format;
  const formatScore = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;
  const academic = key => original[key] === edited[key] ? format(original[key]) : `${format(original[key])} → ${format(edited[key])}`;
  const incomeChanged = original.zipIncome !== edited.zipIncome && Number.isFinite(original.zipIncome) && Number.isFinite(edited.zipIncome);
  return <>
    <div className="exl-compare-heading" data-lens-comparison={original.id}>
      <strong>{original.id} · {t.threshold} {format(policy.threshold)}</strong>
      <span>GPA {academic('gpa')} · SAT {academic('sat')}</span>
    </div>
    <div className="exl-compare-summary">
      {incomeChanged && <span className="exl-income-change">{t.zipIncome} ${format(original.zipIncome)} → ${format(edited.zipIncome)}</span>}
      {[original, edited].map((profile, index) => {
        const score = scoreStudent(profile, policy);
        const admitted = getDecision(profile, policy);
        return <div key={index} className="exl-score-row" data-lens-state={index ? 'edited' : 'original'}>
          <span>{index ? t.edited : t.original}</span>
          <strong><span className="sr-only">{t.score} </span>{formatScore(score)}</strong>
          <span style={{ color: admitted ? colors.admitted : colors.rejected }}>{admitted ? t.admitted : t.rejected}</span>
        </div>;
      })}
    </div>
  </>;
});

// Hover updates only this component, leaving the original SVG marks untouched.
export function ExplorerPointLens({ svgRef, panelId, panelLabel, points, width, height = 220,
  margin = { left: 43, right: 16, top: 22, bottom: 42 }, domains, boundary,
  selectedStudent, draftStudent, draftHere, policy, colors, isLight, lang = 'en', onSelect, disabled = false }) {
  const selectedStudentId = selectedStudent?.id;
  const t = COPY[lang] || COPY.en;
  const clipId = useId().replace(/:/g, '');
  const portalRef = useRef(null);
  const sourceElement = useRef(null);
  const suppressFocus = useRef(false);
  const focusFrame = useRef(null);
  const pointerFrame = useRef(null);
  const pendingPointer = useRef(null);
  const sessionRef = useRef(null);
  const measuredGeometry = useRef(null);
  const removeGlobalListeners = useRef(null);
  const [session, setSession] = useState(null);
  const [inspectedPoint, setInspectedPoint] = useState(null);
  const { left, right, top, bottom } = margin;
  const [gpaMin, gpaMax] = domains.gpa;
  const [satMin, satMax] = domains.sat;
  // Clip the panel's displacement line to the lens even when an endpoint is outside the sample.
  const displacement = useMemo(() => {
    if (!draftHere) return null;
    const original = points.find(point => !point.edited && point.record.id === selectedStudentId);
    const edited = points.find(point => point.edited);
    return original && edited && distanceSquared(original, edited) > 0 ? { original, edited } : null;
  }, [points, draftHere, selectedStudentId]);

  const cancelPointerFrame = useCallback(() => {
    cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = null;
    pendingPointer.current = null;
  }, []);
  const dismiss = useCallback(() => {
    cancelAnimationFrame(focusFrame.current);
    cancelPointerFrame();
    focusFrame.current = null;
    measuredGeometry.current = null;
    sessionRef.current = null;
    setSession(null);
    setInspectedPoint(null);
    removeGlobalListeners.current?.();
    removeGlobalListeners.current = null;
    if (activeLensId === clipId) {
      dismissActiveLens = null;
      activeLensId = null;
    }
  }, [cancelPointerFrame, clipId]);
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
      const matrix = svg.getScreenCTM();
      if (!matrix || !rect.width || !rect.height) return null;
      const scrollport = svg.closest('.fex-matrix-viewport');
      const clip = scrollport?.getBoundingClientRect();
      const visible = clip ? {
        left: Math.max(rect.left, clip.left + scrollport.clientLeft),
        right: Math.min(rect.right, clip.left + scrollport.clientLeft + scrollport.clientWidth),
        top: Math.max(rect.top, clip.top + scrollport.clientTop),
        bottom: Math.min(rect.bottom, clip.top + scrollport.clientTop + scrollport.clientHeight),
      } : rect;
      return { matrix, inverse: matrix.inverse(), visible, viewport: { width: window.innerWidth, height: window.innerHeight } };
    };
    const prepare = (point, geometry, targetId, keyboard = false) => {
      if (sessionRef.current?.keyboard === keyboard && distanceSquared(sessionRef.current.point, point) === 0) {
        return;
      }
      const { matrix, visible, viewport } = geometry;
      const focus = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      if (focus.x < Math.max(visible.left, 0) || focus.x > Math.min(visible.right, viewport.width)
        || focus.y < Math.max(visible.top, 0) || focus.y > Math.min(visible.bottom, viewport.height)) return;
      const scale = Math.hypot(matrix.a, matrix.b);
      const popup = getExplorerLensGeometry(focus, viewport, ZOOM, scale, sessionRef.current?.popup.side, draftStudent ? 220 : 196);
      if (popup.diameter < 24) return;
      const nearby = getExplorerLensNeighbors(points, point, popup.radius);
      if (!nearby.length) {
        if (sessionRef.current) dismiss();
        return;
      }
      activate();
      // Cache only after activation installs scroll/resize invalidation.
      measuredGeometry.current = geometry;
      const nearest = nearestExplorerPoint(nearby, point, targetId);
      const anchor = { point, focus, popup, radius: popup.radius, chartSize: popup.diameter - 2, scale, nearby, points, nearest, keyboard, hit: targetId != null };
      sessionRef.current = anchor;
      setSession(anchor);
    };
    const processPointer = () => {
      pointerFrame.current = null;
      const pointer = pendingPointer.current;
      pendingPointer.current = null;
      if (!pointer || !svg.isConnected) return;
      const geometry = measure();
      if (!geometry) return;
      const point = new DOMPoint(pointer.x, pointer.y).matrixTransform(geometry.inverse);
      if (point.x < left || point.x > width - right || point.y < top || point.y > height - bottom) {
        if (sessionRef.current) dismiss();
        return;
      }
      if (pointer.element) sourceElement.current = pointer.element;
      prepare(point, geometry, pointer.element?.dataset.explorerStudent ?? pointer.element?.dataset.draftStudent);
    };
    const pointerMove = event => {
      if (event.pointerType === 'touch' || event.buttons) return;
      cancelAnimationFrame(focusFrame.current);
      focusFrame.current = null;
      pendingPointer.current = {
        x: event.clientX, y: event.clientY,
        element: event.target.closest?.('[data-explorer-student], [data-draft-student]'),
      };
      // Coalesce events to the latest location once per animation frame.
      if (pointerFrame.current === null) pointerFrame.current = requestAnimationFrame(processPointer);
    };
    const focus = event => {
      if (suppressFocus.current) {
        suppressFocus.current = false;
        return;
      }
      const element = event.target.closest?.('[data-explorer-student], [data-draft-student]');
      if (!element?.matches(':focus-visible')) return;
      const edited = element.hasAttribute('data-draft-student');
      const point = points.find(candidate => Boolean(candidate.edited) === edited
        && candidate.record.id === (edited ? element.dataset.draftStudent : element.dataset.explorerStudent));
      if (!point) return;
      dismiss();
      if (dismissActiveLens) dismissActiveLens();
      sourceElement.current = element;
      focusFrame.current = requestAnimationFrame(() => {
        focusFrame.current = null;
        if (!svg.isConnected || !element.isConnected || document.activeElement !== element) return;
        const geometry = measure();
        if (geometry) prepare({ x: point.x, y: point.y }, geometry, point.record.id, true);
      });
    };
    const blur = event => {
      if (!svg.contains(event.relatedTarget) && !portalRef.current?.contains(event.relatedTarget)) dismiss();
    };
    const leaveSource = event => {
      cancelPointerFrame();
      if (!portalRef.current?.contains(event.relatedTarget)) dismiss();
    };
    const blankClick = event => {
      if (!event.target.closest?.('[data-explorer-student], [data-draft-student]')) dismiss();
    };
    svg.addEventListener('pointerdown', dismiss, true);
    svg.addEventListener('pointermove', pointerMove, { passive: true });
    svg.addEventListener('pointerleave', leaveSource);
    svg.addEventListener('focusin', focus);
    svg.addEventListener('focusout', blur);
    svg.addEventListener('click', blankClick);
    return () => {
      svg.removeEventListener('pointerdown', dismiss, true);
      svg.removeEventListener('pointermove', pointerMove);
      svg.removeEventListener('pointerleave', leaveSource);
      svg.removeEventListener('focusin', focus);
      svg.removeEventListener('focusout', blur);
      svg.removeEventListener('click', blankClick);
      dismiss();
    };
  }, [svgRef, panelId, points, draftStudent, policy, boundary, width, height, left, right, top, bottom, clipId, cancelPointerFrame, dismiss, disabled]);

  const nearby = session?.points === points ? session.nearby : [];
  const coincident = useMemo(() => {
    const result = new Map();
    for (const point of points) {
      if (point.edited) continue;
      const key = point.coordinateKey;
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(point);
    }
    return result;
  }, [points]);
  const pick = (event, record) => {
    event.stopPropagation();
    onSelect(record.id);
  };
  const pickPointer = (event, point) => {
    const members = coincident.get(point.coordinateKey);
    const selected = members.findIndex(item => item.record.id === selectedStudentId);
    pick(event, members[(selected + 1) % members.length].record);
  };
  const describe = point => point.record.id + ' · GPA ' + point.record.gpa + ' · SAT ' + point.record.sat
    + ' · ' + (point.admitted ? t.admitted : t.rejected);
  if (disabled || !session || !nearby.length) return null;
  // A click can select a student underneath another mark at the exact same position.
  const selectedAtFocus = !session.keyboard && selectedStudentId
    ? coincident.get(session.nearest?.coordinateKey)?.find(point => point.record.id === selectedStudentId) : null;
  const inspected = inspectedPoint?.session === session ? inspectedPoint.point : selectedAtFocus ?? session.nearest;
  const inspect = point => setInspectedPoint({ session, point });
  const { popup, chartSize, radius } = session;
  const center = chartSize / 2;
  const originalPoint = nearby.find(point => !point.edited && point.record.id === selectedStudentId);
  const editedPoint = nearby.find(point => point.edited);
  const samePosition = originalPoint && editedPoint && distanceSquared(originalPoint, editedPoint) === 0;
  const lensX = point => center + (point.x - session.point.x) * ZOOM;
  const lensY = point => center + (point.y - session.point.y) * ZOOM;
  const lensDx = popup.left + popup.diameter / 2 - session.focus.x;
  const lensDy = popup.top + popup.diameter / 2 - session.focus.y;
  const lensDistance = Math.hypot(lensDx, lensDy);
  const sourceEdge = radius * session.scale / lensDistance;
  const lensEdge = 1 - popup.diameter / (2 * lensDistance);
  const projectedBoundary = boundary?.points?.length > 1 ? boundary.points.slice(0, 2).map(point => ({
    x: center + (coordinate(point.x, [gpaMin, gpaMax], left, width - left - right) - session.point.x) * ZOOM,
    y: center + (coordinate(point.y, [satMin, satMax], height - bottom, -(height - top - bottom)) - session.point.y) * ZOOM,
  })) : null;

  return <>
    <svg className="exl-source-overlay" width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} aria-hidden="true">
      {!session.keyboard && session.hit && <circle className="fex-hover-ring" cx={inspected.x} cy={inspected.y} r={8} />}
      <circle className="fex-lens-source" cx={session.point.x} cy={session.point.y} r={radius} />
    </svg>
    {createPortal(<>
      <svg className="exl-focus-link" aria-hidden="true" width="1" height="1"
        style={{ left: session.focus.x, top: session.focus.y }}>
        <line x1={lensDx * sourceEdge} y1={lensDy * sourceEdge} x2={lensDx * lensEdge} y2={lensDy * lensEdge} />
      </svg>
      <div ref={portalRef}
      className={'explorer-point-lens' + (isLight ? ' is-light' : '')} data-explorer-lens={panelId} data-lens-side={popup.side}
      role="dialog" aria-label={'4× ' + t.detail + ': ' + panelLabel} aria-modal="false"
      style={{ left: popup.left, top: popup.top, width: popup.diameter, height: popup.diameter, pointerEvents: session.keyboard ? 'auto' : 'none' }}
      onPointerLeave={event => { if (!svgRef.current?.contains(event.relatedTarget)) dismiss(); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !svgRef.current?.contains(event.relatedTarget)) dismiss(); }}
      onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <svg className="exl-chart" width={chartSize} height={chartSize} viewBox={'0 0 ' + chartSize + ' ' + chartSize}
        role="group" aria-label={t.detail}>
        <defs><clipPath id={clipId}><circle cx={center} cy={center} r={radius * ZOOM} /></clipPath></defs>
        <g clipPath={'url(#' + clipId + ')'}>
          {projectedBoundary && projectedBoundary.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))
            && <line className="exl-cutoff" aria-label={t.threshold} x1={projectedBoundary[0].x} y1={projectedBoundary[0].y} x2={projectedBoundary[1].x} y2={projectedBoundary[1].y} />}
          {displacement && <line className="exl-compare-connector"
            x1={lensX(displacement.original)} y1={lensY(displacement.original)}
            x2={lensX(displacement.edited)} y2={lensY(displacement.edited)} />}
          {nearby.filter(point => !point.edited).map(point => {
            const cx = lensX(point);
            const cy = lensY(point);
            const overlap = coincident.get(point.coordinateKey).length;
            return <g key={point.record.id} role="button" tabIndex={session.keyboard ? 0 : -1} data-lens-student={point.record.id} data-lens-overlap={overlap}
              aria-label={point.record.id === selectedStudentId ? t.original + ' · ' + describe(point) : describe(point)} aria-pressed={point.record.id === selectedStudentId}
              onPointerEnter={() => inspect(point)} onFocus={() => inspect(point)}
              onClick={event => pickPointer(event, point)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(event, point.record); } }}>
              <circle className="exl-hit" cx={cx} cy={cy} r={9} />
              {point.record.id === selectedStudentId && <circle className="exl-selected" cx={cx} cy={cy} r={7.5} />}
              {point.admitted ? <circle cx={cx} cy={cy} r={4.5} fill={colors.admitted} />
                : <path d={'M' + cx + ',' + (cy - 5.5) + ' L' + (cx + 5.5) + ',' + cy + ' L' + cx + ',' + (cy + 5.5) + ' L' + (cx - 5.5) + ',' + cy + ' Z'} fill={colors.rejected} />}
            </g>;
          })}
          {editedPoint && <g className="exl-draft" data-lens-draft={draftStudent.id} data-coincident={Boolean(samePosition)}
            transform={`translate(${lensX(editedPoint)} ${lensY(editedPoint)})`} role="img"
            aria-label={t.edited + ' · ' + describe(editedPoint)} tabIndex={samePosition ? undefined : session.keyboard ? 0 : -1}
            onPointerEnter={() => inspect(editedPoint)} onFocus={() => inspect(editedPoint)}
            style={{ pointerEvents: samePosition ? 'none' : undefined }}>
            <circle className="exl-edited-ring" r={samePosition ? 14 : 10} />
            {editedPoint.admitted
              ? <circle r={samePosition ? 10 : 4.5} fill={samePosition ? 'none' : colors.admitted} stroke={colors.admitted} strokeWidth={2} />
              : <path d={samePosition ? 'M0 -11 L11 0 0 11 -11 0Z' : 'M0 -5 L5 0 0 5 -5 0Z'} fill={samePosition ? 'none' : colors.rejected} stroke={colors.rejected} strokeWidth={2} />}
          </g>}
        </g>
        <path transform={'translate(' + center + ' ' + center + ')'} d="M 0 -12 V -4 M 0 4 V 12 M -12 0 H -4 M 4 0 H 12" className="exl-crosshair" aria-hidden="true" />
      </svg>
      {inspected && (draftStudent && inspected.record.id === selectedStudentId
        ? <LensComparison original={selectedStudent} edited={draftStudent} policy={policy} colors={colors} lang={lang} t={t} />
        : <div className="exl-info" data-lens-detail={inspected.record.id}>
          <span><strong>{inspected.record.id}</strong> · <span style={{ color: inspected.admitted ? colors.admitted : colors.rejected }}>{inspected.admitted ? t.admitted : t.rejected}</span></span>
          <span>GPA {inspected.record.gpa} · SAT {inspected.record.sat}</span>
        </div>)}
    </div></>, document.body)}
  </>;
}
