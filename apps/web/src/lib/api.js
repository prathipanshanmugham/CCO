// Small fetch wrapper. Cookies carry the staff session; customers need no login.
export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

async function request(method, path, body, opts = {}) {
  const init = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
  const res = await fetch(path, init);
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && opts.onUnauthorized) opts.onUnauthorized();
    throw new ApiError(res.status, json.error || `Request failed (${res.status})`, json.details);
  }
  return json;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};

// Field-level errors from zod come back as { fieldErrors: { name: [msg] } }
export const fieldErrors = (err) => err?.details?.fieldErrors || {};
