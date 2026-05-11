import { pathToFileURL } from "node:url";
import http from "node:http";
import { createStockPulseEngine } from "./engine/stockpulse-engine.mjs";
import { seedDemoData as runSeedDemoData } from "./engine/demo-seed.mjs";
import { createPersistence, loadStateFromFile } from "./engine/persistence.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRouter } from "./common/router.mjs";

import { registerAuthRoutes } from "./auth/routes.mjs";
import { registerTenantsRoutes } from "./tenants/routes.mjs";
import { registerUsersRoutes } from "./users/routes.mjs";
import { registerWarehousesRoutes } from "./warehouses/routes.mjs";
import { registerProductsRoutes } from "./products/routes.mjs";
import { registerInventoryRoutes } from "./inventory/routes.mjs";
import { registerSuppliersRoutes } from "./suppliers/routes.mjs";
import { registerPurchasesRoutes } from "./purchases/routes.mjs";
import { registerCustomersRoutes } from "./customers/routes.mjs";
import { registerOrdersRoutes } from "./orders/routes.mjs";
import { registerProductionRoutes } from "./production/routes.mjs";
import { registerDispatchRoutes } from "./dispatch/routes.mjs";
import { registerInvoicesRoutes } from "./invoices/routes.mjs";
import { registerPaymentsRoutes } from "./payments/routes.mjs";
import { registerNotificationsRoutes } from "./notifications/routes.mjs";
import { registerReportsRoutes } from "./reports/routes.mjs";
import { registerAuditRoutes } from "./audit/routes.mjs";
import { registerRealtimeRoutes } from "./realtime/routes.mjs";

/**
 * @param seedDemoData  load sample demo data (off by default; enable with DEMO_DATA=1)
 * @param dataFile      path of the JSON file that stores real data (null = memory only, used by tests)
 */
export function createApiServer({ seedDemoData = false, dataFile = null } = {}) {
  const engine = createStockPulseEngine({ seedDemoData });

  let persistence = null;
  if (dataFile) {
    const loaded = loadStateFromFile(engine.state, dataFile);
    persistence = createPersistence(engine.state, dataFile);
    console.log(loaded ? `[StockPulse] Loaded saved data from ${dataFile}` : `[StockPulse] Starting with an empty database (${dataFile})`);
  }

  if (seedDemoData && engine.state.tenants.length === 0) {
    runSeedDemoData(engine).catch((err) => {
      console.error("[StockPulse Seed Error]", err);
    });
  }

  const router = createRouter(engine);

  // Health check
  router.get("/api/v1", { auth: false }, async () => ({
    service: "StockPulse API",
    status: "running",
    docs: "All business endpoints require sign-in via POST /api/v1/auth/login",
    health: "/api/v1/health",
    examples: ["/api/v1/dashboard/summary", "/api/v1/inventory/balances", "/api/v1/orders", "/api/v1/reports/sales-summary"]
  }));

  router.get("/api/v1/health", { auth: false }, async () => {
    return { status: "ok", service: "stockpulse-api", version: "1.0.0", demoMode: Boolean(seedDemoData), persistent: Boolean(dataFile), setupRequired: engine.state.tenants.length === 0 };
  });

  // Dashboard Summary
  router.get("/api/v1/dashboard/summary", { auth: true, permission: "dashboard:view" }, async ({ session, query }) => {
    return engine.getDashboardSummary(session, { warehouseId: query.warehouseId || null });
  });

  // Register all bounded context modules
  registerAuthRoutes(router, engine);
  registerTenantsRoutes(router, engine);
  registerUsersRoutes(router, engine);
  registerWarehousesRoutes(router, engine);
  registerProductsRoutes(router, engine);
  registerInventoryRoutes(router, engine);
  registerSuppliersRoutes(router, engine);
  registerPurchasesRoutes(router, engine);
  registerCustomersRoutes(router, engine);
  registerOrdersRoutes(router, engine);
  registerProductionRoutes(router, engine);
  registerDispatchRoutes(router, engine);
  registerInvoicesRoutes(router, engine);
  registerPaymentsRoutes(router, engine);
  registerNotificationsRoutes(router, engine);
  registerReportsRoutes(router, engine);
  registerAuditRoutes(router, engine);
  registerRealtimeRoutes(router, engine);

  const server = http.createServer(async (req, res) => {
    await router.handleRequest(req, res);
    if (persistence && !["GET", "HEAD", "OPTIONS"].includes(req.method)) persistence.schedule();
  });

  return { server, engine, router, persistence };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 4000);
  const demo = ["1", "true", "yes"].includes(String(process.env.DEMO_DATA || "").toLowerCase());
  const defaultFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", demo ? "demo-data.json" : "stockpulse-data.json");
  const dataFile = process.env.DATA_FILE || defaultFile;
  const { server, persistence } = createApiServer({ seedDemoData: demo, dataFile });
  server.listen(port, () => {
    console.log(`StockPulse API listening on http://localhost:${port}/api/v1`);
    console.log(demo ? "[StockPulse] DEMO mode: sample data loaded." : "[StockPulse] Real-data mode: your data is saved to disk.");
  });
  const shutdown = () => { persistence?.flush(); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", () => persistence?.flush());
}
