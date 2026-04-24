import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerTenantsRoutes(router, engine) {
  // GET /api/v1/tenants/current
  router.get("/api/v1/tenants/current", { auth: true }, async ({ session }) => {
    const tenant = engine.state.tenants.find((t) => t.id === session.tenantId);
    if (!tenant) throw new DomainError("NOT_FOUND", "Tenant not found.", 404);
    return tenant;
  });

  // PATCH /api/v1/tenants/current
  router.patch("/api/v1/tenants/current", { auth: true, permission: "settings:write" }, async ({ session, body }) => {
    const tenant = engine.state.tenants.find((t) => t.id === session.tenantId);
    if (!tenant) throw new DomainError("NOT_FOUND", "Tenant not found.", 404);

    if (body.name !== undefined) tenant.name = body.name.trim();
    if (body.taxRegistrationNo !== undefined) tenant.taxRegistrationNo = body.taxRegistrationNo?.trim() || null;
    if (body.allowNegativeStock !== undefined) tenant.allowNegativeStock = Boolean(body.allowNegativeStock);
    if (body.valuationMethod !== undefined) tenant.valuationMethod = body.valuationMethod;

    return tenant;
  });
}
