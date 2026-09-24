import { DEFAULT_CLASSROOM_ID } from '../../shared/classroomDataset.js';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(
  /\/$/,
  '',
);
export const CLASSROOM_ID =
  new URLSearchParams(window.location.search).get('class') || DEFAULT_CLASSROOM_ID;

export const apiRequest = async (path, options = {}, base = API_BASE_URL) => {
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch(`${base}${path}`, {
    ...options,
    signal: options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
};
