/**
 * schemas/objective.schema.js — تحقق Zod لأهداف الجودة (ISO 6.2).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString, idString, optionalDate } from './_helpers.js';

const STATUSES = ['PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'DELAYED', 'CANCELLED'];
const KPI_TYPES = ['CUMULATIVE', 'PERIODIC', 'SNAPSHOT', 'BINARY'];
const SEASONALITIES = ['UNIFORM', 'SCHOOL_START', 'EID_SEASONAL', 'RAMADAN_RELIEF', 'QUARTERLY', 'MONTHLY_EVEN'];
const DIRECTIONS = ['HIGHER_BETTER', 'LOWER_BETTER'];

const numField = (req = false) => {
  const base = z.preprocess(
    v => (v === '' || v == null ? null : Number(v)),
    z.number().nullable().optional(),
  );
  return req
    ? z.preprocess(v => (v === '' || v == null ? undefined : Number(v)), z.number())
    : base;
};

const dateRequired = z.preprocess(
  v => {
    if (v == null || v === '') return undefined;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d;
  },
  z.date({ required_error: 'التاريخ مطلوب' }),
);

export const createSchema = z.object({
  title:           trimmedString(3, 200),
  description:     optionalTrimmedString(5000),
  departmentId:    idString.nullable().optional(),
  kpi:             trimmedString(2, 200),
  baseline:        numField(false),
  target:          numField(true),
  unit:            optionalTrimmedString(40),
  currentValue:    numField(false),
  startDate:       dateRequired,
  dueDate:         dateRequired,
  status:          z.enum(STATUSES).default('PLANNED'),
  progress:        z.preprocess(v => (v === '' || v == null ? 0 : Number(v)), z.number().int().min(0).max(100)).optional(),
  ownerId:         idString.nullable().optional(),
  strategicGoalId: idString.nullable().optional(),
  kpiType:         z.enum(KPI_TYPES).optional(),
  seasonality:     z.enum(SEASONALITIES).optional(),
  direction:       z.enum(DIRECTIONS).optional(),
}).strip();

export const updateSchema = createSchema.partial();

export const querySchema = z.object({
  q:               z.string().max(200).optional(),
  status:          z.enum(STATUSES).optional(),
  departmentId:    idString.optional(),
  strategicGoalId: idString.optional(),
}).strip();
