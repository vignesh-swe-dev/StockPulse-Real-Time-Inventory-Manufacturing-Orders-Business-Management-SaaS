import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../src/server.mjs";

test("E2E Full Lifecycle & First Vertical Slice: Company -> Product -> Stock Receipt -> Order -> Production -> Dispatch -> Invoice -> Partial Payment -> Real-Time Events", async () => {
  const { server, engine } = createApiServer({ seedDemoData: false });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // 1. Register Company & Owner via REST API
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Sahyadri Construction Materials Pvt Ltd",
        slug: "sahyadri-materials",
        currencyCode: "INR",
        taxRegistrationNo: "33AABCS1429B1Z5",
        ownerName: "Vikram Deshmukh",
        email: "vikram@sahyadri.in",
        password: "SahyadriSecure#2026"
      })
    });
    assert.equal(regRes.status, 201);
    const { data: regData } = await regRes.json();
    const { session, tenant } = regData;
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`
    };

    // Subscribe to real-time WebSocket room for this tenant
    const receivedEvents = [];
    const unsubscribe = engine.authorizeSocketSubscription(
      engine.state.sessions.get(session.accessToken),
      `tenant:${tenant.id}`,
      (evt) => receivedEvents.push(evt)
    );

    // 2. Create Warehouse via REST API
    const whRes = await fetch(`${baseUrl}/warehouses`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ code: "WH-MAIN", name: "Salem Manufacturing & Dispatch Hub", location: "SIDCO Industrial Estate, Salem" })
    });
    assert.equal(whRes.status, 201);
    const { data: warehouse } = await whRes.json();

    // 3. Create Raw Material & Finished Product via REST API
    const rmRes = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        sku: "RM-CEMENT-OPC",
        name: "OPC 53 Bulk Cement",
        uom: "KG",
        productType: "RAW_MATERIAL",
        purchasePriceMinor: 850,
        sellingPriceMinor: 1000,
        reorderThreshold: 100
      })
    });
    const { data: rawCement } = await rmRes.json();

    const fgRes = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        sku: "FG-PAVER-80MM",
        name: "Heavy-Duty Interlocking Paver Block 80mm",
        uom: "PCS",
        productType: "FINISHED_GOOD",
        purchasePriceMinor: 2200,
        sellingPriceMinor: 3500, // ₹35.00
        taxRateBps: 1800,
        reorderThreshold: 200
      })
    });
    const { data: paverProduct } = await fgRes.json();

    // 4. Record Stock Receipts via REST API (Vertical Slice verification)
    const rcptRm = await fetch(`${baseUrl}/inventory/receipts`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        warehouseId: warehouse.id,
        productId: rawCement.id,
        quantity: 2000,
        unitCostMinor: 850,
        reason: "Initial bulk silo receipt"
      })
    });
    assert.equal(rcptRm.status, 201);

    const rcptFg = await fetch(`${baseUrl}/inventory/receipts`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        warehouseId: warehouse.id,
        productId: paverProduct.id,
        quantity: 300,
        unitCostMinor: 2200,
        reason: "Opening yard stock"
      })
    });
    assert.equal(rcptFg.status, 201);

    // 5. Verify Stock Balance via REST API & Real-Time Event Stream
    const balRes = await fetch(`${baseUrl}/inventory/balances`, { headers: authHeaders });
    const { data: balances } = await balRes.json();
    const fgBal = balances.find((b) => b.productId === paverProduct.id);
    assert.equal(fgBal.onHandQty, 300);
    assert.equal(fgBal.availableQty, 300);
    assert.equal(receivedEvents.some((e) => e.eventType === "inventory.updated" && e.entityId === paverProduct.id), true);

    // 6. Create Customer & Sales Order for 500 Pavers (300 in stock -> need 200 more via Production!)
    const serverSession = engine.state.sessions.get(session.accessToken);
    const customer = await engine.createCustomer(serverSession, {
      code: "CUST-LNT",
      name: "L&T Infrastructure Projects",
      taxId: "33AAACL0140P1Z1"
    });
    const order = await engine.createOrder(serverSession, {
      customerId: customer.id,
      warehouseId: warehouse.id,
      items: [{ productId: paverProduct.id, orderedQty: 500, unitPriceMinor: 3500, taxRateBps: 1800 }]
    });

    // Confirming order before production must fail since 300 < 500
    await assert.rejects(
      () => engine.confirmOrder(serverSession, { orderId: order.id }),
      (err) => err.code === "INSUFFICIENT_AVAILABLE_STOCK"
    );

    // 7. Create BOM & Complete Production Batch of 400 Pavers
    const bom = await engine.createBom(serverSession, {
      finishedProductId: paverProduct.id,
      code: "BOM-PAVER-80",
      name: "80mm Paver Standard Mix",
      baseOutputQty: 100,
      estLaborCostMinor: 15000,
      estOverheadCostMinor: 10000,
      items: [{ rawMaterialId: rawCement.id, quantityPerBase: 150, scrapPercent: 0 }]
    });
    const batch = await engine.createProductionBatch(serverSession, {
      bomId: bom.id,
      warehouseId: warehouse.id,
      plannedQty: 400
    });
    await engine.startProductionBatch(serverSession, { batchId: batch.id });
    const completedBatch = await engine.completeProductionBatch(serverSession, {
      batchId: batch.id,
      actualGoodQty: 400,
      rejectedWastageQty: 8
    });
    assert.equal(completedBatch.status, "COMPLETED");
    // Prevent completing same batch twice
    await assert.rejects(
      () => engine.completeProductionBatch(serverSession, { batchId: batch.id, actualGoodQty: 400 }),
      /BATCH_ALREADY_COMPLETED/
    );

    // Now Paver On-Hand is 300 + 400 = 700. Confirming the 500-unit order succeeds!
    const confirmedOrder = await engine.confirmOrder(serverSession, {
      orderId: order.id,
      idempotencyKey: "confirm-so-001"
    });
    assert.equal(confirmedOrder.status, "CONFIRMED");

    // 8. Dispatch and Deliver the Order
    const dispatch = await engine.createAndExecuteDispatch(serverSession, {
      orderId: order.id,
      vehicleNumber: "TN-30-AQ-8899",
      driverName: "Murugan R",
      items: [{ productId: paverProduct.id, quantity: 500 }]
    });
    assert.equal(dispatch.status, "DISPATCHED");
    const delivered = await engine.deliverDispatch(serverSession, {
      dispatchId: dispatch.id,
      podReference: "POD-LNT-2026-991"
    });
    assert.equal(delivered.status, "DELIVERED");

    // 9. Generate Invoice & Record Partial Payment
    const invoice = await engine.createInvoiceFromOrder(serverSession, { orderId: order.id });
    // 500 * 3500 = 1,750,000 paise + 18% GST (315,000 paise) = 2,065,000 paise (₹20,650.00)
    assert.equal(invoice.totalMinor, 2065000);

    const { invoice: updatedInv } = await engine.recordPayment(serverSession, {
      invoiceId: invoice.id,
      amountMinor: 1000000, // ₹10,000.00 partial payment
      method: "BANK_TRANSFER",
      reference: "NEFT-UTR-9928172",
      idempotencyKey: "pay-idem-001"
    });
    assert.equal(updatedInv.status, "PARTIALLY_PAID");
    assert.equal(updatedInv.balanceDueMinor, 1065000); // ₹10,650.00 remaining

    // 10. Verify Customer Statement, Dashboard Summary, and Real-Time Events
    const statement = engine.getCustomerStatement(serverSession, customer.id);
    assert.equal(statement.outstandingBalanceMinor, 1065000);

    const dashRes = await fetch(`${baseUrl}/dashboard/summary`, { headers: authHeaders });
    const { data: dash } = await dashRes.json();
    assert.equal(dash.todaysSalesMinor, 2065000);
    assert.equal(dash.outstandingReceivablesMinor, 1065000);
    assert.equal(dash.productionOutputQty, 400);

    const eventTypes = new Set(receivedEvents.map((e) => e.eventType));
    assert.equal(eventTypes.has("inventory.updated"), true);
    assert.equal(eventTypes.has("order.created"), true);
    assert.equal(eventTypes.has("order.updated"), true);
    assert.equal(eventTypes.has("production.started"), true);
    assert.equal(eventTypes.has("production.completed"), true);
    assert.equal(eventTypes.has("dispatch.updated"), true);
    assert.equal(eventTypes.has("payment.received"), true);

    unsubscribe();
  } finally {
    server.close();
  }
});
