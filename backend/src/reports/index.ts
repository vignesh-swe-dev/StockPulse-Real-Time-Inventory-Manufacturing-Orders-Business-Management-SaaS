/**
 * StockPulse Module: reports
 * Responsibility: ReportsController & ReportsService — Sales, inventory valuation, production cost variance, and ageing analytics
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "reports",
  description: "ReportsController & ReportsService — Sales, inventory valuation, production cost variance, and ageing analytics",
  apiPrefix: "/api/v1/reports"
};
