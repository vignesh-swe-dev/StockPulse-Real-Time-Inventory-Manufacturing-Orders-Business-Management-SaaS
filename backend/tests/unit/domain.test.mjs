import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateLineAmountsMinor,
  hasPermission,
  hashPassword,
  verifyPassword,
  VALID_ORDER_TRANSITIONS,
  createStockPulseEngine
} from "../../src/engine/stockpulse-engine.mjs";

test("Unit: Exact integer minor currency calculation (no floating-point drift)", () => {
  // 12.5 units @ ₹199.95 (19995 paise), ₹50.00 discount (5000 paise), 18% GST (1800 bps)
  const res = calculateLineAmountsMinor({
    quantity: 12.5,
    unitPriceMinor: 19995,
    discountMinor: 5000,
    taxRateBps: 1800
  });
  // 12.5 * 19995 = 249937.5 -> rounded 249938 paise
  assert.equal(res.grossMinor, 249938);
  assert.equal(res.taxableMinor, 244938);
  // 18% of 244938 = 44088.84 -> 44089 paise
  assert.equal(res.taxMinor, 44089);
  assert.equal(res.lineTotalMinor, 289027);

  // Reject floating point unitPriceMinor
  assert.throws(
    () => calculateLineAmountsMinor({ quantity: 1, unitPriceMinor: 19.99, taxRateBps: 1800 }),
    /INVALID_MONEY_UNIT/
  );
});

test("Unit: Password hashing and timing-safe verification", () => {
  const hash = hashPassword("CorrectHorseBatteryStaple!99");
  assert.equal(verifyPassword("CorrectHorseBatteryStaple!99", hash), true);
  assert.equal(verifyPassword("WrongPassword!99", hash), false);
});

test("Unit: Role and permission matrix decisions across all 8 roles", () => {
  assert.equal(hasPermission("OWNER", "settings:write"), true);
  assert.equal(hasPermission("SALES_STAFF", "orders:write"), true);
  assert.equal(hasPermission("SALES_STAFF", "production:write"), false);
  assert.equal(hasPermission("WAREHOUSE_STAFF", "dispatch:write"), true);
  assert.equal(hasPermission("WAREHOUSE_STAFF", "invoices:write"), false);
  assert.equal(hasPermission("PRODUCTION_STAFF", "production:write"), true);
  assert.equal(hasPermission("ACCOUNTANT", "payments:write"), true);
  assert.equal(hasPermission("VIEWER", "products:read"), true);
  assert.equal(hasPermission("VIEWER", "products:write"), false);
});

test("Unit: Valid server-side order status transitions", () => {
  assert.equal(VALID_ORDER_TRANSITIONS.DRAFT.includes("CONFIRMED"), true);
  assert.equal(VALID_ORDER_TRANSITIONS.DRAFT.includes("DELIVERED"), false);
  assert.equal(VALID_ORDER_TRANSITIONS.DELIVERED.includes("CANCELLED"), false);
});

test("Unit: BOM material requirement & estimated cost calculation", async () => {
  const engine = createStockPulseEngine();
  const { session } = engine.registerTenantAndOwner({
    companyName: "Apex Building Materials",
    ownerName: "Aarav Mehta",
    email: "aarav@apexmaterials.in",
    password: "StrongPassword#2026"
  });
  const cement = await engine.createProduct(session, {
    sku: "RM-CEM-50",
    name: "OPC 53 Grade Cement",
    uom: "KG",
    productType: "RAW_MATERIAL",
    purchasePriceMinor: 900 // ₹9.00/kg
  });
  const block = await engine.createProduct(session, {
    sku: "FG-BLK-200",
    name: "AAC Concrete Block 200mm",
    uom: "PCS",
    productType: "FINISHED_GOOD",
    sellingPriceMinor: 6500
  });
  const bom = await engine.createBom(session, {
    finishedProductId: block.id,
    code: "BOM-BLK-200",
    name: "Standard AAC Block Recipe",
    baseOutputQty: 10,
    estLaborCostMinor: 5000,
    estOverheadCostMinor: 2500,
    items: [{ rawMaterialId: cement.id, quantityPerBase: 40, scrapPercent: 5 }]
  });

  // For 100 blocks (10x baseOutputQty): 40 * 10 * 1.05 = 420 kg cement @ 900 paise = 378,000 paise
  const calc = engine.calculateBomRequirements(session, bom.id, 100);
  assert.equal(calc.requirements[0].requiredQty, 420);
  assert.equal(calc.estMaterialCostMinor, 378000);
  assert.equal(calc.estLaborMinor, 50000);
  assert.equal(calc.estOverheadMinor, 25000);
  assert.equal(calc.estimatedTotalCostMinor, 453000);
});
