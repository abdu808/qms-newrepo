/**
 * lib/reportBuilder.js — محرّك Report Builder (MVP)
 *
 * نموذج العمل:
 *   - يعرّف المستخدم "تعريف تقرير" (definition):
 *       { dataset, columns, filters, groupBy?, aggregations?, sort?, limit? }
 *   - الـ backend يوثِّق datasets مُدرَجة في الـ CATALOG (whitelist) — لا يسمح
 *     بأي حقل خارجها لمنع تسرُّب بيانات أو Prisma injection.
 *   - filters تُترجَم لعبارات where آمنة (eq/ne/in/gt/gte/lt/lte/contains/between).
 *   - groupBy + aggregations → prisma.groupBy.
 *   - بدون groupBy → prisma.findMany.
 *
 * ISO 9001:2015 §7.5.3 — "الاستخراج والاستجاعة" للمعلومات الموثّقة.
 */
import { prisma } from '../db.js';
import { BadRequest } from '../utils/errors.js';
import { activeWhere } from './dataHelpers.js';

// ═══════════════════════════════════════════════════════════════════════════
// CATALOG — مجموعات البيانات المسموح بها
// ═══════════════════════════════════════════════════════════════════════════
// لكل dataset:
//   model        — اسم Prisma model
//   label        — للعرض بالعربية
//   fields       — map: key -> { label, type, filter, groupable?, aggregatable? }
//     type: 'string' | 'number' | 'date' | 'enum' | 'boolean'
//     filter: true/false — هل يقبل فلاتر؟
//   relations    — include موحَّد عند findMany
//   softDelete   — هل يطبِّق activeWhere (deletedAt: null)؟

