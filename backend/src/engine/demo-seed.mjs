import crypto from "node:crypto";
import { hashPassword } from "./stockpulse-engine.mjs";

export async function seedDemoData(engine) {
  // If demo tenant already exists, don't duplicate
  if (engine.state.tenants.some((t) => t.slug === "sahyadri-materials")) {
    return;
  }

  // 1. Register Sahyadri Construction Materials Pvt Ltd
  const { tenant, session: ownerSession } = engine.registerTenantAndOwner({
    companyName: "Sahyadri Construction Materials Pvt Ltd",
    slug: "sahyadri-materials",
    currencyCode: "INR",
    countryCode: "IN",
    taxRegistrationNo: "33AABCS1429B1Z5",
    ownerName: "Vikram Deshmukh",
    email: "vikram@sahyadri.in",
    password: "SahyadriSecure#2026",
    isDemo: true
  });

  // 2. Add Team Members with specific roles
  const demoUsers = [
    { email: "admin@sahyadri.in", name: "Priya Sharma", role: "ADMINISTRATOR" },
    { email: "manager@sahyadri.in", name: "Rajesh Kumar", role: "MANAGER" },
    { email: "sales@sahyadri.in", name: "Ananya Verma", role: "SALES_STAFF" },
    { email: "warehouse@sahyadri.in", name: "Murugan R", role: "WAREHOUSE_STAFF" },
    { email: "production@sahyadri.in", name: "Suresh Patil", role: "PRODUCTION_STAFF" },
    { email: "accounts@sahyadri.in", name: "Deepa Joshi", role: "ACCOUNTANT" },
    { email: "viewer@sahyadri.in", name: "Kiran Rao", role: "VIEWER" }
  ];

  for (const u of demoUsers) {
    const user = {
      id: crypto.randomUUID(),
      email: u.email,
      fullName: u.name,
      passwordHash: hashPassword("DemoPassword#123"),
      isActive: true,
      createdAt: new Date().toISOString()
    };
    engine.state.users.push(user);
    engine.state.memberships.push({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      userId: user.id,
      role: u.role,
      isDefault: true,
      createdAt: new Date().toISOString()
    });
  }

  // 3. Create Warehouses
  const whSalem = await engine.createWarehouse(ownerSession, {
    code: "WH-SALEM",
    name: "Salem Manufacturing & Dispatch Hub",
    location: "SIDCO Industrial Estate, Salem"
  });

  const whPune = await engine.createWarehouse(ownerSession, {
    code: "WH-PUNE",
    name: "Pune Distribution Yard",
    location: "Chakan Industrial Area, Pune"
  });

  // 4. Create Products
  const rmCement = await engine.createProduct(ownerSession, {
    sku: "RM-CEMENT-OPC",
    name: "OPC 53 Bulk Cement",
    categoryName: "Raw Materials",
    uom: "KG",
    productType: "RAW_MATERIAL",
    purchasePriceMinor: 850,
    sellingPriceMinor: 1000,
    reorderThreshold: 500
  });

  const rmSand = await engine.createProduct(ownerSession, {
    sku: "RM-SAND-M",
    name: "Manufactured Sand (M-Sand)",
    categoryName: "Raw Materials",
    uom: "TON",
    productType: "RAW_MATERIAL",
    purchasePriceMinor: 120000,
    sellingPriceMinor: 150000,
    reorderThreshold: 20
  });

  const rmAggregate = await engine.createProduct(ownerSession, {
    sku: "RM-AGGREGATE-20MM",
    name: "Crushed Stone Aggregate 20mm",
    categoryName: "Raw Materials",
    uom: "TON",
    productType: "RAW_MATERIAL",
    purchasePriceMinor: 95000,
    sellingPriceMinor: 125000,
    reorderThreshold: 30
  });

  const fgPaver = await engine.createProduct(ownerSession, {
    sku: "FG-PAVER-80MM",
    name: "Heavy-Duty Interlocking Paver Block 80mm",
    categoryName: "Finished Goods",
    uom: "PCS",
    productType: "FINISHED_GOOD",
    purchasePriceMinor: 2200,
    sellingPriceMinor: 3500, // ₹35.00
    taxRateBps: 1800, // 18% GST
    reorderThreshold: 200
  });

  const fgKerb = await engine.createProduct(ownerSession, {
    sku: "FG-KERB-STONE",
    name: "Precast Concrete Kerb Stone 300x150",
    categoryName: "Finished Goods",
    uom: "PCS",
    productType: "FINISHED_GOOD",
    purchasePriceMinor: 18000,
    sellingPriceMinor: 27500, // ₹275.00
    taxRateBps: 1800,
    reorderThreshold: 50
  });

  const fgHollow = await engine.createProduct(ownerSession, {
    sku: "FG-HOLLOW-BLOCK",
    name: "Cellular Lightweight Concrete Hollow Block",
    categoryName: "Finished Goods",
    uom: "PCS",
    productType: "FINISHED_GOOD",
    purchasePriceMinor: 4500,
    sellingPriceMinor: 7200,
    taxRateBps: 1800,
    reorderThreshold: 150
  });

  // 5. Stock Receipts
  await engine.recordStockReceipt(ownerSession, {
    warehouseId: whSalem.id,
    productId: rmCement.id,
    quantity: 4000,
    unitCostMinor: 850,
    reason: "Bulk cement delivery via silo tanker"
  });

  await engine.recordStockReceipt(ownerSession, {
    warehouseId: whSalem.id,
    productId: rmSand.id,
    quantity: 80,
    unitCostMinor: 120000,
    reason: "River quarry delivery"
  });

  await engine.recordStockReceipt(ownerSession, {
    warehouseId: whSalem.id,
    productId: rmAggregate.id,
    quantity: 100,
    unitCostMinor: 95000,
    reason: "Stone crusher fleet receipt"
  });

  await engine.recordStockReceipt(ownerSession, {
    warehouseId: whSalem.id,
    productId: fgPaver.id,
    quantity: 600,
    unitCostMinor: 2200,
    reason: "Opening yard inventory"
  });

  await engine.recordStockReceipt(ownerSession, {
    warehouseId: whSalem.id,
    productId: fgKerb.id,
    quantity: 120,
    unitCostMinor: 18000,
    reason: "Opening yard inventory"
  });

  // Intentionally under reorder threshold (40 < 150) to generate a LOW STOCK alert
  await engine.recordStockReceipt(ownerSession, {
    warehouseId: whSalem.id,
    productId: fgHollow.id,
    quantity: 40,
    unitCostMinor: 4500,
    reason: "Sample test batch received"
  });

  // 6. Suppliers
  const supUltraTech = await engine.createSupplier(ownerSession, {
    code: "SUP-ULTRATECH",
    name: "UltraTech Cement Limited",
    contactPerson: "Sunil Agarwal",
    phone: "+91 98200 12345",
    email: "orders@ultratech.example.com",
    taxId: "27AAACU1234F1Z8"
  });

  await engine.createSupplier(ownerSession, {
    code: "SUP-TATA",
    name: "Tata Steel Logistics & Minerals",
    contactPerson: "Arun Sen",
    phone: "+91 98300 54321",
    email: "b2b@tatasteel.example.com",
    taxId: "20AAACT0466C1ZR"
  });

  // 7. Customers
  const custLnt = await engine.createCustomer(ownerSession, {
    code: "CUST-LNT",
    name: "L&T Infrastructure Projects Ltd",
    contactPerson: "Ganesh Iyer",
    phone: "+91 98400 98765",
    email: "procurement@lntinfra.example.com",
    taxId: "33AAACL0140P1Z1",
    creditLimitMinor: 50000000,
    paymentTermsDays: 45
  });

  const custShapoorji = await engine.createCustomer(ownerSession, {
    code: "CUST-SHAPOORJI",
    name: "Shapoorji Pallonji Construction",
    contactPerson: "Farokh Engineer",
    phone: "+91 98210 65432",
    email: "purchasing@shapoorji.example.com",
    taxId: "27AAACS1820E1ZL",
    creditLimitMinor: 35000000,
    paymentTermsDays: 30
  });

  // 8. Purchase Order & Partial Receipt
  const po1 = await engine.createPurchaseOrder(ownerSession, {
    supplierId: supUltraTech.id,
    warehouseId: whSalem.id,
    items: [
      { productId: rmCement.id, orderedQty: 2000, unitCostMinor: 850 }
    ]
  });

  await engine.receiveGoods(ownerSession, {
    purchaseOrderId: po1.id,
    idempotencyKey: "seed-grn-001",
    items: [{ productId: rmCement.id, receivedQty: 1000, rejectedQty: 0 }],
    notes: "First installment unloaded at silo #2"
  });

  // 9. BOM (Bill of Materials) & Completed Production Batch
  const bomPaver = await engine.createBom(ownerSession, {
    finishedProductId: fgPaver.id,
    code: "BOM-PAVER-80",
    name: "80mm Paver Standard Mix",
    baseOutputQty: 100,
    estLaborCostMinor: 15000,
    estOverheadCostMinor: 10000,
    items: [{ rawMaterialId: rmCement.id, quantityPerBase: 150, scrapPercent: 2 }]
  });

  const batch1 = await engine.createProductionBatch(ownerSession, {
    bomId: bomPaver.id,
    warehouseId: whSalem.id,
    plannedQty: 300
  });
  await engine.startProductionBatch(ownerSession, { batchId: batch1.id });
  await engine.completeProductionBatch(ownerSession, {
    batchId: batch1.id,
    actualGoodQty: 300,
    rejectedWastageQty: 6
  });

  // 10. Quotation & Order Lifecycle
  await engine.createQuotation(ownerSession, {
    customerId: custShapoorji.id,
    items: [
      { productId: fgKerb.id, quantity: 50, discountMinor: 25000 }
    ]
  });

  const order1 = await engine.createOrder(ownerSession, {
    customerId: custLnt.id,
    warehouseId: whSalem.id,
    items: [
      { productId: fgPaver.id, orderedQty: 400, unitPriceMinor: 3500, taxRateBps: 1800 }
    ],
    notes: "Urgent delivery for Salem Bypass Phase-2"
  });

  await engine.confirmOrder(ownerSession, {
    orderId: order1.id,
    idempotencyKey: "seed-confirm-order-001"
  });

  const dispatch1 = await engine.createAndExecuteDispatch(ownerSession, {
    orderId: order1.id,
    vehicleNumber: "TN-30-AQ-8899",
    driverName: "Murugan R",
    driverPhone: "+91 94432 11223",
    items: [{ productId: fgPaver.id, quantity: 400 }],
    notes: "Heavy container transit"
  });

  await engine.deliverDispatch(ownerSession, {
    dispatchId: dispatch1.id,
    podReference: "POD-LNT-SALEM-0912"
  });

  const invoice1 = await engine.createInvoiceFromOrder(ownerSession, {
    orderId: order1.id,
    financialYear: "2026-27"
  });

  await engine.recordPayment(ownerSession, {
    invoiceId: invoice1.id,
    amountMinor: 800000, // ₹8,000.00 partial payment
    method: "NEFT",
    reference: "NEFT-AXIS-9928172",
    idempotencyKey: "seed-payment-001"
  });

  // Run overdue check to populate overdue list if needed
  await engine.runOverdueInvoiceSweep(ownerSession);
}
