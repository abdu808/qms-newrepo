export class AppError extends Error {
  constructor(message, status = 500, code = 'APP_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const BadRequest   = (msg = 'طلب غير صالح')  => new AppError(msg, 400, 'BAD_REQUEST');
export const Unauthorized = (msg = 'غير مصرح')       => new AppError(msg, 401, 'UNAUTHORIZED');
export const Forbidden    = (msg = 'صلاحيات غير كافية') => new AppError(msg, 403, 'FORBIDDEN');
export const NotFound     = (msg = 'غير موجود')       => new AppError(msg, 404, 'NOT_FOUND');
export const Conflict     = (msg = 'تعارض في البيانات') => new AppError(msg, 409, 'CONFLICT');
