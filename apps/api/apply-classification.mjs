/**
 * apply-classification.mjs
 * يطبّق التصنيف المقترح على جدول Objective و OperationalActivity
 */
import { PrismaClient } from '@prisma/client';
import { OBJECTIVES_CLASSIFICATION, ACTIVITIES_CLASSIFICATION } from './kpi-classification-proposal.mjs';

const prisma = new PrismaClient();

async function run() {
  console.log('🚀 تطبيق التصنيف على قاعدة البيانات...\n');

  // ── الأهداف الاستراتيجية ────────────────────────────────
  console.log('🎯 تحديث الأهداف الاستراتيجية...');
  let oUpdated = 0, oSkipped = 0;
  for (const [title, cls] of Object.entries(OBJECTIVES_CLASSIFICATION)) {
    const obj = await prisma.objective.findFirst({ where: { title } });
    if (!obj) { console.log(`  ⚠️  غير موجود: ${title}`); oSkipped++; continue; }
    await prisma.objective.update({
      where: { id: obj.id },
      data: {
        kpiType:     cls.type,
        seasonality: cls.seasonality || 'UNIFORM',
        direction:   cls.direction || 'HIGHER_BETTER',
        unit:        cls.unit || obj.unit,
      }
    });
    console.log(`  ✅  ${cls.type.padEnd(10)} | ${title}`);
    oUpdated++;
  }
  console.log(`   → ${oUpdated} مؤشراً حُدِّث، ${oSkipped} لم يُعثر عليه\n`);

  // ── النشاطات التشغيلية ──────────────────────────────────
  console.log('⚙️  تحديث النشاطات التشغيلية...');
  let aUpdated = 0, aSkipped = 0;
  for (const [code, cls] of Object.entries(ACTIVITIES_CLASSIFICATION)) {
    const act = await prisma.operationalActivity.findUnique({ where: { code } });
    if (!act) { console.log(`  ⚠️  غير موجود: ${code}`); aSkipped++; continue; }
    await prisma.operationalActivity.update({
      where: { id: act.id },
      data: {
        kpiType:     cls.type,
        targetValue: cls.targetValue,
        targetUnit:  cls.unit,
        seasonality: cls.seasonality || 'UNIFORM',
        direction:   cls.direction || 'HIGHER_BETTER',
      }
    });
    console.log(`  ✅  ${code} | ${cls.type.padEnd(10)} | ${cls.targetValue} ${cls.unit}`);
    aUpdated++;
  }
  console.log(`   → ${aUpdated} نشاطاً حُدِّث، ${aSkipped} لم يُعثر عليه\n`);

  console.log('🎉 اكتمل التطبيق!');
}

run()
  .catch(e => { console.error('❌ خطأ:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
