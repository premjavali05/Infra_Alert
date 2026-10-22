const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isForm = options.body instanceof FormData;
  if (options.body && !isForm && typeof options.body !== 'string') {
    headers.set('Content-Type', 'application/json');
    options = { ...options, body: JSON.stringify(options.body) };
  }
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers
  });
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) return response;
  const payload = contentType.includes('application/json') ? await response.json() : { error: await response.text() };
  if (!response.ok) throw new Error(payload.error || payload.message || 'Request failed.');
  return payload;
}

export const statusClass = (status) => String(status || 'Pending').toLowerCase().replace(/\s+/g, '-');
export const categoryLabel = (category) => ({
  home_electricity: 'Home Electricity', street_lights: 'Street Lights', potholes: 'Potholes', garbage: 'Garbage'
}[category] || category || '—');
