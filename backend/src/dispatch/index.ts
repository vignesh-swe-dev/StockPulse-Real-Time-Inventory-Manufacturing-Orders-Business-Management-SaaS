/**
 * StockPulse Module: dispatch
 * Responsibility: DispatchController & DispatchService — Dispatch planning, vehicle/driver tracking, POD delivery confirmation
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "dispatch",
  description: "DispatchController & DispatchService — Dispatch planning, vehicle/driver tracking, POD delivery confirmation",
  apiPrefix: "/api/v1/dispatch"
};
