import { prisma } from './src/db.js';

const tables = [
  'user','department','strategicGoal','objective','operationalActivity','kpiEntry',
  'swotItem','interestedParty','process','qualityPolicy','risk','competenceRequirement','communicationPlan',
  'document','docVersion','training','managementReview',
  'supplier','supplierEval','donation','donationEval','beneficiary','program','survey',
  'complaint','ncr','audit','signature','auditLog'
];

const counts = {};
for (const t of tables) {
  try { counts[t] = await prisma[t].count(); } catch { counts[t] = 'N/A'; }
}

const kpiByYear = await prisma.kpiEntry.groupBy({ by:['year'], _count:true });
const objWithTgt = await prisma.objective.count({ where: { target: { gt: 0 } } });
const actWithTgt = await prisma.operationalActivity.count({ where: { targetValue: { gt: 0 } } });
const objWithEntries = await prisma.objective.count({ where: { kpiEntries: { some: {} } } });
const actWithEntries = await prisma.operationalActivity.count({ where: { kpiEntries: { some: {} } } });
const docsByStatus = await prisma.document.groupBy({ by:['status'], _count:true });
const docsWithFiles = await prisma.document.count({ where: { versions: { some: {} } } });
const risksBySeverity = await prisma.risk.groupBy({ by:['severity'], _count:true }).catch(() => null);
const risksHigh = await prisma.risk.count({ where: { score: { gte: 15 } } });

const result = {
  counts, kpiByYear,
  objWithTgt, actWithTgt, objWithEntries, actWithEntries,
  docsByStatus, docsWithFiles, risksBySeverity, risksHigh,
};
console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect();
