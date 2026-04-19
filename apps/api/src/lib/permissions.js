/**
 * permissions.js — Authorization helpers built on permissions-matrix.js
 *
 * Usage:
 *   import { can, requireAction } from '../lib/permissions.js';
 *
 *   // inside a custom route handler:
 *   if (!can(req.user, 'donations', 'approve')) throw Forbidden();
 *
 *   // as express middleware:
 *   router.post('/:id/approve', requireAction('donations', 'approve'), handler);
 */
import { rolesFor } from './permissions-matrix.js';
import { Forbidden, Unauthorized } from '../utils/errors.js';

/**
 * Check if a user object can perform an action on a resource.
 * @param {{role?:string}|undefined} user
 * @param {string} resource
 * @param {string} action
 * @returns {boolean}
 */
export function can(user, resource, action) {
  if (!user?.role) return false;
  const allowed = rolesFor(resource, action);
  if (!allowed) return false;
  return allowed.includes(user.role);
}

/**
 * Express middleware factory: require that req.user can perform (resource, action).
 */
export function requireAction(resource, action) {
  return (req, res, next) => {
    if (!req.user) return next(Unauthorized());
    if (!can(req.user, resource, action)) {
      return next(Forbidden('ليس لديك صلاحية تنفيذ هذا الإجراء على هذا المورد'));
    }
    next();
  };
}

/**
 * HTTP method → action mapping used by crudRouter.
 */
export const METHOD_TO_ACTION = {
  GET:    'read',
  POST:   'create',
  PUT:    'update',
  PATCH:  'update',
  DELETE: 'delete',
};
