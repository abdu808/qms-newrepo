import { prisma } from '../db.js';

/**
 * Generate next sequential code like OBJ-2026-001
 */
export async function nextCode(model, prefix, year = new Date().getFullYear()) {
  const like = `${prefix}-${year}-%`;
  const last = await prisma[model].findFirst({
    where: { code: { startsWith: `${prefix}-${year}-` } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  let n = 1;
  if (last?.code) {
    const m = last.code.match(/-(\d+)$/);
    if (m) n = Number(m[1]) + 1;
  }
  return `${prefix}-${year}-${String(n).padStart(3, '0')}`;
}
