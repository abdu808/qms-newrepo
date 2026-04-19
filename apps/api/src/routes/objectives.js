import { crudRouter } from '../utils/crudFactory.js';
import { BadRequest } from '../utils/errors.js';
import { createSchema as objCreateSchema, updateSchema as objUpdateSchema } from '../schemas/objective.schema.js';

export default crudRouter({
  resource: 'objectives',
  model: 'objective',
  codePrefix: 'OBJ',
  searchFields: ['title', 'description', 'kpi'],
  include: { department: true, owner: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'dueDate', 'status', 'progress'],
  allowedFilters: ['status', 'departmentId', 'ownerId'],
  schemas: { create: objCreateSchema, update: objUpdateSchema },
  smartFilters: {
    mine:       (req) => ({ ownerId: req.user.sub }),
    myDept:     (req) => req.user.departmentId ? { departmentId: req.user.departmentId } : {},
    open:       () => ({ status: { notIn: ['CLOSED', 'CANCELLED'] } }),
    closed:     () => ({ status: 'CLOSED' }),
    overdue:    () => ({
      dueDate: { lt: new Date(), not: null },
      status:  { notIn: ['CLOSED', 'CANCELLED'] },
    }),
    atRisk:     () => ({
      progress: { lt: 50 },
      status:   { notIn: ['CLOSED', 'CANCELLED'] },
    }),
    thisMonth:  () => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      return { createdAt: { gte: d } };
    },
  },
  beforeCreate: async (data, req) => ({ ...data, createdById: req.user.sub }),
  beforeUpdate: async (data) => {
    // ISO 6.2: نسبة التقدم يجب أن تكون بين 0 و 100
    if (data.progress != null) {
      const p = Number(data.progress);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw BadRequest('نسبة التقدم يجب أن تكون بين 0 و 100');
      }
      data.progress = Math.round(p);
    }
    return data;
  },
});
