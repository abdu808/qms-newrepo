import { crudRouter } from '../utils/crudFactory.js';

export default crudRouter({
  resource: 'competence',
  model: 'competenceRequirement',
  codePrefix: 'COMP',
  searchFields: ['jobTitle', 'department', 'requiredSkills', 'certifications'],
  allowedSortFields: ['createdAt', 'jobTitle', 'status'],
});
