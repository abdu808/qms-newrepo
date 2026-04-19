import { prisma } from './db.js';

const count = await prisma.user.count();
if (count === 0) {
  console.log('[seed-if-empty] empty DB — running full seed');
  await import('./seed.js');
} else {
  console.log(`[seed-if-empty] DB already has ${count} users — skipping`);
  await prisma.$disconnect();
}
