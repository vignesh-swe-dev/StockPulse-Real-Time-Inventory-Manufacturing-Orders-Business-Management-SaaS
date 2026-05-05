/**
 * StockPulse Module: invoices
 * Responsibility: InvoicesController & InvoicesService — Financial-year sequential GST invoicing in integer minor units
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "invoices",
  description: "InvoicesController & InvoicesService — Financial-year sequential GST invoicing in integer minor units",
  apiPrefix: "/api/v1/invoices"
};
