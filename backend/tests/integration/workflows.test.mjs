import test from "node:test";
import assert from "node:assert/strict";
import { createStockPulseEngine } from "../../src/engine/stockpulse-engine.mjs";

test("Integration: Strict Multi-Tenant Isolation across Products, Inventory, Orders, and WebSockets", async () => {
  const engine = createStockPulseEngine();
  const tenantA = engine.registerTenantAndOwner({
    companyName: "Tenant Alpha Steels",
    ownerName: "Alpha Owner",
    email: "owner@alpha.in",
    password: "AlphaPassword#123"
  });
  const tenantB = engine.registerTenantAndOwner({
    companyName: "Tenant Beta Polymers",
    ownerName: "Beta Owner",
    email: "owner@beta.in",
    password: "BetaPassword#123"
  });

  const whA = await engine.createWarehouse(tenantA.session, { code: "WH-ALPHA", name: "Alpha Main Warehouse" });
  const prodA = await engine.createProduct(tenantA.session, {
    sku: "STEEL-COIL-01",
    name: "CR Steel Coil",
    purchasePriceMinor: 550000,
    sellingPriceMinor: 680000
  });
  await engine.recordStockReceipt(tenantA.session, {
    warehouseId: whA.id,
    productId: prodA.id,
    quantity: 50,
    reason: "Opening stock receipt"
  });

  // Tenant B must see 0 inventory balances from Tenant A
  const balancesB = engine.getInventoryBalances(tenantB.session);
  assert.equal(balancesB.length, 0);

  // Tenant B attempting to adjust Tenant A's warehouse/product must fail with 404 NOT_FOUND
  await assert.rejects(
    () =>
      engine.recordStockAdjustment(tenantB.session, {
        warehouseId: whA.id,
        productId: prodA.id,
        quantityDelta: -5,
        reason: "Cross-tenant tampering attempt"
      }),
    (err) => err.code === "NOT_FOUND" && err.statusCode === 404
  );

  // Tenant B attempting to subscribe to Tenant A's WebSocket room must be denied with 403
  assert.throws(
    () => engine.authorizeSocketSubscription(tenantB.session, `tenant:${tenantA.tenant.id}`, () => {}),
    (err) => err.code === "WS_FORBIDDEN_ROOM" && err.statusCode === 403
  );
});

test("Integration: Concurrent Order Confirmation prevents overselling and tracks Available = OnHand - Reserved", async () => {
  const engine = createStockPulseEngine();
  const { session } = engine.registerTenantAndOwner({
    companyName: "precision-valves",
    ownerName: "Priya Nair",
    email: "priya@valves.in",
    password: "PrecisionPassword#1"
  });
  const wh = await engine.createWarehouse(session, { code: "WH-BLR", name: "Bengaluru Central" });
  const prod = await engine.createProduct(session, {
    sku: "VLV-BALL-50",
    name: "SS316 Ball Valve 50mm",
    purchasePriceMinor: 120000,
    sellingPriceMinor: 185000
  });
  await engine.recordStockReceipt(session, {
    warehouseId: wh.id,
    productId: prod.id,
    quantity: 10,
    reason: "Initial batch receipt"
  });

  const cust = await engine.createCustomer(session, { code: "CUST-01", name: "Metro Infra Ltd" });
  const order1 = await engine.createOrder(session, {
    customerId: cust.id,
    warehouseId: wh.id,
    items: [{ productId: prod.id, orderedQty: 7 }]
  });
  const order2 = await engine.createOrder(session, {
    customerId: cust.id,
    warehouseId: wh.id,
    items: [{ productId: prod.id, orderedQty: 6 }]
  });

  // Fire both confirmations concurrently; only one can succeed because total On-Hand is 10
  const results = await Promise.allSettled([
    engine.confirmOrder(session, { orderId: order1.id }),
    engine.confirmOrder(session, { orderId: order2.id })
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "INSUFFICIENT_AVAILABLE_STOCK");

  const [bal] = engine.getInventoryBalances(session, { warehouseId: wh.id, productId: prod.id });
  assert.equal(bal.onHandQty, 10);
  assert.equal(bal.reservedQty, 7);
  assert.equal(bal.availableQty, 3);
});

test("Integration: Goods Receipt (GRN) Idempotency & Immutable Stock Ledger Reversal", async () => {
  const engine = createStockPulseEngine();
  const { session } = engine.registerTenantAndOwner({
    companyName: "Kaveri Aggregates",
    ownerName: "Karthik S",
    email: "karthik@kaveri.in",
    password: "KaveriPassword#2026"
  });
  const wh = await engine.createWarehouse(session, { code: "WH-SLM", name: "Salem Yard" });
  const prod = await engine.createProduct(session, {
    sku: "TMT-FE550-12",
    name: "TMT Bar Fe550D 12mm",
    uom: "TON",
    purchasePriceMinor: 5200000,
    sellingPriceMinor: 5900000
  });
  const sup = await engine.createSupplier(session, { code: "SUP-JSW", name: "JSW Steel Depot" });
  const po = await engine.createPurchaseOrder(session, {
    supplierId: sup.id,
    warehouseId: wh.id,
    items: [{ productId: prod.id, orderedQty: 20, unitCostMinor: 5200000 }]
  });

  // First GRN request
  await engine.receiveGoods(session, {
    purchaseOrderId: po.id,
    idempotencyKey: "grn-idem-001",
    items: [{ productId: prod.id, receivedQty: 12, rejectedQty: 1 }]
  });
  // Duplicate GRN request with same idempotencyKey must NOT add 12 tons a second time
  await engine.receiveGoods(session, {
    purchaseOrderId: po.id,
    idempotencyKey: "grn-idem-001",
    items: [{ productId: prod.id, receivedQty: 12, rejectedQty: 1 }]
  });

  let [bal] = engine.getInventoryBalances(session, { warehouseId: wh.id, productId: prod.id });
  assert.equal(bal.onHandQty, 12);

  // Direct edit to historical stock movement is forbidden
  await assert.rejects(() => engine.editStockMovement(), /IMMUTABLE_LEDGER_ERROR/);

  // Reversal entry properly restores balance with audit trail
  const adj = await engine.recordStockAdjustment(session, {
    warehouseId: wh.id,
    productId: prod.id,
    quantityDelta: -2,
    reason: "Damaged bundle during crane unloading"
  });
  assert.equal(adj.balance.onHandQty, 10);

  const rev = await engine.reverseStockMovement(session, {
    movementId: adj.movement.id,
    reason: "Bundle was recovered and inspected OK"
  });
  assert.equal(rev.balance.onHandQty, 12);
});

test("Integration: Background Job Bounded Retry Recovery", async () => {
  const engine = createStockPulseEngine();
  let calls = 0;
  const outcome = await engine.processBackgroundJobWithRetry(
    async (attempt) => {
      calls = attempt;
      if (attempt < 3) throw new Error("Transient SMTP timeout");
      return { delivered: true };
    },
    { maxAttempts: 3, baseDelayMs: 5 }
  );
  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.attempts, 3);
  assert.equal(calls, 3);
});
