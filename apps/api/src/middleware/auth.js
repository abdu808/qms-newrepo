import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { Unauthorized, Forbidden } from '../utils/errors.js';

export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
    if (!token) throw Unauthorized('الرجاء تسجيل الدخول');
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload;
    next();
  } catch (e) {
    next(Unauthorized('الجلسة منتهية أو غير صالحة'));
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(Unauthorized());
    if (roles.length && !roles.includes(req.user.role)) {
      return next(Forbidden('ليس لديك صلاحية تنفيذ هذا الإجراء'));
    }
    next();
  };
}

// Read-only roles cannot mutate
export function denyReadOnly(req, res, next) {
  if (req.user?.role === 'GUEST_AUDITOR' && req.method !== 'GET') {
    return next(Forbidden('هذا الحساب للقراءة فقط'));
  }
  next();
}
