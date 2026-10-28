import { ADMISSION_DOMAINS, studentAfterDrag, thresholdAfterDrag } from '../shared/admissionModel.js';

// The shared drag model takes fractions of the editor's domain, while an
// Explorer plot may extend its axes to include records outside that domain.
export const explorerDragDelta = (start, point, width, height, domains) => ({
  gpa: (point.x - start.x) / width
    * (domains.gpa[1] - domains.gpa[0]) / (ADMISSION_DOMAINS.gpa[1] - ADMISSION_DOMAINS.gpa[0]),
  sat: (start.y - point.y) / height
    * (domains.sat[1] - domains.sat[0]) / (ADMISSION_DOMAINS.sat[1] - ADMISSION_DOMAINS.sat[0]),
});

export const explorerStudentAfterDrag = (student, start, point, width, height, domains) => {
  const delta = explorerDragDelta(start, point, width, height, domains);
  return studentAfterDrag(student, delta.gpa, delta.sat);
};

export const explorerThresholdAfterDrag = (policy, threshold, start, point, width, height, domains) => {
  const delta = explorerDragDelta(start, point, width, height, domains);
  return thresholdAfterDrag(policy, threshold, delta.gpa, delta.sat);
};
