const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const permittedContextKeys = ['datasetId', 'datasetVersion', 'policyId', 'locale', 'theme'];

export const trackAnonymousEvent = (name, context) => {
  if (!API_BASE_URL) return;

  const payload = { name };
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
