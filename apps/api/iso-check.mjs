import { prisma } from './src/db.js';

const c = {
  swot:          await prisma.swotItem.count(),
  parties:       await prisma.interestedParty.count(),
  processes:     await prisma.process.count(),
  policy:        await prisma.qualityPolicy.count({ where: { active: true } }),
  risks:         await prisma.risk.count(),
  competence:    await prisma.competenceRequirement.count(),
  communication: await prisma.communicationPlan.count(),
  objectives:    await prisma.objective.count(),
  activities:    await prisma.operationalActivity.count(),
  kpiEntries:    await prisma.kpiEntry.count(),
  documents:     await prisma.document.count(),
  docsDraft:     await prisma.document.count({ where: { status: 'DRAFT' } }),
  docsPublished: await prisma.document.count({ where: { status: 'PUBLISHED' } }),
  docsApproved:  await prisma.document.count({ where: { status: 'APPROVED' } }),
  docsWithFiles: await prisma.document.count({ where: { versions: { some: {} } } }),
  training:      await prisma.training.count(),
  mgmtReview:    await prisma.managementReview.count(),
  suppliers:     await prisma.supplier.count(),
  supplierEvals: await prisma.supplierEval.count(),
  complaints:    await prisma.complaint.count(),
  ncr:           await prisma.nCR.count().catch(() => 0),
  audits:        await prisma.audit.count(),
  beneficiaries: await prisma.beneficiary.count(),
  donations:     await prisma.donation.count(),
  donationAmt:   await prisma.donation.aggregate({ _sum: { amount: true } }),
  surveys:       await prisma.survey.count(),
  users:         await prisma.user.count(),
  departments:   await prisma.department.count(),
  strategicGoals:await prisma.strategicGoal.count(),
  auditLog:      await prisma.auditLog.count(),
};

console.log(JSON.stringify(c, null, 2));
await prisma.$disconnect();
