import { crudRouter } from '../utils/crudFactory.js';
export default crudRouter({
  resource: 'departments',
  model: 'department',
  softDelete: false,                 // Department has no `deletedAt` column
  searchFields: ['name', 'code'],
  allowedSortFields: ['createdAt', 'name', 'code'],
});
