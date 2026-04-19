/**
 * permissions-matrix.js — Single Source of Truth for Role-Based Access Control
 *
 * ISO 9001:2015 §5.3 — Organizational roles, responsibilities and authorities
 * ISO 9001:2015 §7.1.2 — People (competence and separation of duty)
 *
 * Roles (tiered, lowest → highest):
 *   GUEST_AUDITOR   — external auditor, read-only (enforced by denyReadOnly)
 *   EMPLOYEE        — data entry (maker)
 *   DEPT_MANAGER    — departmental manager (checker for own dept)
 *   COMMITTEE_MEMBER— quality committee reviewer
 *   QUALITY_MANAGER — quality dept manager (approver)
 *   SUPER_ADMIN     — system administrator
 *
 * Actions:
 *   read     — list + detail   (GET)
 *   create   — new record      (POST)
 *   update   — modify record   (PUT/PATCH)
 *   delete   — remove record   (DELETE)
 *   approve  — workflow approve (custom endpoints)
 *   close    — close/finalize  (custom endpoints)
 *
 * If a resource is NOT listed here, crudRouter falls back to SAFE DEFAULT:
 *   read   → any authenticated user
 *   create → EMPLOYEE+
 *   update → DEPT_MANAGER+
 *   delete → QUALITY_MANAGER+
 */

// ── Role tiers (array order = seniority, lowest → highest) ─────────────
export const ROLE_TIERS = [
  'GUEST_AUDITOR',
  'EMPLOYEE',
  'DEPT_MANAGER',
  'COMMITTEE_MEMBER',
  'QUALITY_MANAGER',
  'SUPER_ADMIN',
];

// ── Role shortcuts ─────────────────────────────────────────────────────
export const ANY         = ROLE_TIERS;                                    // any authenticated user (incl. guest)
export const EMPLOYEE_UP = ['EMPLOYEE','DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
export const MANAGER_UP  = ['DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
export const COMMITTEE_UP= ['COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
export const QM_UP       = ['QUALITY_MANAGER','SUPER_ADMIN'];
export const SA          = ['SUPER_ADMIN'];

// ── Default policy applied when a resource is absent ───────────────────
export const DEFAULT_POLICY = {
  read:    ANY,
  create:  EMPLOYEE_UP,
  update:  MANAGER_UP,
  delete:  QM_UP,
  approve: QM_UP,
  close:   QM_UP,
};

// ── Resource-specific policies ─────────────────────────────────────────
// Resource names = kebab-case segments matching server.js route mounts
//   (donations, ncr, audits, suppliers, beneficiaries …)
export const MATRIX = {
  // ── People & Org ─────────────────────────────────────────────────
  users:            { read: MANAGER_UP, create: SA,    update: SA,    delete: SA },
  departments:      { read: ANY,        create: QM_UP, update: QM_UP, delete: SA },
  'strategic-goals':{ read: ANY,        create: QM_UP, update: QM_UP, delete: QM_UP },

  // ── Planning (ISO clause 6) ──────────────────────────────────────
  objectives:       { read: ANY, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP },
  risks:            { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  swot:             { read: ANY, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP },
  'interested-parties': { read: ANY, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP },

  // ── Context & Processes (ISO 4) ──────────────────────────────────
  processes:        { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },
  'quality-policy': { read: ANY, create: QM_UP, update: QM_UP, delete: SA, activate: QM_UP },

  // ── Support (ISO 7) ──────────────────────────────────────────────
  documents:        { read: ANY, create: EMPLOYEE_UP, update: EMPLOYEE_UP, delete: QM_UP, approve: QM_UP, publish: QM_UP },
  training:         { read: ANY, create: MANAGER_UP,  update: MANAGER_UP,  delete: QM_UP },
  competence:       { read: ANY, create: MANAGER_UP,  update: MANAGER_UP,  delete: QM_UP },
  // Performance reviews: manager creates/updates, QM finalizes (maps to `delete` role tier for guardrail)
  'performance-reviews': { read: MANAGER_UP, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP },
  // Continual improvement: any employee can propose, managers update, QM approves/closes
  'improvement-projects': { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  // Audit checklists: QM-owned templates
  'audit-checklists': { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },
  // Ack documents (policies/charters): QM manages, all employees read + ack
  'ack-documents':    { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },
  communication:    { read: ANY, create: MANAGER_UP,  update: MANAGER_UP,  delete: QM_UP },

  // ── Operation (ISO 8) ────────────────────────────────────────────
  'operational-activities': { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  suppliers:        { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  'supplier-evals': { read: ANY, create: MANAGER_UP,  update: MANAGER_UP, delete: QM_UP },

  // ── Charity-specific ─────────────────────────────────────────────
  donations:        { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  'donation-evals': { read: ANY, create: MANAGER_UP,  update: MANAGER_UP, delete: QM_UP },
  beneficiaries:    { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP },
  programs:         { read: ANY, create: MANAGER_UP,  update: MANAGER_UP, delete: QM_UP },

  // ── Performance Evaluation (ISO 9) ───────────────────────────────
  complaints:       { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP, close: QM_UP },
  surveys:          { read: ANY, create: MANAGER_UP,  update: MANAGER_UP, delete: QM_UP },
  audits:           { read: ANY, create: QM_UP,       update: QM_UP,      delete: QM_UP },
  'management-review': { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },

  // ── Improvement (ISO 10) ─────────────────────────────────────────
  ncr:              { read: ANY, create: EMPLOYEE_UP, update: MANAGER_UP, delete: QM_UP, close: QM_UP },

  // ── Signatures & audit logs ──────────────────────────────────────
  signatures:       { read: ANY, create: EMPLOYEE_UP, update: QM_UP, delete: SA },
  'audit-log':      { read: QM_UP, create: SA, update: SA, delete: SA },
  'eval-tokens':    { read: MANAGER_UP, create: MANAGER_UP, update: QM_UP, delete: QM_UP },

  // ── KPI & ISO readiness ──────────────────────────────────────────
  kpi:              { read: ANY, create: MANAGER_UP, update: MANAGER_UP, delete: QM_UP },
  'iso-readiness':  { read: ANY, create: QM_UP, update: QM_UP, delete: QM_UP },

  // ── Proactive alerts (live health signals) ───────────────────────
  // للقراءة فقط لإدارة الجودة والمسؤولين؛ لا عمليات كتابة (detectors محسوبة).
  alerts:           { read: MANAGER_UP },
};

/**
 * Lookup the allowed roles for a (resource, action) pair.
 * Returns null if action not defined AND no default exists (treat as forbidden).
 */
export function rolesFor(resource, action) {
  const policy = MATRIX[resource];
  if (policy && policy[action]) return policy[action];
  if (DEFAULT_POLICY[action])   return DEFAULT_POLICY[action];
  return null;
}
