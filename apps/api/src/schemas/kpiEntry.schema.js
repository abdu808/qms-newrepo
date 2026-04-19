/**
 * schemas/kpiEntry.schema.js — تحقق Zod لقراءات KPI الشهرية.
 *
 * @@unique([objectiveId, year, month]) / @@unique([activityId, year, month])
 * تمنع التكرار على مستوى قاعدة البيانات.
 */
import { z } from 'zod';
import { idString, optionalTrimmedString } from './_helpers.js';

const currentYear = new Date().getFullYear();

const yearField = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().int().min(2020).max(currentYear + 2),
);

const monthField = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().int().min(1).max(12),
);

const numField = (min = 0) => z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().min(min).nullable().optional(),
);

const requiredNumField = (min = 0) => z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().min(min),
);

// على الأقل objectiveId أو activityId — واحد منهما.
const baseShape = {
  objectiveId:  idString.nullable().optional(),
  activityId:   idString.nullable().optional(),
  year:         yearField,
  month:        monthField,
  actualValue:  requiredNumField(0),
  spent:        numField(0),
  evidenceUrl:  optionalTrimmedString(500),
  note:         optionalTrimmedString(2000),
};

export const createSchema = z.object(baseShape)
  .strip()
  .refine(
    d => !!d.objectiveId || !!d.activityId,
    { message: 'يجب تحديد objectiveId أو activityId', path: ['objectiveId'] },
  );

export const updateSchema = z.object({
  actualValue: requiredNumField(0).optional(),
  spent:       numField(0),
  evidenceUrl: optionalTrimmedString(500),
  note:        optionalTrimmedString(2000),
}).strip();

export const querySchema = z.object({
  objectiveId: idString.optional(),
  activityId:  idString.optional(),
  year:        yearField.optional(),
  month:       monthField.optional(),
}).strip();
