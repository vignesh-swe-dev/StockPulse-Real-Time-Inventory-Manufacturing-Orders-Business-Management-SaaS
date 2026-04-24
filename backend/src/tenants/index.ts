/**
 * StockPulse Module: tenants
 * Responsibility: TenantsController & TenantsService — Multi-tenant provisioning, branch config, tenant-scoped settings
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "tenants",
  description: "TenantsController & TenantsService — Multi-tenant provisioning, branch config, tenant-scoped settings",
  apiPrefix: "/api/v1/tenants"
};
