/**
 * StockPulse Module: orders
 * Responsibility: OrdersController & OrdersService — Quotations, sales orders, transactional stock reservation, status transitions
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "orders",
  description: "OrdersController & OrdersService — Quotations, sales orders, transactional stock reservation, status transitions",
  apiPrefix: "/api/v1/orders"
};
