export function notFound(req, res) {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'المسار غير موجود' } });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL';
  const message = err.message || 'خطأ داخلي في الخادم';
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    ok: false,
    error: { code, message, ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) },
  });
}
