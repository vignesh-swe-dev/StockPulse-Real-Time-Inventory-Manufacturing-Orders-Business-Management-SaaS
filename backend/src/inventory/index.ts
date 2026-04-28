/**
 * StockPulse Module: inventory
 * Responsibility: InventoryController & InventoryLedgerService — Warehouse balances, receipts, transfers, adjustments, reversals
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "inventory",
  description: "InventoryController & InventoryLedgerService — Warehouse balances, receipts, transfers, adjustments, reversals",
  apiPrefix: "/api/v1/inventory"
};
