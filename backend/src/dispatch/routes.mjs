import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerDispatchRoutes(router, engine) {
  // GET /api/v1/dispatches
  router.get("/api/v1/dispatches", { auth: true, permission: "dispatch:read" }, async ({ session, query }) => {
    let dispatches = engine.state.dispatches.filter((d) => d.tenantId === session.tenantId);
    if (query.orderId) {
      dispatches = dispatches.filter((d) => d.orderId === query.orderId);
    }
    if (query.status) {
      dispatches = dispatches.filter((d) => d.status === query.status);
    }
    return dispatches.map((d) => {
      const order = engine.state.orders.find((o) => o.id === d.orderId);
      const cust = order ? engine.state.customers.find((c) => c.id === order.customerId) : null;
      const wh = engine.state.warehouses.find((w) => w.id === d.warehouseId);
      return {
        ...d,
        orderNumber: order?.orderNumber,
        customerName: cust?.name,
        warehouseCode: wh?.code
      };
    }).reverse();
  });

  // POST /api/v1/dispatches
  router.post("/api/v1/dispatches", { auth: true, permission: "dispatch:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createAndExecuteDispatch(session, body);
  });

  // GET /api/v1/dispatches/:id
  router.get("/api/v1/dispatches/:id", { auth: true, permission: "dispatch:read" }, async ({ session, params }) => {
    const dispatch = engine.state.dispatches.find(
      (d) => d.tenantId === session.tenantId && d.id === params.id
    );
    if (!dispatch) throw new DomainError("NOT_FOUND", "Dispatch not found.", 404);
    const order = engine.state.orders.find((o) => o.id === dispatch.orderId);
    const cust = order ? engine.state.customers.find((c) => c.id === order.customerId) : null;
    return { ...dispatch, orderNumber: order?.orderNumber, customerName: cust?.name };
  });

  // POST /api/v1/dispatches/:id/deliver
  router.post("/api/v1/dispatches/:id/deliver", { auth: true, permission: "dispatch:write", statusCode: 200 }, async ({ session, params, body }) => {
    return engine.deliverDispatch(session, {
      dispatchId: params.id,
      podReference: body?.podReference || "POD-DELIVERED"
    });
  });
}
