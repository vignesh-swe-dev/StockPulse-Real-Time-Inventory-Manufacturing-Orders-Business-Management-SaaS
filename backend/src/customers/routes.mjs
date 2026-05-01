import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerCustomersRoutes(router, engine) {
  // GET /api/v1/customers
  router.get("/api/v1/customers", { auth: true, permission: "customers:read" }, async ({ session, query }) => {
    let customers = engine.state.customers.filter((c) => c.tenantId === session.tenantId);
    if (query.search) {
      const q = query.search.toLowerCase();
      customers = customers.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    }
    return customers;
  });

  // POST /api/v1/customers
  router.post("/api/v1/customers", { auth: true, permission: "customers:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createCustomer(session, body);
  });

  // GET /api/v1/customers/:id
  router.get("/api/v1/customers/:id", { auth: true, permission: "customers:read" }, async ({ session, params }) => {
    const customer = engine.state.customers.find(
      (c) => c.tenantId === session.tenantId && c.id === params.id
    );
    if (!customer) throw new DomainError("NOT_FOUND", "Customer not found.", 404);
    return customer;
  });

  // GET /api/v1/customers/:id/statement
  router.get("/api/v1/customers/:id/statement", { auth: true, permission: "customers:read" }, async ({ session, params }) => {
    return engine.getCustomerStatement(session, params.id);
  });
}
