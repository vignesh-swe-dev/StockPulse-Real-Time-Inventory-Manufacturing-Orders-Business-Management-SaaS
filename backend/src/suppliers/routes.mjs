import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerSuppliersRoutes(router, engine) {
  // GET /api/v1/suppliers
  router.get("/api/v1/suppliers", { auth: true, permission: "suppliers:read" }, async ({ session, query }) => {
    let suppliers = engine.state.suppliers.filter((s) => s.tenantId === session.tenantId);
    if (query.search) {
      const q = query.search.toLowerCase();
      suppliers = suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
    }
    return suppliers;
  });

  // POST /api/v1/suppliers
  router.post("/api/v1/suppliers", { auth: true, permission: "suppliers:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createSupplier(session, body);
  });

  // GET /api/v1/suppliers/:id
  router.get("/api/v1/suppliers/:id", { auth: true, permission: "suppliers:read" }, async ({ session, params }) => {
    const supplier = engine.state.suppliers.find(
      (s) => s.tenantId === session.tenantId && s.id === params.id
    );
    if (!supplier) throw new DomainError("NOT_FOUND", "Supplier not found.", 404);
    return supplier;
  });
}
