/**
 * StockPulse Module: audit
 * Responsibility: AuditController & AuditInterceptor — Immutable tenant-scoped audit trail with sensitive-field scrubbing
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "audit",
  description: "AuditController & AuditInterceptor — Immutable tenant-scoped audit trail with sensitive-field scrubbing",
  apiPrefix: "/api/v1/audit"
};
