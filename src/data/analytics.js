import { API_BASE_URL, CLASSROOM_ID } from './api.js';

const permittedContextKeys = ['datasetId', 'datasetVersion', 'policyId', 'locale', 'theme'];

export const trackAnonymousEvent = (name, context) => {
  if (!API_BASE_URL) return;

  const payload = { name, classroomId: CLASSROOM_ID };
  for (const key of permittedContextKeys) {
    if (context[key] !== undefined) payload[key] = context[key];
  }

  void fetch(`${API_BASE_URL}/api/v1/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Analytics must never interrupt the classroom experience.
  });
};
