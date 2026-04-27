import { DomainError } from "../engine/stockpulse-engine.mjs";

export function registerProductsRoutes(router, engine) {
  // GET /api/v1/products
  router.get("/api/v1/products", { auth: true, permission: "products:read" }, async ({ session, query }) => {
    let products = engine.state.products.filter((p) => p.tenantId === session.tenantId);
    if (query.productType) {
      products = products.filter((p) => p.productType === query.productType);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      products = products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return products;
  });

  // POST /api/v1/products
  router.post("/api/v1/products", { auth: true, permission: "products:write", statusCode: 201 }, async ({ session, body }) => {
    return engine.createProduct(session, body);
  });

  // GET /api/v1/products/:id
  router.get("/api/v1/products/:id", { auth: true, permission: "products:read" }, async ({ session, params }) => {
    const product = engine.state.products.find(
      (p) => p.tenantId === session.tenantId && p.id === params.id
    );
    if (!product) throw new DomainError("NOT_FOUND", "Product not found.", 404);
    return product;
  });
}
