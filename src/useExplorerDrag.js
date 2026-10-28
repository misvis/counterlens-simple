import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { explorerStudentAfterDrag, explorerThresholdAfterDrag } from './explorerDragGeometry.js';

const finiteStudent = student => Number.isFinite(student?.gpa) && Number.isFinite(student?.sat);

export default function useExplorerDrag({
  svgRef, width, height, margin, domains, policy, students,
  selectedStudent, draftStudent, onSelect, onEdit, onThresholdChange, onRestoreSelection, contextKey,
}) {
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const callbacks = useRef(null);
  const [dragKind, setDragKind] = useState(null);
  // Fresh parent callbacks must not tear down an in-progress pointer capture.
  useLayoutEffect(() => {
    callbacks.current = { onSelect, onEdit, onThresholdChange, onRestoreSelection };
  });

  const finish = useCallback((restore = false) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    current.removeListeners();
    if (restore && current.moved) {
      if (current.kind === 'threshold') callbacks.current.onThresholdChange(current.threshold);
      else callbacks.current.onRestoreSelection(current.previousId, current.previousDraft);
    }
    if (current.element.hasPointerCapture(current.pointerId)) {
      current.element.releasePointerCapture(current.pointerId);
    }
    setDragKind(null);
  }, []);

  // Layout/data/policy changes end the gesture without writing an old snapshot
  // into the newly selected context. Pointer cancellation and Escape restore it.
  useEffect(() => () => finish(), [contextKey, finish]);

  const move = event => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (!current.moved) {
      if (Math.hypot(event.clientX - current.clientX, event.clientY - current.clientY) < 4) return;
      current.moved = true;
      if (current.kind === 'student' && !current.isDraft) callbacks.current.onSelect(current.original.id);
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(current.inverse);
    if (current.kind === 'threshold') {
      const next = explorerThresholdAfterDrag(current.policy, current.threshold,
        current.start, point, current.width, current.height, current.domains);
      if (next === current.lastThreshold) return;
      callbacks.current.onThresholdChange(next);
      current.lastThreshold = next;
    } else {
      const next = explorerStudentAfterDrag(current.startStudent,
        current.start, point, current.width, current.height, current.domains);
      if (next.gpa === current.lastStudent.gpa && next.sat === current.lastStudent.sat) return;
      callbacks.current.onEdit(next, current.original, current.lastStudent);
      current.lastStudent = next;
    }
  };

  const end = (event, cancelled = false) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!cancelled) {
      move(event);
      // Capture retargets click to the plot. Resolve a tap here so it selects
      // its original marker instead of being mistaken for a blank-plot click.
      if (!current.moved && current.kind === 'student' && !current.isDraft) {
        callbacks.current.onSelect(current.original.id);
      }
    }
    finish(cancelled);
    event.stopPropagation();
  };

  return {
    dragKind,
    dragHandlers: {
      onPointerDownCapture: event => {
        if (drag.current) return;
        suppressClick.current = false;
        if (!event.isPrimary || event.button !== 0) return;
        const marker = event.target.closest?.('[data-explorer-student], [data-draft-student], [data-cutoff-drag]');
        const svg = svgRef.current;
        if (!marker || !svg?.contains(marker)) return;
        const kind = marker.hasAttribute('data-cutoff-drag') ? 'threshold' : 'student';
        const handlers = callbacks.current;
        if (kind === 'threshold' ? typeof handlers?.onThresholdChange !== 'function'
          : ['onSelect', 'onEdit', 'onRestoreSelection'].some(key => typeof handlers?.[key] !== 'function')) return;
        const isDraft = marker.hasAttribute('data-draft-student');
        const original = kind === 'student'
          ? (isDraft ? selectedStudent : students.find(student => String(student.id) === marker.dataset.explorerStudent)) : null;
        const startStudent = isDraft ? draftStudent : original;
        if (kind === 'student' && (!finiteStudent(original) || !finiteStudent(startStudent))) return;
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        const matrix = svg.getScreenCTM();
        if (!matrix || !(plotWidth > 0 && plotHeight > 0)) return;
        const inverse = matrix.inverse();
        event.preventDefault();
        event.stopPropagation();
        const element = event.currentTarget;
        const escape = keyEvent => {
          if (keyEvent.key !== 'Escape' || !drag.current) return;
          keyEvent.preventDefault();
          finish(true);
        };
        const stop = () => finish();
        // Prevent touch panning only for gestures that began on a draggable
        // target; blank chart areas retain their normal scrolling behavior.
        const preventPan = touchEvent => {
          if (drag.current && touchEvent.cancelable) touchEvent.preventDefault();
        };
        window.addEventListener('keydown', escape);
        window.addEventListener('blur', stop);
        window.addEventListener('resize', stop);
        window.addEventListener('scroll', stop, true);
        element.addEventListener('touchstart', preventPan, { passive: false });
        element.addEventListener('touchmove', preventPan, { passive: false });
        drag.current = {
          element, pointerId: event.pointerId, inverse, kind, isDraft,
          width: plotWidth, height: plotHeight,
          domains: { gpa: [...domains.gpa], sat: [...domains.sat] },
          policy, threshold: policy.threshold, lastThreshold: policy.threshold,
          start: new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse),
          clientX: event.clientX, clientY: event.clientY, moved: false,
          original, startStudent: startStudent ? { ...startStudent } : null,
          lastStudent: startStudent ? { ...startStudent } : null,
          previousId: selectedStudent?.id ?? null,
          previousDraft: draftStudent ? { ...draftStudent } : null,
          removeListeners: () => {
            window.removeEventListener('keydown', escape);
            window.removeEventListener('blur', stop);
            window.removeEventListener('resize', stop);
            window.removeEventListener('scroll', stop, true);
            element.removeEventListener('touchstart', preventPan);
            element.removeEventListener('touchmove', preventPan);
          },
        };
        // The point/draft or cutoff can disappear during editing. Its parent
        // plot stays mounted and keeps delivering the rest of this gesture.
        element.setPointerCapture(event.pointerId);
        suppressClick.current = true;
        setDragKind(kind);
      },
      onPointerMove: move,
      onPointerUp: event => end(event),
      onPointerCancel: event => end(event, true),
      onLostPointerCapture: event => {
        if (drag.current?.pointerId !== event.pointerId) return;
        // Lost-capture events do not carry a meaningful final pointer position.
        finish();
        event.stopPropagation();
      },
      onClickCapture: event => {
        if (!suppressClick.current || event.detail === 0) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    },
  };
}
