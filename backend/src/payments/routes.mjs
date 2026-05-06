import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerPaymentsRoutes(router, engine) {
  // GET /api/v1/payments
  router.get("/api/v1/payments", { auth: true, permission: "payments:read" }, async ({ session, query }) => {
    let payments = engine.state.payments.filter((p) => p.tenantId === session.tenantId);
    if (query.invoiceId) {
      payments = payments.filter((p) => p.invoiceId === query.invoiceId);
    }
    if (query.customerId) {
      payments = payments.filter((p) => p.customerId === query.customerId);
    }
    return payments.map((p) => {
      const inv = engine.state.invoices.find((i) => i.id === p.invoiceId);
      const cust = engine.state.customers.find((c) => c.id === p.customerId);
      return {
        ...p,
        invoiceNumber: inv?.invoiceNumber,
        customerName: cust?.name,
        customerCode: cust?.code
      };
    }).reverse();
  });

  // POST /api/v1/payments
  router.post("/api/v1/payments", { auth: true, permission: "payments:write", statusCode: 201 }, async ({ req, session, body }) => {
    const idempotencyKey = req.headers["x-idempotency-key"] || body.idempotencyKey;
    return engine.recordPayment(session, {
      ...body,
      idempotencyKey
    });
  });

  // POST /api/v1/payments/:id/reverse
  router.post("/api/v1/payments/:id/reverse", { auth: true, permission: "payments:write", statusCode: 201 }, async ({ session, params, body }) => {
    return engine.reversePayment(session, {
      paymentId: params.id,
      reason: body.reason
    });
  });
}
