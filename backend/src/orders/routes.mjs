import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerOrdersRoutes(router, engine) {
  // GET /api/v1/quotations
  router.get("/api/v1/quotations", { auth: true, permission: "quotations:read" }, async ({ session, query }) => {
    let quotes = engine.state.quotations.filter((q) => q.tenantId === session.tenantId);
    if (query.customerId) {
      quotes = quotes.filter((q) => q.customerId === query.customerId);
    }
    return quotes.map((q) => {
      const cust = engine.state.customers.find((c) => c.id === q.customerId);
      return {
        ...q,
        customerName: cust?.name,
        customerCode: cust?.code
      };
    }).reverse();
  });

  // POST /api/v1/quotations
  router.post("/api/v1/quotations", { auth: true, permission: "quotations:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createQuotation(session, body);
  });

  // GET /api/v1/quotations/:id
  router.get("/api/v1/quotations/:id", { auth: true, permission: "quotations:read" }, async ({ session, params }) => {
    const quote = engine.state.quotations.find(
      (q) => q.tenantId === session.tenantId && q.id === params.id
    );
    if (!quote) throw new DomainError("NOT_FOUND", "Quotation not found.", 404);
    const cust = engine.state.customers.find((c) => c.id === quote.customerId);
    return { ...quote, customerName: cust?.name };
  });

  // GET /api/v1/orders
  router.get("/api/v1/orders", { auth: true, permission: "orders:read" }, async ({ session, query }) => {
    let orders = engine.state.orders.filter((o) => o.tenantId === session.tenantId);
    if (query.status) {
      orders = orders.filter((o) => o.status === query.status);
    }
    if (query.customerId) {
      orders = orders.filter((o) => o.customerId === query.customerId);
    }
    if (query.warehouseId) {
      orders = orders.filter((o) => o.warehouseId === query.warehouseId);
    }
    return orders.map((o) => {
      const cust = engine.state.customers.find((c) => c.id === o.customerId);
      const wh = engine.state.warehouses.find((w) => w.id === o.warehouseId);
      return {
        ...o,
        customerName: cust?.name,
        customerCode: cust?.code,
        warehouseName: wh?.name,
        warehouseCode: wh?.code
      };
    }).reverse();
  });

  // POST /api/v1/orders
  router.post("/api/v1/orders", { auth: true, permission: "orders:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createOrder(session, body);
  });

  // GET /api/v1/orders/:id
  router.get("/api/v1/orders/:id", { auth: true, permission: "orders:read" }, async ({ session, params }) => {
    const order = engine.state.orders.find(
      (o) => o.tenantId === session.tenantId && o.id === params.id
    );
    if (!order) throw new DomainError("NOT_FOUND", "Order not found.", 404);
    const cust = engine.state.customers.find((c) => c.id === order.customerId);
    const wh = engine.state.warehouses.find((w) => w.id === order.warehouseId);
    const reservations = engine.state.stockReservations.filter(
      (r) => r.tenantId === session.tenantId && r.orderId === order.id
    );
    const dispatches = engine.state.dispatches.filter(
      (d) => d.tenantId === session.tenantId && d.orderId === order.id
    );
    const invoice = engine.state.invoices.find(
      (i) => i.tenantId === session.tenantId && i.orderId === order.id
    );

    return {
      ...order,
      customerName: cust?.name,
      customerCode: cust?.code,
      warehouseName: wh?.name,
      warehouseCode: wh?.code,
      reservations,
      dispatches,
      invoice: invoice || null
    };
  });

  // POST /api/v1/orders/:id/confirm
  router.post("/api/v1/orders/:id/confirm", { auth: true, permission: "orders:write", statusCode: 200 }, async ({ req, session, params, body }) => {
    const idempotencyKey = req.headers["x-idempotency-key"] || body?.idempotencyKey;
    return engine.confirmOrder(session, {
      orderId: params.id,
      idempotencyKey
    });
  });

  // POST /api/v1/orders/:id/cancel
  router.post("/api/v1/orders/:id/cancel", { auth: true, permission: "orders:write", statusCode: 200 }, async ({ session, params, body }) => {
    return engine.cancelOrder(session, {
      orderId: params.id,
      reason: body?.reason || "Cancelled by user"
    });
  });
}
