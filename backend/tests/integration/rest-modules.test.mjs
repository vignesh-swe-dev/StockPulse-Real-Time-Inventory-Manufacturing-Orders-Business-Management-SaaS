import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../src/server.mjs";

test("Integration: Comprehensive REST API Suite for all 16 Bounded Contexts", async () => {
  const { server } = createApiServer({ seedDemoData: false });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // 1. Register
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Maharashtra Precast Tech",
        slug: "maha-precast",
        currencyCode: "INR",
        taxRegistrationNo: "27AAACM1234A1Z1",
        ownerName: "Ajay Kulkarni",
        email: "ajay@mahaprecast.in",
        password: "MahaPassword#2026"
      })
    });
    assert.equal(regRes.status, 201);
    const { data: regData } = await regRes.json();
    let authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${regData.session.accessToken}`
    };

    // 2. Auth: me & refresh token
    const meRes = await fetch(`${baseUrl}/auth/me`, { headers: authHeaders });
    assert.equal(meRes.status, 200);
    const { data: meData } = await meRes.json();
    assert.equal(meData.role, "OWNER");
    assert.equal(meData.permissions.includes("*"), true);

    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: regData.session.refreshToken })
    });
    assert.equal(refreshRes.status, 200);
    const { data: refreshedSession } = await refreshRes.json();
    assert.notEqual(refreshedSession.accessToken, regData.session.accessToken);
    authHeaders.Authorization = `Bearer ${refreshedSession.accessToken}`;

    // 3. Tenants & Settings
    const tenantRes = await fetch(`${baseUrl}/tenants/current`, { headers: authHeaders });
    assert.equal(tenantRes.status, 200);
    const { data: tenant } = await tenantRes.json();
    assert.equal(tenant.slug, "maha-precast");

    // 4. Warehouse & Products
    const whRes = await fetch(`${baseUrl}/warehouses`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ code: "WH-NASHIK", name: "Nashik Hub" })
    });
    const { data: warehouse } = await whRes.json();

    const cementRes = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        sku: "RM-CEM",
        name: "OPC Cement",
        productType: "RAW_MATERIAL",
        purchasePriceMinor: 800,
        sellingPriceMinor: 950
      })
    });
    const { data: cement } = await cementRes.json();

    const blockRes = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        sku: "FG-BLOCK",
        name: "Solid Block 6-inch",
        productType: "FINISHED_GOOD",
        purchasePriceMinor: 2500,
        sellingPriceMinor: 4000,
        taxRateBps: 1800,
        reorderThreshold: 100
      })
    });
    const { data: block } = await blockRes.json();

    // 5. Suppliers & Purchase Orders & Goods Receipt (GRN)
    const supRes = await fetch(`${baseUrl}/suppliers`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        code: "SUP-AMBUJA",
        name: "Ambuja Cements Ltd",
        taxId: "27AAACA1234A1Z9"
      })
    });
    assert.equal(supRes.status, 201);
    const { data: supplier } = await supRes.json();

    const poRes = await fetch(`${baseUrl}/purchases/orders`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        items: [{ productId: cement.id, orderedQty: 1000 }]
      })
    });
    assert.equal(poRes.status, 201);
    const { data: po } = await poRes.json();
    assert.equal(po.totalMinor, 800000); // 1000 * 800

    const grnRes = await fetch(`${baseUrl}/purchases/goods-receipts`, {
      method: "POST",
      headers: { ...authHeaders, "X-Idempotency-Key": "grn-idem-test-1" },
      body: JSON.stringify({
        purchaseOrderId: po.id,
        items: [{ productId: cement.id, receivedQty: 1000 }]
      })
    });
    assert.equal(grnRes.status, 201);

    // Verify inventory balances now reflect 1000 kg cement
    const balRes = await fetch(`${baseUrl}/inventory/balances`, { headers: authHeaders });
    const { data: balances } = await balRes.json();
    const cementBal = balances.find((b) => b.productId === cement.id);
    assert.equal(cementBal.onHandQty, 1000);

    // 6. Immutable Ledger Check: PUT /inventory/movements/:id must return 405
    const mvRes = await fetch(`${baseUrl}/inventory/movements`, { headers: authHeaders });
    const { data: movements } = await mvRes.json();
    assert.equal(movements.length > 0, true);

    const editAttempt = await fetch(`${baseUrl}/inventory/movements/${movements[0].id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ quantityDelta: 9999 })
    });
    assert.equal(editAttempt.status, 405);
    const { error: editErr } = await editAttempt.json();
    assert.equal(editErr.code, "IMMUTABLE_LEDGER_ERROR");

    // 7. Inventory Reversal
    const revRes = await fetch(`${baseUrl}/inventory/reversals`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        movementId: movements[0].id,
        reason: "Supplier delivered wrong specification batch"
      })
    });
    assert.equal(revRes.status, 201);

    // Re-receive cement for production test
    await fetch(`${baseUrl}/inventory/receipts`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        warehouseId: warehouse.id,
        productId: cement.id,
        quantity: 1500,
        unitCostMinor: 800,
        reason: "Replacement cement delivery"
      })
    });

    // 8. Production: BOM & Batch
    const bomRes = await fetch(`${baseUrl}/production/boms`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        finishedProductId: block.id,
        code: "BOM-BLK-6",
        name: "Standard 6-inch Mix",
        baseOutputQty: 10,
        estLaborCostMinor: 2000,
        estOverheadCostMinor: 1000,
        items: [{ rawMaterialId: cement.id, quantityPerBase: 25 }]
      })
    });
    const { data: bom } = await bomRes.json();

    const calcRes = await fetch(`${baseUrl}/production/boms/${bom.id}/calculate?plannedQty=100`, { headers: authHeaders });
    const { data: calc } = await calcRes.json();
    assert.equal(calc.requirements[0].requiredQty, 250);

    const batchRes = await fetch(`${baseUrl}/production/batches`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        bomId: bom.id,
        warehouseId: warehouse.id,
        plannedQty: 100
      })
    });
    const { data: batch } = await batchRes.json();

    await fetch(`${baseUrl}/production/batches/${batch.id}/start`, { method: "POST", headers: authHeaders });
    const compBatchRes = await fetch(`${baseUrl}/production/batches/${batch.id}/complete`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ actualGoodQty: 100, rejectedWastageQty: 2 })
    });
    assert.equal(compBatchRes.status, 200);

    // 9. Customers & Orders & Dispatches & Invoices & Payments
    const custRes = await fetch(`${baseUrl}/customers`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        code: "CUST-GODREJ",
        name: "Godrej Properties Ltd",
        taxId: "27AAACG1234A1Z5"
      })
    });
    const { data: customer } = await custRes.json();

    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [{ productId: block.id, orderedQty: 50, unitPriceMinor: 4000, taxRateBps: 1800 }]
      })
    });
    const { data: order } = await orderRes.json();

    const confirmRes = await fetch(`${baseUrl}/orders/${order.id}/confirm`, {
      method: "POST",
      headers: { ...authHeaders, "X-Idempotency-Key": "so-confirm-test-1" }
    });
    assert.equal(confirmRes.status, 200);

    const dspRes = await fetch(`${baseUrl}/dispatches`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        orderId: order.id,
        vehicleNumber: "MH-15-AB-1234",
        driverName: "Dinesh K",
        items: [{ productId: block.id, quantity: 50 }]
      })
    });
    assert.equal(dspRes.status, 201);
    const { data: dispatch } = await dspRes.json();

    await fetch(`${baseUrl}/dispatches/${dispatch.id}/deliver`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ podReference: "POD-GODREJ-99" })
    });

    const invRes = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ orderId: order.id })
    });
    assert.equal(invRes.status, 201);
    const { data: invoice } = await invRes.json();

    const payRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: { ...authHeaders, "X-Idempotency-Key": "pay-test-1" },
      body: JSON.stringify({
        invoiceId: invoice.id,
        amountMinor: 100000,
        method: "UPI",
        reference: "UPI/2026/889911"
      })
    });
    assert.equal(payRes.status, 201);
    const { data: payData } = await payRes.json();
    assert.equal(payData.invoice.balanceDueMinor, invoice.totalMinor - 100000);

    // 10. Reports
    const repValRes = await fetch(`${baseUrl}/reports/inventory-valuation`, { headers: authHeaders });
    assert.equal(repValRes.status, 200);
    const repGstRes = await fetch(`${baseUrl}/reports/gst-summary`, { headers: authHeaders });
    assert.equal(repGstRes.status, 200);

    // 11. Audit Logs
    const auditRes = await fetch(`${baseUrl}/audit/logs`, { headers: authHeaders });
    assert.equal(auditRes.status, 200);
    const { data: logs } = await auditRes.json();
    assert.equal(logs.length > 5, true);

    // 12. Notifications
    const notifRes = await fetch(`${baseUrl}/notifications`, { headers: authHeaders });
    assert.equal(notifRes.status, 200);

  } finally {
    server.close();
  }
});
