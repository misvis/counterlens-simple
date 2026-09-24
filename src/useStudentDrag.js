import { useEffect, useRef, useState } from 'react';
import { studentAfterDrag } from '../shared/admissionModel.js';

export default function useStudentDrag({
  students, selectedStudent, draftStudent, onSelect, onEdit,
  setSelectedId, setDraftStudent, contextKey, disabled,
}) {
  const drag = useRef(null);
  const plot = useRef(null);
  const suppressClick = useRef(false);
  const [isStudentDragging, setIsStudentDragging] = useState(false);

  useEffect(() => {
    const finish = (restore = false) => {
      const current = drag.current;
      if (!current) return;
      drag.current = null;
      if (restore) {
        setSelectedId(current.previousId);
        setDraftStudent(current.previousDraft);
      }
      if (current.element.hasPointerCapture(current.pointerId)) {
        current.element.releasePointerCapture(current.pointerId);
      }
      setIsStudentDragging(false);
    };
    const onKeyDown = event => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        finish(true);
      }
    };
    const stop = () => finish();
    const element = plot.current;
    // SVG touch-action is not honored consistently after capture transfers to
    // the HTML plot. Cancel panning only for a gesture started on a student.
    const preventStudentPan = event => {
      if (drag.current && event.cancelable) event.preventDefault();
    };
    element?.addEventListener('touchstart', preventStudentPan, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', stop);
    window.addEventListener('resize', stop);
    return () => {
      element?.removeEventListener('touchstart', preventStudentPan);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', stop);
      window.removeEventListener('resize', stop);
      finish();
    };
  }, [contextKey, setSelectedId, setDraftStudent]);

  const move = event => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    // A small click/tap wobble should select the student, not edit the profile.
    if (!current.moved) {
      if (Math.hypot(event.clientX - current.clientX, event.clientY - current.clientY) < 4) return;
      current.moved = true;
      setIsStudentDragging(true);
    }
    if (current.selectionPending) {
      current.selectionPending = false;
      onSelect(current.original.id);
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(current.inverse);
    const next = studentAfterDrag(current.startStudent,
      (point.x - current.start.x) / current.width,
      (current.start.y - point.y) / current.height,
    );
    if (next.gpa === current.lastStudent.gpa && next.sat === current.lastStudent.sat) return;
    onEdit(next, current.original, current.lastStudent);
    current.lastStudent = next;
  };

  const end = (event, cancelled = false) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!cancelled) {
      move(event);
      if (current.selectionPending) onSelect(current.original.id);
    }
    drag.current = null;
    if (current.element.hasPointerCapture(current.pointerId)) {
      current.element.releasePointerCapture(current.pointerId);
    }
    setIsStudentDragging(false);
    event.stopPropagation();
  };

  return {
    isStudentDragging,
    studentDragHandlers: {
      ref: plot,
      onPointerDownCapture: event => {
        if (drag.current) return;
        suppressClick.current = false;
        if (disabled || !event.isPrimary || event.button !== 0) return;
        const marker = event.target.closest?.('[data-student-id], [data-draft-student]');
        if (!marker) return;
        const isDraft = marker.hasAttribute('data-draft-student');
        const original = isDraft ? selectedStudent : students.find(s => String(s.id) === marker.dataset.studentId);
        const startStudent = isDraft ? draftStudent : original;
        const element = event.currentTarget;
        const plane = element.querySelector('.workspace-boundary-plane');
        const matrix = plane?.getScreenCTM();
        if (!original || !startStudent || !matrix || !(plane.width.baseVal.value > 0 && plane.height.baseVal.value > 0)) return;
        event.preventDefault();
        event.stopPropagation();
        const inverse = matrix.inverse();
        drag.current = {
          element, pointerId: event.pointerId, inverse,
          width: plane.width.baseVal.value, height: plane.height.baseVal.value,
          start: new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse),
          clientX: event.clientX, clientY: event.clientY, moved: false,
          original, startStudent: { ...startStudent }, lastStudent: { ...startStudent },
          previousId: selectedStudent?.id ?? null,
          previousDraft: draftStudent ? { ...draftStudent } : null,
          selectionPending: !isDraft && event.pointerType === 'touch',
        };
        // Selecting changes the SVG symbols. Keep the touch target mounted
        // through touchstart, then select on movement or tap release.
        if (!isDraft && !drag.current.selectionPending) onSelect(original.id);
        // Capture on the plot: the hypothetical marker appears/disappears as
        // the profile moves, so it is not a stable pointer-capture target.
        element.setPointerCapture(event.pointerId);
        suppressClick.current = true;
      },
      onPointerMove: move,
      onPointerUp: event => end(event),
      onPointerCancel: event => end(event, true),
      onLostPointerCapture: event => end(event, true),
      onClickCapture: event => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    },
  };
}
