export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const badRequest = (m, d) => new HttpError(400, m, d);
export const unauthorized = (m = 'Please sign in') => new HttpError(401, m);
export const forbidden = (m = 'Your role cannot do this') => new HttpError(403, m);
export const notFound = (m = 'Not found') => new HttpError(404, m);
export const conflict = (m) => new HttpError(409, m);

// Wrap async route handlers so thrown errors reach the error middleware.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorMiddleware(err, req, res, _next) {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: 'Please check the highlighted fields', details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'File too large' });
  req.log?.error({ err }, 'unhandled');
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
