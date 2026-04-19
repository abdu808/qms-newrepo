import { crudRouter } from '../utils/crudFactory.js';
import { BadRequest } from '../utils/errors.js';

export default crudRouter({
  resource: 'programs',
  model: 'program',
  codePrefix: 'PRG',
  searchFields: ['name', 'description'],
  allowedSortFields: ['createdAt', 'startDate', 'status'],
  // C8: المصروف لا يتجاوز الميزانية المعتمدة
  beforeCreate: async (data) => {
    if (data.budget != null && data.spent != null) {
      if (Number(data.spent) > Number(data.budget)) {
        throw BadRequest('المبلغ المصروف لا يمكن أن يتجاوز الميزانية المعتمدة للبرنامج');
      }
    }
    return data;
  },
  beforeUpdate: async (data, req) => {
    // C8: التحقق من سقف الميزانية
    if (data.spent != null || data.budget != null) {
      const { prisma } = await import('../db.js');
      const current = await prisma.program.findUnique({
        where: { id: req.params.id },
        select: { budget: true, spent: true },
      });
      if (current) {
        const newBudget = data.budget != null ? Number(data.budget) : Number(current.budget ?? 0);
        const newSpent  = data.spent  != null ? Number(data.spent)  : Number(current.spent  ?? 0);
        if (newSpent > newBudget) {
          throw BadRequest('المبلغ المصروف لا يمكن أن يتجاوز الميزانية المعتمدة للبرنامج');
        }
      }
    }
    return data;
  },
});
