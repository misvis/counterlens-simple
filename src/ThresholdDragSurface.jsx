import { useEffect, useRef } from 'react';
import { ADMISSION_DOMAINS, thresholdAfterDrag } from '../shared/admissionModel.js';

// ReferenceArea supplies the plot rectangle, so dragging uses the same scales
// as the chart at every viewport size. Student symbols sit above this layer.
export default function ThresholdDragSurface({
  x, y, width, height, band, boundary, policy, isLight, help,
  onChange, onDraggingChange,
}) {
  const drag = useRef(null);

  useEffect(() => {
    const finish = (restore = false) => {
      const current = drag.current;
      if (!current) return;
      drag.current = null;
      if (restore) onChange(current.threshold);
      if (current.element.hasPointerCapture(current.pointerId)) {
        current.element.releasePointerCapture(current.pointerId);
      }
      onDraggingChange(false);
    };
    const onKeyDown = event => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        finish(true);
      }
    };
    const stop = () => finish();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', stop);
    window.addEventListener('resize', stop);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', stop);
      window.removeEventListener('resize', stop);
      finish();
    };
  }, [onChange, onDraggingChange, policy.id]);

  if (!(width > 0 && height > 0)) return null;

  const toPixel = point => ({
    x: x + (point.x - ADMISSION_DOMAINS.gpa[0]) / (ADMISSION_DOMAINS.gpa[1] - ADMISSION_DOMAINS.gpa[0]) * width,
    y: y + (1 - (point.y - ADMISSION_DOMAINS.sat[0]) / (ADMISSION_DOMAINS.sat[1] - ADMISSION_DOMAINS.sat[0])) * height,
  });
  const line = boundary?.points.map(toPixel) ?? [];

  const move = event => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(current.inverse);
    onChange(thresholdAfterDrag(current.policy, current.threshold,
      (point.x - current.start.x) / current.width,
      (current.start.y - point.y) / current.height,
    ));
  };

  const end = (event, cancelled = false) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!cancelled) move(event);
    drag.current = null;
    if (current.element.hasPointerCapture(current.pointerId)) {
      current.element.releasePointerCapture(current.pointerId);
    }
    onDraggingChange(false);
    event.stopPropagation();
  };

  return (
    <g
      className="workspace-boundary-drag-surface"
      data-boundary-ui
      aria-hidden="true"
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        const element = event.currentTarget;
        const matrix = element.getScreenCTM();
        if (!matrix) return;
        event.preventDefault();
        event.stopPropagation();
        const inverse = matrix.inverse();
        drag.current = {
          element, pointerId: event.pointerId, inverse, width, height, policy,
          threshold: policy.threshold,
          start: new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse),
        };
        // Capture on the persistent group, not the polygon: the band can move
        // completely off-chart while the gesture continues outside the plot.
        element.setPointerCapture(event.pointerId);
        onDraggingChange(true);
      }}
      onPointerMove={move}
      onPointerUp={event => end(event)}
      onPointerCancel={event => end(event, true)}
      onLostPointerCapture={event => end(event, true)}
      onClick={event => event.stopPropagation()}
    >
      <title>{help}</title>
      <rect className="workspace-boundary-plane" x={x} y={y} width={width} height={height} fill="none" pointerEvents="none" />
      {band.polygon.length > 0 && (
        <polygon
          className="workspace-boundary-band workspace-boundary-drag-target"
          points={band.polygon.map(p => `${x + p.x * width},${y + (1 - p.y) * height}`).join(' ')}
          fill="var(--workspace-edit)"
          fillOpacity={isLight ? .075 : .12}
          stroke="none"
          pointerEvents="all"
        />
      )}
      {line.length === 2 && (
        <line className="workspace-boundary-hit-line workspace-boundary-drag-target"
          x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y}
          stroke="transparent" strokeWidth={20} strokeLinecap="round" pointerEvents="stroke" />
      )}
      {line.length === 1 && (
        <circle className="workspace-boundary-hit-point workspace-boundary-drag-target"
          cx={line[0].x} cy={line[0].y} r={12} fill="transparent" pointerEvents="all" />
      )}
    </g>
  );
}
