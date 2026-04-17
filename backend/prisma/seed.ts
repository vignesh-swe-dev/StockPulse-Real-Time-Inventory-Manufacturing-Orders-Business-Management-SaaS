/**
 * StockPulse Development Seed Script
 * Refuses to run automatically in production to prevent polluting real business databases.
 */
import { createStockPulseEngine } from "../src/engine/stockpulse-engine.mjs";

export async function runSeed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SECURITY_GUARD: Refusing to seed fake/demo records in production.");
  }
  const engine = createStockPulseEngine({ seedDemoData: true });
  console.log("Seeded [DEMO] tenant and initial vertical slice records successfully.", {
    tenants: engine.state.tenants.length,
    products: engine.state.products.length,
    warehouses: engine.state.warehouses.length,
  });
}

if (require.main === module) {
  runSeed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
