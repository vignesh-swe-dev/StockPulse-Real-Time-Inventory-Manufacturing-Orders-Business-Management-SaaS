import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerPurchasesRoutes(router, engine) {
  // GET /api/v1/purchases/orders
  router.get("/api/v1/purchases/orders", { auth: true, permission: "purchases:read" }, async ({ session, query }) => {
    let pos = engine.state.purchaseOrders.filter((p) => p.tenantId === session.tenantId);
    if (query.status) {
      pos = pos.filter((p) => p.status === query.status);
    }
    return pos.map((po) => {
      const sup = engine.state.suppliers.find((s) => s.id === po.supplierId);
      const wh = engine.state.warehouses.find((w) => w.id === po.warehouseId);
      return {
        ...po,
        supplierName: sup?.name,
        supplierCode: sup?.code,
        warehouseName: wh?.name,
        warehouseCode: wh?.code
      };
    }).reverse();
  });

  // POST /api/v1/purchases/orders
  router.post("/api/v1/purchases/orders", { auth: true, permission: "purchases:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createPurchaseOrder(session, body);
  });

  // GET /api/v1/purchases/orders/:id
  router.get("/api/v1/purchases/orders/:id", { auth: true, permission: "purchases:read" }, async ({ session, params }) => {
    const po = engine.state.purchaseOrders.find(
      (p) => p.tenantId === session.tenantId && p.id === params.id
    );
    if (!po) throw new DomainError("NOT_FOUND", "Purchase order not found.", 404);
    const sup = engine.state.suppliers.find((s) => s.id === po.supplierId);
    const wh = engine.state.warehouses.find((w) => w.id === po.warehouseId);
    const items = po.items.map((it) => {
      const prod = engine.state.products.find((p) => p.id === it.productId);
      return {
        ...it,
        sku: prod?.sku,
        productName: prod?.name,
        uom: prod?.uom
      };
    });
    return { ...po, supplierName: sup?.name, warehouseCode: wh?.code, items };
  });

  // POST /api/v1/purchases/goods-receipts
  router.post("/api/v1/purchases/goods-receipts", { auth: true, permission: "purchases:write", statusCode: 201 }, async ({ req, session, body }) => {
    const idempotencyKey = req.headers["x-idempotency-key"] || body.idempotencyKey;
    return engine.receiveGoods(session, {
      ...body,
      idempotencyKey
    });
  });

  // GET /api/v1/purchases/goods-receipts
  router.get("/api/v1/purchases/goods-receipts", { auth: true, permission: "purchases:read" }, async ({ session, query }) => {
    let grns = engine.state.goodsReceipts.filter((g) => g.tenantId === session.tenantId);
    if (query.purchaseOrderId) {
      grns = grns.filter((g) => g.purchaseOrderId === query.purchaseOrderId);
    }
    return grns.map((grn) => {
      const po = engine.state.purchaseOrders.find((p) => p.id === grn.purchaseOrderId);
      const wh = engine.state.warehouses.find((w) => w.id === grn.warehouseId);
      return {
        ...grn,
        poNumber: po?.poNumber,
        warehouseCode: wh?.code
      };
    }).reverse();
  });
}
