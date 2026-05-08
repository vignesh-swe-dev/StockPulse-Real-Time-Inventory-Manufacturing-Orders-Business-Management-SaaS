export function registerReportsRoutes(router, engine) {
  // GET /api/v1/reports/inventory-valuation
  router.get("/api/v1/reports/inventory-valuation", { auth: true, permission: "reports:read" }, async ({ session, query }) => {
    const balances = engine.getInventoryBalances(session, { warehouseId: query.warehouseId || null });
    const totalValuationMinor = balances.reduce((sum, b) => sum + b.valuationMinor, 0);
    const totalOnHandItems = balances.reduce((sum, b) => sum + b.onHandQty, 0);

    return {
      totalValuationMinor,
      totalOnHandItems,
      itemCount: balances.length,
      items: balances
    };
  });

  // GET /api/v1/reports/stock-ageing
  router.get("/api/v1/reports/stock-ageing", { auth: true, permission: "reports:read" }, async ({ session }) => {
    const balances = engine.getInventoryBalances(session);
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;

    const ageing = balances.map((b) => {
      // Find latest movement for this product and warehouse
      const latestMv = engine.state.stockMovements
        .filter((m) => m.tenantId === session.tenantId && m.productId === b.productId && m.warehouseId === b.warehouseId)
        .slice(-1)[0];
      const ageDays = latestMv ? Math.max(0, Math.floor((now - new Date(latestMv.createdAt).getTime()) / dayMs)) : 0;
      let bucket = "0-30 days";
      if (ageDays > 90) bucket = ">90 days";
      else if (ageDays > 60) bucket = "61-90 days";
      else if (ageDays > 30) bucket = "31-60 days";

      return {
        ...b,
        lastMovementAt: latestMv?.createdAt || b.updatedAt,
        ageDays,
        bucket
      };
    });

    const summaryByBucket = {
      "0-30 days": ageing.filter((a) => a.bucket === "0-30 days").reduce((s, a) => s + a.valuationMinor, 0),
      "31-60 days": ageing.filter((a) => a.bucket === "31-60 days").reduce((s, a) => s + a.valuationMinor, 0),
      "61-90 days": ageing.filter((a) => a.bucket === "61-90 days").reduce((s, a) => s + a.valuationMinor, 0),
      ">90 days": ageing.filter((a) => a.bucket === ">90 days").reduce((s, a) => s + a.valuationMinor, 0)
    };

    return {
      summaryByBucket,
      items: ageing
    };
  });

  // GET /api/v1/reports/sales-summary
  router.get("/api/v1/reports/sales-summary", { auth: true, permission: "reports:read" }, async ({ session }) => {
    const orders = engine.state.orders.filter(
      (o) => o.tenantId === session.tenantId && o.status !== "CANCELLED"
    );
    const totalSalesMinor = orders.reduce((sum, o) => sum + o.totalMinor, 0);
    const totalTaxMinor = orders.reduce((sum, o) => sum + o.taxMinor, 0);

    // Sales by customer
    const customerMap = new Map();
    for (const o of orders) {
      const cust = engine.state.customers.find((c) => c.id === o.customerId);
      const name = cust?.name || "Unknown";
      const current = customerMap.get(name) || { customerName: name, orderCount: 0, totalSalesMinor: 0 };
      current.orderCount += 1;
      current.totalSalesMinor += o.totalMinor;
      customerMap.set(name, current);
    }

    return {
      totalSalesMinor,
      totalTaxMinor,
      orderCount: orders.length,
      byCustomer: Array.from(customerMap.values())
    };
  });

  // GET /api/v1/reports/gst-summary
  router.get("/api/v1/reports/gst-summary", { auth: true, permission: "reports:read" }, async ({ session }) => {
    const invoices = engine.state.invoices.filter((i) => i.tenantId === session.tenantId);
    let totalTaxableMinor = 0;
    let totalCgstMinor = 0;
    let totalSgstMinor = 0;
    let totalIgstMinor = 0;
    let totalInvoiceAmountMinor = 0;

    for (const inv of invoices) {
      totalTaxableMinor += inv.subtotalMinor - inv.discountMinor;
      // In Indian GST, intra-state is CGST + SGST (50% each), inter-state is IGST (100%)
      // For standard reporting, split into CGST and SGST
      const halfTax = Math.floor(inv.taxMinor / 2);
      totalCgstMinor += halfTax;
      totalSgstMinor += inv.taxMinor - halfTax;
      totalInvoiceAmountMinor += inv.totalMinor;
    }

    return {
      invoiceCount: invoices.length,
      totalTaxableMinor,
      totalCgstMinor,
      totalSgstMinor,
      totalIgstMinor,
      totalTaxMinor: totalCgstMinor + totalSgstMinor + totalIgstMinor,
      totalInvoiceAmountMinor
    };
  });
}
