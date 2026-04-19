/**
 * utils/pagination.js — helper موحَّد للـ pagination في المسارات المخصصة.
 *
 * الاستخدام:
 *   const { page, limit, skip } = parsePagination(req);
 *   const [total, items] = await Promise.all([
 *     prisma.x.count({ where }),
 *     prisma.x.findMany({ where, skip, take: limit, orderBy: {...} }),
 *   ]);
 *   res.json({ ok: true, ...paginationEnvelope({ total, page, limit, items }) });
 *
 * Envelope موحّد عبر كل النظام: { total, page, limit, pages, items }.
 */

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;

export function parsePagination(req, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  const page = Math.max(1, parseInt(req.query?.page) || 1);
  let limit = parseInt(req.query?.limit) || defaultLimit;
  limit = Math.max(1, Math.min(limit, maxLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationEnvelope({ total, page, limit, items }) {
  return {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    items,
  };
}
