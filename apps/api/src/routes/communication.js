import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'communication',
  model: 'communicationPlan',
  codePrefix: 'COMM',
  searchFields: ['topic', 'audience', 'responsible', 'channel'],
  allowedSortFields: ['createdAt', 'frequency', 'status'],
});
