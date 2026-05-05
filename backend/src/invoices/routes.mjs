import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerInvoicesRoutes(router, engine) {
  // GET /api/v1/invoices
  router.get("/api/v1/invoices", { auth: true, permission: "invoices:read" }, async ({ session, query }) => {
    let invoices = engine.state.invoices.filter((i) => i.tenantId === session.tenantId);
    if (query.customerId) {
      invoices = invoices.filter((i) => i.customerId === query.customerId);
    }
    if (query.status) {
      invoices = invoices.filter((i) => i.status === query.status);
    }
    return invoices.map((inv) => {
      const cust = engine.state.customers.find((c) => c.id === inv.customerId);
      const order = engine.state.orders.find((o) => o.id === inv.orderId);
      const isOverdue = inv.status === "OVERDUE" || (inv.balanceDueMinor > 0 && new Date(inv.dueDate).getTime() < Date.now());
      return {
        ...inv,
        customerName: cust?.name,
        customerCode: cust?.code,
        customerTaxId: cust?.taxId,
        orderNumber: order?.orderNumber,
        isOverdue
      };
    }).reverse();
  });

  // POST /api/v1/invoices
  router.post("/api/v1/invoices", { auth: true, permission: "invoices:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createInvoiceFromOrder(session, body);
  });

  // GET /api/v1/invoices/:id
  router.get("/api/v1/invoices/:id", { auth: true, permission: "invoices:read" }, async ({ session, params }) => {
    const inv = engine.state.invoices.find(
      (i) => i.tenantId === session.tenantId && i.id === params.id
    );
    if (!inv) throw new DomainError("NOT_FOUND", "Invoice not found.", 404);
    const cust = engine.state.customers.find((c) => c.id === inv.customerId);
    const order = engine.state.orders.find((o) => o.id === inv.orderId);
    const payments = engine.state.payments.filter((p) => p.invoiceId === inv.id);
    return {
      ...inv,
      customerName: cust?.name,
      customerTaxId: cust?.taxId,
      customerPhone: cust?.phone,
      customerEmail: cust?.email,
      orderNumber: order?.orderNumber,
      payments
    };
  });
}
