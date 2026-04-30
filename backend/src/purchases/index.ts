/**
 * StockPulse Module: purchases
 * Responsibility: PurchasesController & GoodsReceiptService — Purchase orders and idempotent GRN stock posting
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "purchases",
  description: "PurchasesController & GoodsReceiptService — Purchase orders and idempotent GRN stock posting",
  apiPrefix: "/api/v1/purchases"
};
