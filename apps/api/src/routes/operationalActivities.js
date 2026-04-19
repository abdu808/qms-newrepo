import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'operational-activities',
  model: 'operationalActivity',
  codePrefix: 'ACT',
  searchFields: ['title', 'description', 'responsible', 'department', 'perspective'],
  allowedSortFields: ['createdAt', 'status', 'progress', 'year', 'startDate', 'endDate'],
});
