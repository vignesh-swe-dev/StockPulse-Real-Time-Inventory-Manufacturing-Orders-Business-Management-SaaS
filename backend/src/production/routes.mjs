import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerProductionRoutes(router, engine) {
  // GET /api/v1/production/boms
  router.get("/api/v1/production/boms", { auth: true, permission: "production:read" }, async ({ session }) => {
    return engine.state.boms.filter((b) => b.tenantId === session.tenantId).map((bom) => {
      const prod = engine.state.products.find((p) => p.id === bom.finishedProductId);
      return {
        ...bom,
        finishedProductName: prod?.name,
        finishedProductSku: prod?.sku,
        uom: prod?.uom
      };
    }).reverse();
  });

  // POST /api/v1/production/boms
  router.post("/api/v1/production/boms", { auth: true, permission: "production:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createBom(session, body);
  });

  // GET /api/v1/production/boms/:id
  router.get("/api/v1/production/boms/:id", { auth: true, permission: "production:read" }, async ({ session, params }) => {
    const bom = engine.state.boms.find((b) => b.tenantId === session.tenantId && b.id === params.id);
    if (!bom) throw new DomainError("NOT_FOUND", "BOM not found.", 404);
    const prod = engine.state.products.find((p) => p.id === bom.finishedProductId);
    return {
      ...bom,
      finishedProductName: prod?.name,
      finishedProductSku: prod?.sku,
      uom: prod?.uom
    };
  });

  // GET /api/v1/production/boms/:id/calculate
  router.get("/api/v1/production/boms/:id/calculate", { auth: true, permission: "production:read" }, async ({ session, params, query }) => {
    const plannedQty = Number(query.plannedQty || 1);
    return engine.calculateBomRequirements(session, params.id, plannedQty);
  });

  // POST /api/v1/production/boms/:id/calculate
  router.post("/api/v1/production/boms/:id/calculate", { auth: true, permission: "production:read", statusCode: 200 }, async ({ session, params, body }) => {
    const plannedQty = Number(body?.plannedQty || 1);
    return engine.calculateBomRequirements(session, params.id, plannedQty);
  });

  // GET /api/v1/production/batches
  router.get("/api/v1/production/batches", { auth: true, permission: "production:read" }, async ({ session, query }) => {
    let batches = engine.state.productionBatches.filter((b) => b.tenantId === session.tenantId);
    if (query.status) {
      batches = batches.filter((b) => b.status === query.status);
    }
    if (query.warehouseId) {
      batches = batches.filter((b) => b.warehouseId === query.warehouseId);
    }
    return batches.map((b) => {
      const prod = engine.state.products.find((p) => p.id === b.finishedProductId);
      const wh = engine.state.warehouses.find((w) => w.id === b.warehouseId);
      const bom = engine.state.boms.find((bom) => bom.id === b.bomId);
      return {
        ...b,
        finishedProductName: prod?.name,
        finishedProductSku: prod?.sku,
        uom: prod?.uom,
        warehouseCode: wh?.code,
        warehouseName: wh?.name,
        bomCode: bom?.code
      };
    }).reverse();
  });

  // POST /api/v1/production/batches
  router.post("/api/v1/production/batches", { auth: true, permission: "production:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createProductionBatch(session, body);
  });

  // GET /api/v1/production/batches/:id
  router.get("/api/v1/production/batches/:id", { auth: true, permission: "production:read" }, async ({ session, params }) => {
    const batch = engine.state.productionBatches.find(
      (b) => b.tenantId === session.tenantId && b.id === params.id
    );
    if (!batch) throw new DomainError("NOT_FOUND", "Production batch not found.", 404);
    const prod = engine.state.products.find((p) => p.id === batch.finishedProductId);
    const wh = engine.state.warehouses.find((w) => w.id === batch.warehouseId);
    const bom = engine.state.boms.find((bom) => bom.id === batch.bomId);
    return {
      ...batch,
      finishedProductName: prod?.name,
      finishedProductSku: prod?.sku,
      uom: prod?.uom,
      warehouseCode: wh?.code,
      warehouseName: wh?.name,
      bomCode: bom?.code
    };
  });

  // POST /api/v1/production/batches/:id/start
  router.post("/api/v1/production/batches/:id/start", { auth: true, permission: "production:write", statusCode: 200 }, async ({ session, params }) => {
    return engine.startProductionBatch(session, { batchId: params.id });
  });

  // POST /api/v1/production/batches/:id/complete
  router.post("/api/v1/production/batches/:id/complete", { auth: true, permission: "production:write", statusCode: 200 }, async ({ session, params, body }) => {
    return engine.completeProductionBatch(session, {
      batchId: params.id,
      actualGoodQty: body.actualGoodQty,
      rejectedWastageQty: body.rejectedWastageQty,
      actualLaborCostMinor: body.actualLaborCostMinor,
      actualOverheadCostMinor: body.actualOverheadCostMinor,
      actualConsumptions: body.actualConsumptions
    });
  });
}
