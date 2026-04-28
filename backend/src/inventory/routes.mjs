import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerInventoryRoutes(router, engine) {
  // GET /api/v1/inventory/balances
  router.get("/api/v1/inventory/balances", { auth: true, permission: "inventory:read" }, async ({ session, query }) => {
    return engine.getInventoryBalances(session, {
      warehouseId: query.warehouseId || null,
      productId: query.productId || null
    });
  });

  // GET /api/v1/inventory/movements
  router.get("/api/v1/inventory/movements", { auth: true, permission: "inventory:read" }, async ({ session, query }) => {
    let movements = engine.state.stockMovements.filter((m) => m.tenantId === session.tenantId);
    if (query.warehouseId) {
      movements = movements.filter((m) => m.warehouseId === query.warehouseId);
    }
    if (query.productId) {
      movements = movements.filter((m) => m.productId === query.productId);
    }
    if (query.movementType) {
      movements = movements.filter((m) => m.movementType === query.movementType);
    }
    // Enrich movements with product & warehouse names
    return movements.map((m) => {
      const prod = engine.state.products.find((p) => p.id === m.productId);
      const wh = engine.state.warehouses.find((w) => w.id === m.warehouseId);
      return {
        ...m,
        sku: prod?.sku,
        productName: prod?.name,
        uom: prod?.uom,
        warehouseCode: wh?.code,
        warehouseName: wh?.name
      };
    }).reverse();
  });

  // POST /api/v1/inventory/receipts
  router.post("/api/v1/inventory/receipts", { auth: true, permission: "inventory:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.recordStockReceipt(session, body);
  });

  // POST /api/v1/inventory/adjustments
  router.post("/api/v1/inventory/adjustments", { auth: true, permission: "inventory:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.recordStockAdjustment(session, body);
  });

  // POST /api/v1/inventory/transfers
  router.post("/api/v1/inventory/transfers", { auth: true, permission: "inventory:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.transferStock(session, body);
  });

  // POST /api/v1/inventory/reversals
  router.post("/api/v1/inventory/reversals", { auth: true, permission: "inventory:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.reverseStockMovement(session, body);
  });

  // PUT /api/v1/inventory/movements/:id -> 405 Immutable Ledger Error
  router.put("/api/v1/inventory/movements/:id", { auth: true }, async () => {
    throw new DomainError(
      "IMMUTABLE_LEDGER_ERROR",
      "Historical stock movements are immutable and cannot be edited directly. Create a reversal entry instead.",
      405
    );
  });

  // PATCH /api/v1/inventory/movements/:id -> 405 Immutable Ledger Error
  router.patch("/api/v1/inventory/movements/:id", { auth: true }, async () => {
    throw new DomainError(
      "IMMUTABLE_LEDGER_ERROR",
      "Historical stock movements are immutable and cannot be edited directly. Create a reversal entry instead.",
      405
    );
  });
}