export const CATALOG = {
  ncr: {
    model: 'nCR', label: 'عدم المطابقة (NCR)', softDelete: true,
    fields: {
      id:            { label: 'المعرّف',       type: 'string', filter: true  },
      code:          { label: 'الرمز',         type: 'string', filter: true  },
      title:         { label: 'العنوان',       type: 'string', filter: true  },
      status:        { label: 'الحالة',        type: 'enum',   filter: true, groupable: true, enum: ['OPEN','ROOT_CAUSE','ACTION_PLANNED','IN_PROGRESS','VERIFICATION','CLOSED'] },
      severity:      { label: 'الخطورة',       type: 'enum',   filter: true, groupable: true, enum: ['LOW','MEDIUM','HIGH','CRITICAL'] },
      departmentId:  { label: 'القسم',         type: 'string', filter: true, groupable: true },
      assigneeId:    { label: 'المُسنَد إليه',  type: 'string', filter: true, groupable: true },
      createdAt:     { label: 'تاريخ الإنشاء',  type: 'date',   filter: true },
      dueDate:       { label: 'تاريخ الاستحقاق', type: 'date', filter: true },
      closedAt:      { label: 'تاريخ الإغلاق',  type: 'date',   filter: true },
      workflowState: { label: 'حالة سير العمل', type: 'enum',   filter: true, groupable: true },
    },
    relations: {
      department: { select: { id: true, name: true } },
      assignee:   { select: { id: true, name: true } },
    },
  },

  complaints: {
    model: 'complaint', label: 'الشكاوى', softDelete: true,
    fields: {
      id:         { label: 'المعرّف',   type: 'string', filter: true },
      code:       { label: 'الرمز',     type: 'string', filter: true },
      subject:    { label: 'الموضوع',   type: 'string', filter: true },
      status:     { label: 'الحالة',    type: 'enum',   filter: true, groupable: true, enum: ['NEW','UNDER_REVIEW','IN_PROGRESS','RESOLVED','CLOSED'] },
      severity:   { label: 'الخطورة',   type: 'enum',   filter: true, groupable: true },
      assigneeId: { label: 'المُسنَد إليه', type: 'string', filter: true, groupable: true },
      receivedAt: { label: 'تاريخ الاستلام', type: 'date', filter: true },
      resolvedAt: { label: 'تاريخ الحل', type: 'date', filter: true },
      satisfaction: { label: 'الرضا (1-5)', type: 'number', filter: true, aggregatable: true },
    },
    relations: {
      assignee: { select: { id: true, name: true } },
    },
  },

  documents: {
    model: 'document', label: 'الوثائق', softDelete: true,
    fields: {
      id:         { label: 'المعرّف',   type: 'string', filter: true },
      code:       { label: 'الرمز',     type: 'string', filter: true },
      title:      { label: 'العنوان',   type: 'string', filter: true },
      status:     { label: 'الحالة',    type: 'enum',   filter: true, groupable: true, enum: ['DRAFT','UNDER_REVIEW','APPROVED','PUBLISHED','OBSOLETE'] },
      category:   { label: 'الفئة',     type: 'string', filter: true, groupable: true },
      reviewDate: { label: 'تاريخ المراجعة التالية', type: 'date', filter: true },
      version:    { label: 'الإصدار',   type: 'string', filter: true },
      createdAt:  { label: 'تاريخ الإنشاء', type: 'date', filter: true },
    },
  },

  suppliers: {
    model: 'supplier', label: 'الموردون', softDelete: true,
    fields: {
      id:       { label: 'المعرّف', type: 'string', filter: true },
      code:     { label: 'الرمز',   type: 'string', filter: true },
      name:     { label: 'الاسم',   type: 'string', filter: true },
      status:   { label: 'الحالة',  type: 'enum',   filter: true, groupable: true, enum: ['PENDING','APPROVED','REJECTED','SUSPENDED'] },
      category: { label: 'الفئة',   type: 'string', filter: true, groupable: true },
      rating:   { label: 'التقييم', type: 'number', filter: true, aggregatable: true },
    },
  },

  objectives: {
    model: 'objective', label: 'الأهداف (KPI)', softDelete: true,
    fields: {
      id:         { label: 'المعرّف', type: 'string', filter: true },
      code:       { label: 'الرمز',   type: 'string', filter: true },
      title:      { label: 'العنوان', type: 'string', filter: true },
      status:     { label: 'الحالة',  type: 'enum',   filter: true, groupable: true },
      ownerId:    { label: 'المسؤول', type: 'string', filter: true, groupable: true },
      target:     { label: 'المستهدف', type: 'number', filter: true, aggregatable: true },
      createdAt:  { label: 'تاريخ الإنشاء', type: 'date', filter: true },
    },
    relations: {
      strategicGoal: { select: { id: true, title: true, perspective: true } },
    },
  },

  beneficiaries: {
    model: 'beneficiary', label: 'المستفيدون', softDelete: true,
    fields: {
      id:         { label: 'المعرّف', type: 'string', filter: true },
      code:       { label: 'الرمز',   type: 'string', filter: true },
      fullName:   { label: 'الاسم',   type: 'string', filter: true },
      status:     { label: 'الحالة',  type: 'enum',   filter: true, groupable: true },
      category:   { label: 'الفئة',   type: 'string', filter: true, groupable: true },
      assessedAt: { label: 'تاريخ التقييم', type: 'date', filter: true },
      createdAt:  { label: 'تاريخ التسجيل', type: 'date', filter: true },
    },
  },

  audits: {
    model: 'audit', label: 'التدقيق الداخلي', softDelete: true,
    fields: {
      id:       { label: 'المعرّف', type: 'string', filter: true },
      code:     { label: 'الرمز',   type: 'string', filter: true },
      title:    { label: 'العنوان', type: 'string', filter: true },
      type:     { label: 'النوع',   type: 'string', filter: true, groupable: true },
      status:   { label: 'الحالة',  type: 'enum',   filter: true, groupable: true, enum: ['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'] },
      scheduledDate: { label: 'التاريخ المقرَّر', type: 'date', filter: true },
      completedAt:   { label: 'تاريخ الإتمام',   type: 'date', filter: true },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Filter operators → Prisma
// ═══════════════════════════════════════════════════════════════════════════
const OPS = {
  eq:        (v) => v,
  ne:        (v) => ({ not: v }),
  in:        (v) => ({ in:  Array.isArray(v) ? v : [v] }),
  notIn:     (v) => ({ notIn: Array.isArray(v) ? v : [v] }),
  gt:        (v) => ({ gt: v }),
  gte:       (v) => ({ gte: v }),
  lt:        (v) => ({ lt: v }),
  lte:       (v) => ({ lte: v }),
  between:   (v) => ({ gte: v[0], lte: v[1] }),
  contains:  (v) => ({ contains: String(v), mode: 'insensitive' }),
  isNull:    ()  => null,
  isNotNull: ()  => ({ not: null }),
};

function coerceValue(field, raw) {
  if (raw == null) return raw;
  if (field.type === 'number') return Array.isArray(raw) ? raw.map(Number) : Number(raw);
  if (field.type === 'date')   {
    if (Array.isArray(raw)) return raw.map(x => new Date(x));
    return new Date(raw);
  }
  if (field.type === 'boolean') return Boolean(raw);
  return raw;
}

function buildWhere(catalogEntry, filters = []) {
  const where = {};
  for (const f of filters) {
    const { field: fieldKey, op, value } = f || {};
    if (!fieldKey || !op) continue;
    const field = catalogEntry.fields[fieldKey];
    if (!field || !field.filter) {
      throw BadRequest(`الحقل غير مسموح بتصفيته: ${fieldKey}`);
    }
    if (!OPS[op]) throw BadRequest(`عامل تصفية غير مدعوم: ${op}`);
    const v = coerceValue(field, value);
    where[fieldKey] = OPS[op](v);
  }
  return where;
}

// ═══════════════════════════════════════════════════════════════════════════
// Runner
// ═══════════════════════════════════════════════════════════════════════════

const MAX_ROWS = 5000;

export function listDatasets() {
  return Object.entries(CATALOG).map(([key, e]) => ({
    key, label: e.label,
    fields: Object.entries(e.fields).map(([k, f]) => ({
      key: k, label: f.label, type: f.type,
      filter: !!f.filter, groupable: !!f.groupable, aggregatable: !!f.aggregatable,
      ...(f.enum ? { enum: f.enum } : {}),
    })),
  }));
}

export async function runReport(definition = {}) {
  const {
    dataset,
    columns = [],
    filters = [],
    groupBy,
    aggregations = [],
    sort = [],
    limit = 1000,
  } = definition;

  const entry = CATALOG[dataset];
  if (!entry) throw BadRequest(`مجموعة البيانات غير معروفة: ${dataset}`);

  const safeLimit = Math.min(Math.max(1, Number(limit) || 1000), MAX_ROWS);
  const where = entry.softDelete
    ? activeWhere(buildWhere(entry, filters))
    : buildWhere(entry, filters);

  // ─── وضع التجميع (groupBy) ─────────────────────────────────
  if (groupBy) {
    const groupField = entry.fields[groupBy];
    if (!groupField || !groupField.groupable) {
      throw BadRequest(`لا يمكن التجميع حسب: ${groupBy}`);
    }
    const _count = { _all: true };
    const _sum = {}, _avg = {}, _min = {}, _max = {};
    for (const a of aggregations) {
      const f = entry.fields[a.field];
      if (!f || !f.aggregatable) throw BadRequest(`حقل غير قابل للتجميع: ${a.field}`);
      if (a.fn === 'sum') _sum[a.field] = true;
      else if (a.fn === 'avg') _avg[a.field] = true;
      else if (a.fn === 'min') _min[a.field] = true;
      else if (a.fn === 'max') _max[a.field] = true;
      else throw BadRequest(`دالة تجميع غير مدعومة: ${a.fn}`);
    }
    const args = {
      by: [groupBy], where, _count,
      ...(Object.keys(_sum).length ? { _sum } : {}),
      ...(Object.keys(_avg).length ? { _avg } : {}),
      ...(Object.keys(_min).length ? { _min } : {}),
      ...(Object.keys(_max).length ? { _max } : {}),
      orderBy: { [groupBy]: 'asc' },
    };
    const rows = await prisma[entry.model].groupBy(args);
    return { mode: 'groupBy', groupBy, rows, total: rows.length };
  }

  // ─── وضع القائمة (findMany) ────────────────────────────────
  // columns تُستخدم لبناء select (ضمن المسموح) + relations المدرجة
  let select;
  if (columns.length) {
    select = {};
    for (const col of columns) {
      if (!entry.fields[col]) throw BadRequest(`عمود غير مسموح: ${col}`);
      select[col] = true;
    }
  }

  const orderBy = [];
  for (const s of sort) {
    if (!entry.fields[s.field]) continue;
    orderBy.push({ [s.field]: s.dir === 'desc' ? 'desc' : 'asc' });
  }
  if (!orderBy.length) orderBy.push({ [columns[0] || 'id']: 'asc' });

  const findArgs = {
    where, orderBy, take: safeLimit,
  };
  // prisma لا يقبل select+include معاً — في وضع columns نرجع الحقول فقط
  if (select) findArgs.select = select;
  else if (entry.relations) findArgs.include = entry.relations;

  const rows = await prisma[entry.model].findMany(findArgs);
  return { mode: 'list', columns: columns.length ? columns : Object.keys(entry.fields), rows, total: rows.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV serializer
// ═══════════════════════════════════════════════════════════════════════════
export function toCsv(result) {
  const esc = (v) => {
    if (v == null) return '';
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') v = JSON.stringify(v);
    const s = String(v).replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };

  if (result.mode === 'groupBy') {
    const sample = result.rows[0] || {};
    const aggKeys = [];
    for (const k of ['_count','_sum','_avg','_min','_max']) {
      if (sample[k]) {
        for (const inner of Object.keys(sample[k])) aggKeys.push(`${k}.${inner}`);
      }
    }
    const headers = [result.groupBy, ...aggKeys];
    const lines = [headers.join(',')];
    for (const r of result.rows) {
      lines.push([
        r[result.groupBy],
        ...aggKeys.map(k => {
          const [outer, inner] = k.split('.');
          return r[outer]?.[inner];
        }),
      ].map(esc).join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  const cols = result.columns;
  const lines = [cols.join(',')];
  for (const r of result.rows) {
    lines.push(cols.map(c => esc(r[c])).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}
