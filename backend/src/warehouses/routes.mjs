import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerWarehousesRoutes(router, engine) {
  // GET /api/v1/warehouses
  router.get("/api/v1/warehouses", { auth: true, permission: "warehouses:read" }, async ({ session }) => {
    return engine.state.warehouses.filter((w) => w.tenantId === session.tenantId);
  });

  // POST /api/v1/warehouses
  router.post("/api/v1/warehouses", { auth: true, permission: "warehouses:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createWarehouse(session, body);
  });

  // GET /api/v1/warehouses/:id
  router.get("/api/v1/warehouses/:id", { auth: true, permission: "warehouses:read" }, async ({ session, params }) => {
    const warehouse = engine.state.warehouses.find(
      (w) => w.tenantId === session.tenantId && w.id === params.id
    );
    if (!warehouse) throw new DomainError("NOT_FOUND", "Warehouse not found.", 404);
    return warehouse;
  });
}
