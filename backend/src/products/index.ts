/**
 * StockPulse Module: products
 * Responsibility: ProductsController & ProductsService — SKU uniqueness per tenant, UOM, integer minor unit pricing
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "products",
  description: "ProductsController & ProductsService — SKU uniqueness per tenant, UOM, integer minor unit pricing",
  apiPrefix: "/api/v1/products"
};
