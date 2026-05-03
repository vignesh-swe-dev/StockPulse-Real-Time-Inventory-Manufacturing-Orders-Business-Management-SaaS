/**
 * StockPulse Module: production
 * Responsibility: ProductionController & ProductionService — Multi-item BOMs, batch material requirements, completion & wastage
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "production",
  description: "ProductionController & ProductionService — Multi-item BOMs, batch material requirements, completion & wastage",
  apiPrefix: "/api/v1/production"
};
