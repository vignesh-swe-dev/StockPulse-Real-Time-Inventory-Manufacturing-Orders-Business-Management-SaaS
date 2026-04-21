import crypto from "node:crypto";

/**
 * Role-Based Access Control Permission Matrix
 * Enforced on the server for every protected endpoint and WebSocket room subscription.
 */
export const ROLE_PERMISSIONS = {
  OWNER: ["*"],
  ADMINISTRATOR: [
    "dashboard:view", "products:read", "products:write", "inventory:read", "inventory:write",
    "warehouses:read", "warehouses:write", "suppliers:read", "suppliers:write",
    "purchases:read", "purchases:write", "customers:read", "customers:write",
    "quotations:read", "quotations:write", "orders:read", "orders:write",
    "production:read", "production:write", "dispatch:read", "dispatch:write",
    "invoices:read", "invoices:write", "payments:read", "payments:write",
    "reports:read", "audit:read", "users:read", "users:write", "settings:write"
  ],
  MANAGER: [
    "dashboard:view", "products:read", "products:write", "inventory:read", "inventory:write",
    "warehouses:read", "suppliers:read", "suppliers:write", "purchases:read", "purchases:write",
    "customers:read", "customers:write", "quotations:read", "quotations:write",
    "orders:read", "orders:write", "production:read", "production:write",
    "dispatch:read", "dispatch:write", "invoices:read", "invoices:write",
    "payments:read", "reports:read"
  ],
  SALES_STAFF: [
    "dashboard:view", "products:read", "inventory:read", "customers:read", "customers:write",
    "quotations:read", "quotations:write", "orders:read", "orders:write", "invoices:read"
  ],
  WAREHOUSE_STAFF: [
    "dashboard:view", "products:read", "inventory:read", "inventory:write",
    "warehouses:read", "purchases:read", "purchases:write", "orders:read",
    "dispatch:read", "dispatch:write"
  ],
  PRODUCTION_STAFF: [
    "dashboard:view", "products:read", "inventory:read", "production:read", "production:write"
  ],
  ACCOUNTANT: [
    "dashboard:view", "products:read", "inventory:read", "customers:read", "suppliers:read",
    "orders:read", "invoices:read", "invoices:write", "payments:read", "payments:write",
    "reports:read", "audit:read"
  ],
  VIEWER: [
    "dashboard:view", "products:read", "inventory:read", "warehouses:read",
    "suppliers:read", "purchases:read", "customers:read", "quotations:read",
    "orders:read", "production:read", "dispatch:read", "invoices:read",
    "payments:read", "reports:read"
  ]
};

/**
 * Valid Server-Side Order Status Transitions
 */
export const VALID_ORDER_TRANSITIONS = {
  DRAFT: ["QUOTED", "CONFIRMED", "CANCELLED"],
  QUOTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["AWAITING_STOCK", "IN_PRODUCTION", "READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED", "DISPATCHED", "CANCELLED"],
  AWAITING_STOCK: ["IN_PRODUCTION", "READY_FOR_DISPATCH", "CANCELLED"],
  IN_PRODUCTION: ["READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED", "CANCELLED"],
  READY_FOR_DISPATCH: ["PARTIALLY_DISPATCHED", "DISPATCHED", "CANCELLED"],
  PARTIALLY_DISPATCHED: ["DISPATCHED", "DELIVERED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
};

export class DomainError extends Error {
  constructor(code, message, statusCode = 400, details = {}) {
    super(`[${code}] ${message}`);
    this.name = "DomainError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, storedHash) {
  const parts = String(storedHash).split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, originalHex] = parts;
  const derivedHex = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(originalHex, "hex"), Buffer.from(derivedHex, "hex"));
}

/**
 * Exact integer minor currency arithmetic helpers (paise / cents).
 * Never uses binary floating-point for money!
 */
export function calculateLineAmountsMinor({ quantity, unitPriceMinor, discountMinor = 0, taxRateBps = 0 }) {
  if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new DomainError("INVALID_MONEY_UNIT", "unitPriceMinor must be a non-negative integer in minor currency units.");
  }
  if (!Number.isInteger(discountMinor) || discountMinor < 0) {
    throw new DomainError("INVALID_MONEY_UNIT", "discountMinor must be a non-negative integer in minor currency units.");
  }
  // Support up to 3 decimal places on quantity (milli-units) using BigInt integer math
  const qtyMilli = BigInt(Math.round(Number(quantity) * 1000));
  if (qtyMilli <= 0n) {
    throw new DomainError("INVALID_QUANTITY", "Quantity must be greater than zero.");
  }
  const grossMinor = Number((qtyMilli * BigInt(unitPriceMinor) + 500n) / 1000n);
  if (discountMinor > grossMinor) {
    throw new DomainError("INVALID_DISCOUNT", "Discount cannot exceed gross line subtotal.");
  }
  const taxableMinor = grossMinor - discountMinor;
  const taxMinor = Number((BigInt(taxableMinor) * BigInt(taxRateBps) + 5000n) / 10000n);
  const lineTotalMinor = taxableMinor + taxMinor;
  return { grossMinor, discountMinor, taxableMinor, taxMinor, lineTotalMinor };
}

export function hasPermission(role, permissionCode) {
  const perms = ROLE_PERMISSIONS[role] || [];
  if (perms.includes("*")) return true;
  return perms.includes(permissionCode);
}

export function assertPermission(session, permissionCode) {
  if (!session || !session.userId || !session.tenantId) {
    throw new DomainError("UNAUTHORIZED", "Authentication session is required.", 401);
  }
  if (!hasPermission(session.role, permissionCode)) {
    throw new DomainError(
      "FORBIDDEN",
      `Role '${session.role}' does not have required permission '${permissionCode}'.`,
      403
    );
  }
}

export function createStockPulseEngine({ seedDemoData = false } = {}) {
  const state = {
    tenants: [],
    branches: [],
    users: [],
    memberships: [],
    sessions: new Map(), // accessToken -> session
    refreshTokens: new Map(), // refreshToken -> { userId, tenantId, role, revoked }
    loginAttempts: new Map(), // email/ip -> { count, lockedUntil }
    categories: [],
    warehouses: [],
    products: [],
    stockBalances: [], // { id, tenantId, warehouseId, productId, onHandQty, reservedQty, unitCostMinor, version }
    stockMovements: [],
    stockReservations: [],
    suppliers: [],
    purchaseOrders: [],
    goodsReceipts: [],
    customers: [],
    quotations: [],
    orders: [],
    boms: [],
    productionBatches: [],
    dispatches: [],
    invoices: [],
    payments: [],
    notifications: [],
    auditLogs: [],
    outboxEvents: [],
    idempotencyRecords: new Map(), // `${tenantId}:${operation}:${key}` -> response
    jobQueue: [],
    wsSubscribers: new Map() // room -> Set<callback>
  };

  let mutexLocked = false;
  const mutexQueue = [];

  async function withTransaction(fn) {
    while (mutexLocked) {
      await new Promise((resolve) => mutexQueue.push(resolve));
    }
    mutexLocked = true;
    const snapshot = structuredClone({
      tenants: state.tenants,
      branches: state.branches,
      categories: state.categories,
      warehouses: state.warehouses,
      products: state.products,
      stockBalances: state.stockBalances,
      stockMovements: state.stockMovements,
      stockReservations: state.stockReservations,
      suppliers: state.suppliers,
      purchaseOrders: state.purchaseOrders,
      goodsReceipts: state.goodsReceipts,
      customers: state.customers,
      quotations: state.quotations,
      orders: state.orders,
      boms: state.boms,
      productionBatches: state.productionBatches,
      dispatches: state.dispatches,
      invoices: state.invoices,
      payments: state.payments,
      notifications: state.notifications,
      auditLogs: state.auditLogs,
      outboxEvents: state.outboxEvents
    });
    const stagedEvents = [];
    try {
      const result = await fn({
        stageEvent(eventType, tenantId, entityId, payload) {
          stagedEvents.push({
            eventId: crypto.randomUUID(),
            eventType,
            tenantId,
            entityId,
            timestamp: new Date().toISOString(),
            schemaVersion: "1.0",
            payload
          });
        }
      });
      // Commit staged events to transactional outbox and publish only after commit
      for (const evt of stagedEvents) {
        state.outboxEvents.push({ ...evt, status: "PUBLISHED", publishedAt: evt.timestamp });
        const room = `tenant:${evt.tenantId}`;
        const subs = state.wsSubscribers.get(room);
        if (subs) {
          for (const cb of subs) cb(evt);
        }
      }
      return result;
    } catch (err) {
      Object.assign(state, snapshot);
      throw err;
    } finally {
      mutexLocked = false;
      const next = mutexQueue.shift();
      if (next) next();
    }
  }

  function recordAudit(session, action, entityType, entityId, metadata = {}) {
    // Strip any sensitive fields
    const safeMeta = { ...metadata };
    delete safeMeta.password;
    delete safeMeta.passwordHash;
    delete safeMeta.accessToken;
    delete safeMeta.refreshToken;
    const entry = {
      id: crypto.randomUUID(),
      tenantId: session.tenantId,
      actorId: session.userId,
      actorRole: session.role,
      action,
      entityType,
      entityId,
      metadata: safeMeta,
      createdAt: new Date().toISOString()
    };
    state.auditLogs.push(entry);
    return entry;
  }

  function createNotification(tx, { tenantId, type, title, message, entityType, entityId, dedupeKey }) {
    if (dedupeKey) {
      const existingUnread = state.notifications.find(
        (n) => n.tenantId === tenantId && n.dedupeKey === dedupeKey && !n.isRead
      );
      if (existingUnread) return existingUnread;
    }
    const notif = {
      id: crypto.randomUUID(),
      tenantId,
      type,
      title,
      message,
      entityType,
      entityId,
      dedupeKey: dedupeKey || null,
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString()
    };
    state.notifications.push(notif);
    tx.stageEvent("notification.created", tenantId, notif.id, {
      id: notif.id,
      type: notif.type,
      title: notif.title,
      entityType: notif.entityType,
      entityId: notif.entityId
    });
    return notif;
  }

  function assertTenantMatch(session, record, entityName = "Record") {
    if (!record || record.tenantId !== session.tenantId) {
      throw new DomainError("NOT_FOUND", `${entityName} not found in active tenant.`, 404);
    }
    return record;
  }

  // --- AUTHENTICATION & TENANT REGISTRATION ---
  function registerTenantAndOwner({
    companyName,
    slug,
    currencyCode = "INR",
    countryCode = "IN",
    taxRegistrationNo = null,
    allowNegativeStock = false,
    ownerName,
    email,
    password,
    isDemo = false
  }) {
    if (!companyName || !email || !password || password.length < 8) {
      throw new DomainError("VALIDATION_ERROR", "Company name, valid email, and password (>= 8 chars) are required.");
    }
    const normalizedEmail = email.trim().toLowerCase();
    const tenantSlug = (slug || companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, "");
    if (state.tenants.some((t) => t.slug === tenantSlug)) {
      throw new DomainError("DUPLICATE_TENANT", `Tenant slug '${tenantSlug}' already exists.`, 409);
    }
    let user = state.users.find((u) => u.email === normalizedEmail);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        fullName: ownerName || "Organization Owner",
        passwordHash: hashPassword(password),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      state.users.push(user);
    }
    const tenant = {
      id: crypto.randomUUID(),
      name: companyName.trim(),
      slug: tenantSlug,
      currencyCode,
      countryCode,
      taxRegistrationNo,
      financialYearStart: 4,
      allowNegativeStock: Boolean(allowNegativeStock),
      valuationMethod: "WEIGHTED_AVERAGE",
      planTier: "GROWTH",
      isDemo: Boolean(isDemo),
      createdAt: new Date().toISOString()
    };
    state.tenants.push(tenant);

    const membership = {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      userId: user.id,
      role: "OWNER",
      isDefault: true,
      createdAt: new Date().toISOString()
    };
    state.memberships.push(membership);

    const session = issueSession(user, tenant, "OWNER");
    recordAudit(session, "tenant.registered", "Tenant", tenant.id, { companyName: tenant.name, isDemo });
    return { tenant, user: { id: user.id, email: user.email, fullName: user.fullName }, session };
  }

  function issueSession(user, tenant, role) {
    const accessToken = `sp_at_${crypto.randomUUID().replace(/-/g, "")}`;
    const refreshToken = `sp_rt_${crypto.randomUUID().replace(/-/g, "")}`;
    const session = {
      accessToken,
      refreshToken,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      taxRegistrationNo: tenant.taxRegistrationNo || null,
      currencyCode: tenant.currencyCode,
      financialYearStart: tenant.financialYearStart,
      planTier: tenant.planTier,
      isDemo: Boolean(tenant.isDemo),
      role,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000
    };
    state.sessions.set(accessToken, session);
    state.refreshTokens.set(refreshToken, {
      userId: user.id,
      tenantId: tenant.id,
      role,
      revoked: false
    });
    return session;
  }

  function login({ email, password, tenantId = null }) {
    const key = String(email || "").trim().toLowerCase();
    const attempt = state.loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
    if (attempt.lockedUntil > Date.now()) {
      throw new DomainError("RATE_LIMITED", "Too many failed login attempts. Account temporarily locked.", 429);
    }
    const user = state.users.find((u) => u.email === key && u.isActive);
    if (!user || !verifyPassword(password || "", user.passwordHash)) {
      attempt.count += 1;
      if (attempt.count >= 5) {
        attempt.lockedUntil = Date.now() + 15 * 60 * 1000;
      }
      state.loginAttempts.set(key, attempt);
      throw new DomainError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }
    state.loginAttempts.delete(key);
    const membership = tenantId
      ? state.memberships.find((m) => m.userId === user.id && m.tenantId === tenantId)
      : state.memberships.find((m) => m.userId === user.id && m.isDefault) ||
        state.memberships.find((m) => m.userId === user.id);
    if (!membership) {
      throw new DomainError("NO_TENANT_ACCESS", "User is not a member of the requested tenant.", 403);
    }
    const tenant = state.tenants.find((t) => t.id === membership.tenantId);
    const session = issueSession(user, tenant, membership.role);
    recordAudit(session, "auth.login", "User", user.id, { tenantId: tenant.id });
    return session;
  }

  function logout(accessToken) {
    const session = state.sessions.get(accessToken);
    if (session) {
      state.sessions.delete(accessToken);
      const rt = state.refreshTokens.get(session.refreshToken);
      if (rt) rt.revoked = true;
      recordAudit(session, "auth.logout", "User", session.userId, {});
    }
    return { success: true };
  }

  // --- WAREHOUSES & PRODUCTS ---
  async function createWarehouse(session, { code, name, location = "" }) {
    assertPermission(session, "warehouses:write");
    if (!code || !name) {
      throw new DomainError("VALIDATION_ERROR", "Warehouse code and name are required.");
    }
    return withTransaction(async () => {
      const normalizedCode = code.trim().toUpperCase();
      if (state.warehouses.some((w) => w.tenantId === session.tenantId && w.code === normalizedCode)) {
        throw new DomainError("DUPLICATE_WAREHOUSE", `Warehouse code '${normalizedCode}' already exists in this tenant.`, 409);
      }
      const warehouse = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        code: normalizedCode,
        name: name.trim(),
        location: location.trim(),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      state.warehouses.push(warehouse);
      recordAudit(session, "warehouse.created", "Warehouse", warehouse.id, { code: warehouse.code, name: warehouse.name });
      return warehouse;
    });
  }

  async function createProduct(session, {
    sku,
    barcode = null,
    name,
    categoryName = "General",
    uom = "PCS",
    productType = "FINISHED_GOOD",
    purchasePriceMinor = 0,
    sellingPriceMinor = 0,
    taxRateBps = 1800,
    reorderThreshold = 0
  }) {
    assertPermission(session, "products:write");
    if (!sku || !name) {
      throw new DomainError("VALIDATION_ERROR", "Product SKU and name are required.");
    }
    if (!Number.isInteger(purchasePriceMinor) || !Number.isInteger(sellingPriceMinor) || purchasePriceMinor < 0 || sellingPriceMinor < 0) {
      throw new DomainError("INVALID_MONEY_UNIT", "Prices must be non-negative integers in minor units (paise/cents).");
    }
    return withTransaction(async () => {
      const normalizedSku = sku.trim().toUpperCase();
      if (state.products.some((p) => p.tenantId === session.tenantId && p.sku === normalizedSku)) {
        throw new DomainError("DUPLICATE_SKU", `Product SKU '${normalizedSku}' already exists in this tenant.`, 409);
      }
      const product = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        sku: normalizedSku,
        barcode: barcode ? String(barcode).trim() : null,
        name: name.trim(),
        categoryName: categoryName.trim(),
        uom: uom.trim().toUpperCase(),
        productType,
        purchasePriceMinor,
        sellingPriceMinor,
        taxRateBps: Number(taxRateBps),
        reorderThreshold: Number(reorderThreshold),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      state.products.push(product);
      recordAudit(session, "product.created", "Product", product.id, { sku: product.sku, name: product.name });
      return product;
    });
  }

  // --- INVENTORY & STOCK LEDGER ---
  function getOrCreateBalance(tenantId, warehouseId, productId, defaultCostMinor = 0) {
    let bal = state.stockBalances.find(
      (b) => b.tenantId === tenantId && b.warehouseId === warehouseId && b.productId === productId
    );
    if (!bal) {
      bal = {
        id: crypto.randomUUID(),
        tenantId,
        warehouseId,
        productId,
        onHandQty: 0,
        reservedQty: 0,
        unitCostMinor: defaultCostMinor,
        version: 1,
        updatedAt: new Date().toISOString()
      };
      state.stockBalances.push(bal);
    }
    return bal;
  }

  function applyStockMovementInternal(tx, session, {
    warehouseId,
    productId,
    movementType,
    quantityDelta,
    unitCostMinor = null,
    referenceType,
    referenceId = null,
    reason,
    reversedMovementId = null
  }) {
    if (!reason || String(reason).trim().length < 3) {
      throw new DomainError("REASON_REQUIRED", "Every stock movement requires an auditable reason.");
    }
    const warehouse = assertTenantMatch(
      session,
      state.warehouses.find((w) => w.id === warehouseId),
      "Warehouse"
    );
    const product = assertTenantMatch(
      session,
      state.products.find((p) => p.id === productId),
      "Product"
    );
    const tenant = state.tenants.find((t) => t.id === session.tenantId);
    const bal = getOrCreateBalance(session.tenantId, warehouse.id, product.id, product.purchasePriceMinor);

    const delta = Number(quantityDelta);
    if (delta === 0 || Number.isNaN(delta)) {
      throw new DomainError("INVALID_QUANTITY", "Stock movement quantityDelta must be non-zero.");
    }
    const nextOnHand = Number((bal.onHandQty + delta).toFixed(3));
    const availableAfter = Number((nextOnHand - bal.reservedQty).toFixed(3));

    if (delta < 0 && !tenant.allowNegativeStock && nextOnHand < 0) {
      throw new DomainError(
        "INSUFFICIENT_STOCK",
        `Insufficient physical stock for '${product.sku}' in warehouse '${warehouse.code}'. On-hand: ${bal.onHandQty}, requested deduction: ${Math.abs(delta)}.`,
        409
      );
    }

    // Update weighted average cost on positive inflows
    const inflowCost = unitCostMinor !== null && unitCostMinor !== undefined ? Number(unitCostMinor) : bal.unitCostMinor || product.purchasePriceMinor;
    if (delta > 0 && bal.onHandQty >= 0) {
      const existingValue = BigInt(Math.round(bal.onHandQty * 1000)) * BigInt(bal.unitCostMinor);
      const addedValue = BigInt(Math.round(delta * 1000)) * BigInt(inflowCost);
      const totalQtyMilli = BigInt(Math.round(nextOnHand * 1000));
      if (totalQtyMilli > 0n) {
        bal.unitCostMinor = Number((existingValue + addedValue) / totalQtyMilli);
      }
    }

    bal.onHandQty = nextOnHand;
    bal.version += 1;
    bal.updatedAt = new Date().toISOString();

    const movement = {
      id: crypto.randomUUID(),
      tenantId: session.tenantId,
      warehouseId: warehouse.id,
      productId: product.id,
      movementType,
      quantityDelta: delta,
      balanceAfter: nextOnHand,
      unitCostMinor: inflowCost,
      referenceType,
      referenceId,
      reason: String(reason).trim(),
      reversedMovementId,
      actorUserId: session.userId,
      createdAt: new Date().toISOString()
    };
    state.stockMovements.push(movement);

    tx.stageEvent("inventory.updated", session.tenantId, product.id, {
      warehouseId: warehouse.id,
      productId: product.id,
      sku: product.sku,
      onHandQty: bal.onHandQty,
      reservedQty: bal.reservedQty,
      availableQty: availableAfter,
      movementType
    });

    if (availableAfter <= product.reorderThreshold) {
      tx.stageEvent("inventory.low_stock", session.tenantId, product.id, {
        warehouseId: warehouse.id,
        productId: product.id,
        sku: product.sku,
        availableQty: availableAfter,
        reorderThreshold: product.reorderThreshold
      });
      createNotification(tx, {
        tenantId: session.tenantId,
        type: "LOW_STOCK",
        title: `Low Stock Alert: ${product.sku}`,
        message: `${product.name} in ${warehouse.code} has ${availableAfter} ${product.uom} available (Reorder threshold: ${product.reorderThreshold} ${product.uom}).`,
        entityType: "Product",
        entityId: product.id,
        dedupeKey: `low_stock:${warehouse.id}:${product.id}`
      });
    }

    recordAudit(session, `inventory.${movementType.toLowerCase()}`, "StockMovement", movement.id, {
      warehouseCode: warehouse.code,
      sku: product.sku,
      quantityDelta: delta,
      balanceAfter: nextOnHand,
      reason: movement.reason
    });

    return {
      movement,
      balance: {
        ...bal,
        availableQty: availableAfter
      }
    };
  }

  async function recordStockReceipt(session, { warehouseId, productId, quantity, unitCostMinor = null, reason = "Direct stock receipt", referenceId = null }) {
    assertPermission(session, "inventory:write");
    if (Number(quantity) <= 0) {
      throw new DomainError("INVALID_QUANTITY", "Receipt quantity must be positive.");
    }
    return withTransaction(async (tx) =>
      applyStockMovementInternal(tx, session, {
        warehouseId,
        productId,
        movementType: "PURCHASE_RECEIPT",
        quantityDelta: Number(quantity),
        unitCostMinor,
        referenceType: "RECEIPT",
        referenceId,
        reason
      })
    );
  }

  async function recordStockAdjustment(session, { warehouseId, productId, quantityDelta, reason }) {
    assertPermission(session, "inventory:write");
    if (!reason || String(reason).trim().length < 5) {
      throw new DomainError("REASON_REQUIRED", "Stock adjustment requires a mandatory reason (min 5 chars).");
    }
    return withTransaction(async (tx) =>
      applyStockMovementInternal(tx, session, {
        warehouseId,
        productId,
        movementType: Number(quantityDelta) > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantityDelta: Number(quantityDelta),
        referenceType: "ADJUSTMENT",
        reason
      })
    );
  }

  async function transferStock(session, { fromWarehouseId, toWarehouseId, productId, quantity, reason = "Inter-warehouse stock transfer" }) {
    assertPermission(session, "inventory:write");
    if (fromWarehouseId === toWarehouseId) {
      throw new DomainError("INVALID_TRANSFER", "Source and destination warehouses must be different.");
    }
    if (Number(quantity) <= 0) {
      throw new DomainError("INVALID_QUANTITY", "Transfer quantity must be positive.");
    }
    return withTransaction(async (tx) => {
      const fromBal = getOrCreateBalance(session.tenantId, fromWarehouseId, productId);
      const avail = Number((fromBal.onHandQty - fromBal.reservedQty).toFixed(3));
      if (avail < Number(quantity)) {
        throw new DomainError("INSUFFICIENT_AVAILABLE_STOCK", `Cannot transfer ${quantity}; only ${avail} unreserved available in source warehouse.`, 409);
      }
      const transferRef = `TRF-${Date.now()}`;
      const outRes = applyStockMovementInternal(tx, session, {
        warehouseId: fromWarehouseId,
        productId,
        movementType: "TRANSFER_OUT",
        quantityDelta: -Number(quantity),
        unitCostMinor: fromBal.unitCostMinor,
        referenceType: "TRANSFER",
        referenceId: transferRef,
        reason
      });
      const inRes = applyStockMovementInternal(tx, session, {
        warehouseId: toWarehouseId,
        productId,
        movementType: "TRANSFER_IN",
        quantityDelta: Number(quantity),
        unitCostMinor: fromBal.unitCostMinor,
        referenceType: "TRANSFER",
        referenceId: transferRef,
        reason
      });
      return { transferRef, outMovement: outRes.movement, inMovement: inRes.movement };
    });
  }

  async function editStockMovement() {
    throw new DomainError(
      "IMMUTABLE_LEDGER_ERROR",
      "Historical stock movements are immutable and cannot be edited directly. Create a reversal entry instead.",
      405
    );
  }

  async function reverseStockMovement(session, { movementId, reason }) {
    assertPermission(session, "inventory:write");
    if (!reason || String(reason).trim().length < 5) {
      throw new DomainError("REASON_REQUIRED", "Reversal requires a mandatory audit reason.");
    }
    return withTransaction(async (tx) => {
      const orig = assertTenantMatch(
        session,
        state.stockMovements.find((m) => m.id === movementId),
        "StockMovement"
      );
      if (state.stockMovements.some((m) => m.reversedMovementId === orig.id)) {
        throw new DomainError("ALREADY_REVERSED", "This stock movement has already been reversed.", 409);
      }
      return applyStockMovementInternal(tx, session, {
        warehouseId: orig.warehouseId,
        productId: orig.productId,
        movementType: "REVERSAL",
        quantityDelta: -orig.quantityDelta,
        unitCostMinor: orig.unitCostMinor,
        referenceType: "REVERSAL",
        referenceId: orig.id,
        reason: `Reversal of ${orig.id}: ${reason}`,
        reversedMovementId: orig.id
      });
    });
  }

  function getInventoryBalances(session, { warehouseId = null, productId = null } = {}) {
    assertPermission(session, "inventory:read");
    return state.stockBalances
      .filter((b) => {
        if (b.tenantId !== session.tenantId) return false;
        if (warehouseId && b.warehouseId !== warehouseId) return false;
        if (productId && b.productId !== productId) return false;
        return true;
      })
      .map((b) => {
        const product = state.products.find((p) => p.id === b.productId);
        const warehouse = state.warehouses.find((w) => w.id === b.warehouseId);
        const availableQty = Number((b.onHandQty - b.reservedQty).toFixed(3));
        const valuationMinor = Number((BigInt(Math.round(b.onHandQty * 1000)) * BigInt(b.unitCostMinor)) / 1000n);
        return {
          ...b,
          sku: product?.sku,
          productName: product?.name,
          uom: product?.uom,
          warehouseCode: warehouse?.code,
          warehouseName: warehouse?.name,
          availableQty,
          valuationMinor,
          isLowStock: product ? availableQty <= product.reorderThreshold : false
        };
      });
  }

  // --- SUPPLIERS, PURCHASE ORDERS & GOODS RECEIPTS (GRN) ---
  async function createSupplier(session, { code, name, contactPerson = "", phone = "", email = "", taxId = "" }) {
    assertPermission(session, "suppliers:write");
    return withTransaction(async () => {
      const supplier = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        contactPerson,
        phone,
        email,
        taxId,
        createdAt: new Date().toISOString()
      };
      state.suppliers.push(supplier);
      recordAudit(session, "supplier.created", "Supplier", supplier.id, { code: supplier.code, name: supplier.name });
      return supplier;
    });
  }

  async function createPurchaseOrder(session, { supplierId, warehouseId, items }) {
    assertPermission(session, "purchases:write");
    return withTransaction(async () => {
      assertTenantMatch(session, state.suppliers.find((s) => s.id === supplierId), "Supplier");
      assertTenantMatch(session, state.warehouses.find((w) => w.id === warehouseId), "Warehouse");
      const poCount = state.purchaseOrders.filter((p) => p.tenantId === session.tenantId).length + 1;
      const poItems = items.map((it) => {
        const prod = assertTenantMatch(session, state.products.find((p) => p.id === it.productId), "Product");
        return {
          id: crypto.randomUUID(),
          productId: prod.id,
          orderedQty: Number(it.orderedQty),
          receivedQty: 0,
          rejectedQty: 0,
          unitCostMinor: Number(it.unitCostMinor ?? prod.purchasePriceMinor)
        };
      });
      const totalMinor = poItems.reduce(
        (acc, it) => acc + Number((BigInt(Math.round(it.orderedQty * 1000)) * BigInt(it.unitCostMinor)) / 1000n),
        0
      );
      const po = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        supplierId,
        warehouseId,
        poNumber: `PO-${String(poCount).padStart(4, "0")}`,
        status: "ISSUED",
        items: poItems,
        totalMinor,
        createdAt: new Date().toISOString()
      };
      state.purchaseOrders.push(po);
      recordAudit(session, "po.created", "PurchaseOrder", po.id, { poNumber: po.poNumber, totalMinor });
      return po;
    });
  }

  async function receiveGoods(session, { purchaseOrderId, idempotencyKey, items, notes = "" }) {
    assertPermission(session, "purchases:write");
    if (!idempotencyKey) {
      throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "Goods receipt requires an idempotencyKey to prevent duplicate stock receipts.");
    }
    const idemKey = `${session.tenantId}:GRN:${idempotencyKey}`;
    if (state.idempotencyRecords.has(idemKey)) {
      return state.idempotencyRecords.get(idemKey);
    }
    return withTransaction(async (tx) => {
      const po = assertTenantMatch(
        session,
        state.purchaseOrders.find((p) => p.id === purchaseOrderId),
        "PurchaseOrder"
      );
      const grnCount = state.goodsReceipts.filter((g) => g.tenantId === session.tenantId).length + 1;
      const grnItems = [];

      for (const line of items) {
        const poItem = po.items.find((i) => i.productId === line.productId);
        if (!poItem) {
          throw new DomainError("INVALID_PO_ITEM", `Product ${line.productId} is not on PO ${po.poNumber}.`);
        }
        const recv = Number(line.receivedQty || 0);
        const rej = Number(line.rejectedQty || 0);
        const remaining = Number((poItem.orderedQty - poItem.receivedQty).toFixed(3));
        if (recv > remaining) {
          throw new DomainError("OVER_RECEIPT", `Cannot receive ${recv} of product ${line.productId}; only ${remaining} outstanding on PO ${po.poNumber}.`, 409);
        }
        poItem.receivedQty = Number((poItem.receivedQty + recv).toFixed(3));
        poItem.rejectedQty = Number((poItem.rejectedQty + rej).toFixed(3));

        if (recv > 0) {
          applyStockMovementInternal(tx, session, {
            warehouseId: po.warehouseId,
            productId: poItem.productId,
            movementType: "PURCHASE_RECEIPT",
            quantityDelta: recv,
            unitCostMinor: poItem.unitCostMinor,
            referenceType: "PO_GRN",
            referenceId: po.id,
            reason: `GRN against ${po.poNumber}`
          });
        }
        grnItems.push({
          id: crypto.randomUUID(),
          productId: poItem.productId,
          receivedQty: recv,
          rejectedQty: rej,
          unitCostMinor: poItem.unitCostMinor
        });
      }

      const allReceived = po.items.every((i) => i.receivedQty >= i.orderedQty);
      po.status = allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

      const grn = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        grnNumber: `GRN-${String(grnCount).padStart(4, "0")}`,
        idempotencyKey,
        items: grnItems,
        notes,
        createdAt: new Date().toISOString()
      };
      state.goodsReceipts.push(grn);
      recordAudit(session, "grn.recorded", "GoodsReceipt", grn.id, { grnNumber: grn.grnNumber, poNumber: po.poNumber });
      const result = { grn, purchaseOrder: po };
      state.idempotencyRecords.set(idemKey, result);
      return result;
    });
  }

  // --- CUSTOMERS, QUOTATIONS & SALES ORDERS ---
  async function createCustomer(session, { code, name, phone = "", email = "", taxId = "", creditLimitMinor = 0, paymentTermsDays = 30 }) {
    assertPermission(session, "customers:write");
    if (!code || !name) {
      throw new DomainError("VALIDATION_ERROR", "Customer code and name are required.");
    }
    return withTransaction(async () => {
      const normalizedCode = code.trim().toUpperCase();
      if (state.customers.some((c) => c.tenantId === session.tenantId && c.code === normalizedCode)) {
        throw new DomainError("DUPLICATE_CUSTOMER", `Customer '${normalizedCode}' already exists.`, 409);
      }
      const customer = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        code: normalizedCode,
        name: name.trim(),
        phone,
        email,
        taxId,
        creditLimitMinor: Number(creditLimitMinor),
        paymentTermsDays: Number(paymentTermsDays),
        createdAt: new Date().toISOString()
      };
      state.customers.push(customer);
      recordAudit(session, "customer.created", "Customer", customer.id, { code: customer.code, name: customer.name });
      return customer;
    });
  }

  async function createQuotation(session, { customerId, items }) {
    assertPermission(session, "quotations:write");
    return withTransaction(async () => {
      assertTenantMatch(session, state.customers.find((c) => c.id === customerId), "Customer");
      const count = state.quotations.filter((q) => q.tenantId === session.tenantId).length + 1;
      let subtotalMinor = 0;
      let discountMinor = 0;
      let taxMinor = 0;
      const quoteItems = items.map((it) => {
        const prod = assertTenantMatch(session, state.products.find((p) => p.id === it.productId), "Product");
        const unitPriceMinor = Number(it.unitPriceMinor ?? prod.sellingPriceMinor);
        const lineDisc = Number(it.discountMinor || 0);
        const taxRateBps = Number(it.taxRateBps ?? prod.taxRateBps);
        const calc = calculateLineAmountsMinor({
          quantity: it.quantity,
          unitPriceMinor,
          discountMinor: lineDisc,
          taxRateBps
        });
        subtotalMinor += calc.grossMinor;
        discountMinor += calc.discountMinor;
        taxMinor += calc.taxMinor;
        return {
          id: crypto.randomUUID(),
          productId: prod.id,
          quantity: Number(it.quantity),
          unitPriceMinor,
          discountMinor: lineDisc,
          taxRateBps,
          lineTotalMinor: calc.lineTotalMinor
        };
      });
      const quotation = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        customerId,
        quoteNumber: `QT-${String(count).padStart(4, "0")}`,
        status: "SENT",
        subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor: subtotalMinor - discountMinor + taxMinor,
        items: quoteItems,
        createdAt: new Date().toISOString()
      };
      state.quotations.push(quotation);
      recordAudit(session, "quotation.created", "Quotation", quotation.id, { quoteNumber: quotation.quoteNumber });
      return quotation;
    });
  }

  async function createOrder(session, { customerId, warehouseId, items, quotationId = null, notes = "" }) {
    assertPermission(session, "orders:write");
    return withTransaction(async (tx) => {
      assertTenantMatch(session, state.customers.find((c) => c.id === customerId), "Customer");
      assertTenantMatch(session, state.warehouses.find((w) => w.id === warehouseId), "Warehouse");
      if (!Array.isArray(items) || items.length === 0) {
        throw new DomainError("VALIDATION_ERROR", "Order must contain at least one line item.");
      }

      const count = state.orders.filter((o) => o.tenantId === session.tenantId).length + 1;
      let subtotalMinor = 0;
      let discountMinor = 0;
      let taxMinor = 0;

      const orderItems = items.map((it) => {
        const prod = assertTenantMatch(session, state.products.find((p) => p.id === it.productId), "Product");
        const unitPriceMinor = Number(it.unitPriceMinor ?? prod.sellingPriceMinor);
        const lineDisc = Number(it.discountMinor || 0);
        const taxRateBps = Number(it.taxRateBps ?? prod.taxRateBps);
        const calc = calculateLineAmountsMinor({
          quantity: it.orderedQty ?? it.quantity,
          unitPriceMinor,
          discountMinor: lineDisc,
          taxRateBps
        });
        subtotalMinor += calc.grossMinor;
        discountMinor += calc.discountMinor;
        taxMinor += calc.taxMinor;
        return {
          id: crypto.randomUUID(),
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          orderedQty: Number(it.orderedQty ?? it.quantity),
          dispatchedQty: 0,
          unitPriceMinor,
          discountMinor: lineDisc,
          taxRateBps,
          taxMinor: calc.taxMinor,
          lineTotalMinor: calc.lineTotalMinor
        };
      });

      const order = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        customerId,
        warehouseId,
        orderNumber: `SO-${String(count).padStart(4, "0")}`,
        quotationId,
        status: "DRAFT",
        subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor: subtotalMinor - discountMinor + taxMinor,
        items: orderItems,
        notes,
        createdByUserId: session.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.orders.push(order);
      tx.stageEvent("order.created", session.tenantId, order.id, {
        orderNumber: order.orderNumber,
        status: order.status,
        totalMinor: order.totalMinor
      });
      recordAudit(session, "order.created", "Order", order.id, {
        orderNumber: order.orderNumber,
        totalMinor: order.totalMinor
      });
      return order;
    });
  }

  async function confirmOrder(session, { orderId, idempotencyKey = null }) {
    assertPermission(session, "orders:write");
    if (idempotencyKey) {
      const key = `${session.tenantId}:CONFIRM_ORDER:${idempotencyKey}`;
      if (state.idempotencyRecords.has(key)) return state.idempotencyRecords.get(key);
    }
    return withTransaction(async (tx) => {
      const order = assertTenantMatch(session, state.orders.find((o) => o.id === orderId), "Order");
      if (!VALID_ORDER_TRANSITIONS[order.status]?.includes("CONFIRMED")) {
        throw new DomainError("INVALID_STATUS_TRANSITION", `Cannot transition order from ${order.status} to CONFIRMED.`, 409);
      }

      // Check availability across all items in the order's warehouse
      for (const item of order.items) {
        const bal = getOrCreateBalance(session.tenantId, order.warehouseId, item.productId);
        const available = Number((bal.onHandQty - bal.reservedQty).toFixed(3));
        if (available < item.orderedQty) {
          throw new DomainError(
            "INSUFFICIENT_AVAILABLE_STOCK",
            `Cannot confirm order ${order.orderNumber}: product '${item.sku}' has ${available} available, but ${item.orderedQty} required.`,
            409,
            { productId: item.productId, available, required: item.orderedQty }
          );
        }
      }

      // Reserve stock atomically
      for (const item of order.items) {
        const bal = getOrCreateBalance(session.tenantId, order.warehouseId, item.productId);
        bal.reservedQty = Number((bal.reservedQty + item.orderedQty).toFixed(3));
        bal.version += 1;
        bal.updatedAt = new Date().toISOString();

        state.stockReservations.push({
          id: crypto.randomUUID(),
          tenantId: session.tenantId,
          warehouseId: order.warehouseId,
          productId: item.productId,
          orderId: order.id,
          reservedQty: item.orderedQty,
          fulfilledQty: 0,
          status: "ACTIVE",
          createdAt: new Date().toISOString()
        });

        tx.stageEvent("inventory.updated", session.tenantId, item.productId, {
          warehouseId: order.warehouseId,
          productId: item.productId,
          onHandQty: bal.onHandQty,
          reservedQty: bal.reservedQty,
          availableQty: Number((bal.onHandQty - bal.reservedQty).toFixed(3)),
          movementType: "RESERVATION"
        });
      }

      order.status = "CONFIRMED";
      order.updatedAt = new Date().toISOString();
      tx.stageEvent("order.updated", session.tenantId, order.id, {
        orderNumber: order.orderNumber,
        status: order.status
      });
      recordAudit(session, "order.confirmed", "Order", order.id, { orderNumber: order.orderNumber });
      if (idempotencyKey) {
        state.idempotencyRecords.set(`${session.tenantId}:CONFIRM_ORDER:${idempotencyKey}`, order);
      }
      return order;
    });
  }

  async function cancelOrder(session, { orderId, reason = "Cancelled by user" }) {
    assertPermission(session, "orders:write");
    return withTransaction(async (tx) => {
      const order = assertTenantMatch(session, state.orders.find((o) => o.id === orderId), "Order");
      if (!VALID_ORDER_TRANSITIONS[order.status]?.includes("CANCELLED")) {
        throw new DomainError("INVALID_STATUS_TRANSITION", `Cannot cancel order in status '${order.status}'.`, 409);
      }
      // Release any active reservations
      const activeRes = state.stockReservations.filter(
        (r) => r.tenantId === session.tenantId && r.orderId === order.id && r.status === "ACTIVE"
      );
      for (const res of activeRes) {
        const unfulfilled = Number((res.reservedQty - res.fulfilledQty).toFixed(3));
        if (unfulfilled > 0) {
          const bal = getOrCreateBalance(session.tenantId, res.warehouseId, res.productId);
          bal.reservedQty = Math.max(0, Number((bal.reservedQty - unfulfilled).toFixed(3)));
          bal.version += 1;
        }
        res.status = "RELEASED";
      }
      order.status = "CANCELLED";
      order.updatedAt = new Date().toISOString();
      tx.stageEvent("order.updated", session.tenantId, order.id, {
        orderNumber: order.orderNumber,
        status: order.status
      });
      recordAudit(session, "order.cancelled", "Order", order.id, { orderNumber: order.orderNumber, reason });
      return order;
    });
  }

  // --- PRODUCTION & BILL OF MATERIALS (BOM) ---
  async function createBom(session, {
    finishedProductId,
    code,
    name,
    baseOutputQty = 1,
    estLaborCostMinor = 0,
    estOverheadCostMinor = 0,
    items
  }) {
    assertPermission(session, "production:write");
    return withTransaction(async () => {
      assertTenantMatch(session, state.products.find((p) => p.id === finishedProductId), "Finished Product");
      const bomItems = items.map((it) => {
        const rm = assertTenantMatch(session, state.products.find((p) => p.id === it.rawMaterialId), "Raw Material");
        return {
          id: crypto.randomUUID(),
          rawMaterialId: rm.id,
          sku: rm.sku,
          name: rm.name,
          quantityPerBase: Number(it.quantityPerBase),
          scrapPercent: Number(it.scrapPercent || 0)
        };
      });
      const bom = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        finishedProductId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        baseOutputQty: Number(baseOutputQty),
        estLaborCostMinor: Number(estLaborCostMinor),
        estOverheadCostMinor: Number(estOverheadCostMinor),
        items: bomItems,
        createdAt: new Date().toISOString()
      };
      state.boms.push(bom);
      recordAudit(session, "bom.created", "BillOfMaterials", bom.id, { code: bom.code });
      return bom;
    });
  }

  function calculateBomRequirements(session, bomId, plannedQty) {
    const bom = assertTenantMatch(session, state.boms.find((b) => b.id === bomId), "BillOfMaterials");
    const scale = Number(plannedQty) / bom.baseOutputQty;
    let estMaterialCostMinor = 0;
    const requirements = bom.items.map((item) => {
      const rm = state.products.find((p) => p.id === item.rawMaterialId);
      const scrapFactor = 1 + item.scrapPercent / 100;
      const requiredQty = Number((item.quantityPerBase * scale * scrapFactor).toFixed(3));
      const unitCostMinor = rm ? rm.purchasePriceMinor : 0;
      const lineCostMinor = Number((BigInt(Math.round(requiredQty * 1000)) * BigInt(unitCostMinor)) / 1000n);
      estMaterialCostMinor += lineCostMinor;
      return {
        rawMaterialId: item.rawMaterialId,
        sku: rm?.sku,
        name: rm?.name,
        requiredQty,
        unitCostMinor,
        lineCostMinor
      };
    });
    const estLaborMinor = Math.round(bom.estLaborCostMinor * scale);
    const estOverheadMinor = Math.round(bom.estOverheadCostMinor * scale);
    return {
      requirements,
      estMaterialCostMinor,
      estLaborMinor,
      estOverheadMinor,
      estimatedTotalCostMinor: estMaterialCostMinor + estLaborMinor + estOverheadMinor
    };
  }

  async function createProductionBatch(session, { bomId, warehouseId, plannedQty }) {
    assertPermission(session, "production:write");
    return withTransaction(async () => {
      const bom = assertTenantMatch(session, state.boms.find((b) => b.id === bomId), "BillOfMaterials");
      assertTenantMatch(session, state.warehouses.find((w) => w.id === warehouseId), "Warehouse");
      const calc = calculateBomRequirements(session, bom.id, plannedQty);
      const count = state.productionBatches.filter((b) => b.tenantId === session.tenantId).length + 1;
      const batch = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        bomId: bom.id,
        warehouseId,
        finishedProductId: bom.finishedProductId,
        batchNumber: `PRD-${String(count).padStart(4, "0")}`,
        status: "PLANNED",
        plannedQty: Number(plannedQty),
        actualGoodQty: 0,
        rejectedWastageQty: 0,
        estimatedCostMinor: calc.estimatedTotalCostMinor,
        actualMaterialCostMinor: 0,
        actualLaborCostMinor: 0,
        actualOverheadCostMinor: 0,
        actualTotalCostMinor: 0,
        requirements: calc.requirements,
        consumptions: [],
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString()
      };
      state.productionBatches.push(batch);
      recordAudit(session, "production.planned", "ProductionBatch", batch.id, { batchNumber: batch.batchNumber });
      return batch;
    });
  }

  async function startProductionBatch(session, { batchId }) {
    assertPermission(session, "production:write");
    return withTransaction(async (tx) => {
      const batch = assertTenantMatch(
        session,
        state.productionBatches.find((b) => b.id === batchId),
        "ProductionBatch"
      );
      if (batch.status !== "PLANNED") {
        throw new DomainError("INVALID_BATCH_STATE", `Batch ${batch.batchNumber} cannot be started from status ${batch.status}.`, 409);
      }
      batch.status = "IN_PROGRESS";
      batch.startedAt = new Date().toISOString();
      tx.stageEvent("production.started", session.tenantId, batch.id, {
        batchNumber: batch.batchNumber,
        plannedQty: batch.plannedQty
      });
      recordAudit(session, "production.started", "ProductionBatch", batch.id, { batchNumber: batch.batchNumber });
      return batch;
    });
  }

  async function completeProductionBatch(session, {
    batchId,
    actualGoodQty,
    rejectedWastageQty = 0,
    actualLaborCostMinor = null,
    actualOverheadCostMinor = null,
    actualConsumptions = null
  }) {
    assertPermission(session, "production:write");
    return withTransaction(async (tx) => {
      const batch = assertTenantMatch(
        session,
        state.productionBatches.find((b) => b.id === batchId),
        "ProductionBatch"
      );
      if (batch.status === "COMPLETED") {
        throw new DomainError("BATCH_ALREADY_COMPLETED", `Production batch ${batch.batchNumber} has already been completed.`, 409);
      }
      if (batch.status === "CANCELLED") {
        throw new DomainError("INVALID_BATCH_STATE", `Cannot complete a cancelled production batch.`, 409);
      }

      const bom = state.boms.find((b) => b.id === batch.bomId);
      const calc = calculateBomRequirements(session, bom.id, batch.plannedQty);
      const consumptionLines = actualConsumptions || calc.requirements.map((r) => ({
        rawMaterialId: r.rawMaterialId,
        actualConsumedQty: r.requiredQty
      }));

      // 1. Validate raw material availability and deduct raw materials
      let actualMaterialCostMinor = 0;
      const recordedConsumptions = [];
      for (const line of consumptionLines) {
        const bal = getOrCreateBalance(session.tenantId, batch.warehouseId, line.rawMaterialId);
        const available = Number((bal.onHandQty - bal.reservedQty).toFixed(3));
        const consumed = Number(line.actualConsumedQty);
        if (available < consumed) {
          throw new DomainError(
            "INSUFFICIENT_RAW_MATERIAL",
            `Insufficient raw material (${line.rawMaterialId}) for batch ${batch.batchNumber}: available ${available}, required ${consumed}.`,
            409
          );
        }
        const unitCost = bal.unitCostMinor || state.products.find((p) => p.id === line.rawMaterialId)?.purchasePriceMinor || 0;
        applyStockMovementInternal(tx, session, {
          warehouseId: batch.warehouseId,
          productId: line.rawMaterialId,
          movementType: "PRODUCTION_ISSUE",
          quantityDelta: -consumed,
          unitCostMinor: unitCost,
          referenceType: "PRODUCTION",
          referenceId: batch.id,
          reason: `Raw material consumed in batch ${batch.batchNumber}`
        });
        const totalCostMinor = Number((BigInt(Math.round(consumed * 1000)) * BigInt(unitCost)) / 1000n);
        actualMaterialCostMinor += totalCostMinor;
        recordedConsumptions.push({
          rawMaterialId: line.rawMaterialId,
          actualConsumedQty: consumed,
          unitCostMinor: unitCost,
          totalCostMinor
        });
      }

      // 2. Calculate actual manufacturing cost & unit cost of finished good output
      const laborMinor = actualLaborCostMinor !== null ? Number(actualLaborCostMinor) : calc.estLaborMinor;
      const overheadMinor = actualOverheadCostMinor !== null ? Number(actualOverheadCostMinor) : calc.estOverheadMinor;
      const totalActualCostMinor = actualMaterialCostMinor + laborMinor + overheadMinor;
      const goodQty = Number(actualGoodQty);
      const unitFinishedCostMinor = goodQty > 0
        ? Number((BigInt(totalActualCostMinor) * 1000n) / BigInt(Math.round(goodQty * 1000)))
        : 0;

      // 3. Receive finished good into stock
      if (goodQty > 0) {
        applyStockMovementInternal(tx, session, {
          warehouseId: batch.warehouseId,
          productId: batch.finishedProductId,
          movementType: "PRODUCTION_RECEIPT",
          quantityDelta: goodQty,
          unitCostMinor: unitFinishedCostMinor,
          referenceType: "PRODUCTION",
          referenceId: batch.id,
          reason: `Finished output from batch ${batch.batchNumber}`
        });
      }

      batch.status = "COMPLETED";
      batch.actualGoodQty = goodQty;
      batch.rejectedWastageQty = Number(rejectedWastageQty || 0);
      batch.actualMaterialCostMinor = actualMaterialCostMinor;
      batch.actualLaborCostMinor = laborMinor;
      batch.actualOverheadCostMinor = overheadMinor;
      batch.actualTotalCostMinor = totalActualCostMinor;
      batch.consumptions = recordedConsumptions;
      batch.completedAt = new Date().toISOString();

      tx.stageEvent("production.completed", session.tenantId, batch.id, {
        batchNumber: batch.batchNumber,
        actualGoodQty: batch.actualGoodQty,
        rejectedWastageQty: batch.rejectedWastageQty,
        actualTotalCostMinor: batch.actualTotalCostMinor
      });
      recordAudit(session, "production.completed", "ProductionBatch", batch.id, {
        batchNumber: batch.batchNumber,
        actualGoodQty: batch.actualGoodQty,
        rejectedWastageQty: batch.rejectedWastageQty,
        actualTotalCostMinor: totalActualCostMinor
      });
      return batch;
    });
  }

  // --- DISPATCH & DELIVERY MANAGEMENT ---
  async function createAndExecuteDispatch(session, {
    orderId,
    items,
    vehicleNumber = "",
    driverName = "",
    driverPhone = "",
    notes = ""
  }) {
    assertPermission(session, "dispatch:write");
    return withTransaction(async (tx) => {
      const order = assertTenantMatch(session, state.orders.find((o) => o.id === orderId), "Order");
      if (!["CONFIRMED", "READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED"].includes(order.status)) {
        throw new DomainError("INVALID_ORDER_STATE", `Order ${order.orderNumber} is in status ${order.status} and cannot be dispatched.`, 409);
      }

      const dispatchItems = [];
      for (const line of items) {
        const orderItem = order.items.find((i) => i.productId === line.productId);
        if (!orderItem) {
          throw new DomainError("INVALID_DISPATCH_ITEM", `Product ${line.productId} is not part of order ${order.orderNumber}.`);
        }
        const qty = Number(line.quantity);
        const remainingOrderQty = Number((orderItem.orderedQty - orderItem.dispatchedQty).toFixed(3));
        if (qty <= 0 || qty > remainingOrderQty) {
          throw new DomainError(
            "EXCEEDS_FULFILLABLE_QTY",
            `Dispatch quantity (${qty}) exceeds remaining order quantity (${remainingOrderQty}) for ${orderItem.sku}.`,
            409
          );
        }

        // Release corresponding reservation & deduct physical stock
        const res = state.stockReservations.find(
          (r) => r.tenantId === session.tenantId && r.orderId === order.id && r.productId === line.productId && r.status === "ACTIVE"
        );
        const bal = getOrCreateBalance(session.tenantId, order.warehouseId, line.productId);
        if (res) {
          res.fulfilledQty = Number((res.fulfilledQty + qty).toFixed(3));
          if (res.fulfilledQty >= res.reservedQty) res.status = "FULFILLED";
          bal.reservedQty = Math.max(0, Number((bal.reservedQty - qty).toFixed(3)));
        }

        applyStockMovementInternal(tx, session, {
          warehouseId: order.warehouseId,
          productId: line.productId,
          movementType: "SALES_DISPATCH",
          quantityDelta: -qty,
          referenceType: "DISPATCH",
          referenceId: order.id,
          reason: `Dispatched against order ${order.orderNumber}`
        });

        orderItem.dispatchedQty = Number((orderItem.dispatchedQty + qty).toFixed(3));
        dispatchItems.push({ productId: line.productId, sku: orderItem.sku, quantity: qty });
      }

      const allDispatched = order.items.every((i) => i.dispatchedQty >= i.orderedQty);
      order.status = allDispatched ? "DISPATCHED" : "PARTIALLY_DISPATCHED";
      order.updatedAt = new Date().toISOString();

      const count = state.dispatches.filter((d) => d.tenantId === session.tenantId).length + 1;
      const dispatch = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        orderId: order.id,
        warehouseId: order.warehouseId,
        dispatchNumber: `DSP-${String(count).padStart(4, "0")}`,
        status: "DISPATCHED",
        vehicleNumber,
        driverName,
        driverPhone,
        notes,
        podReference: null,
        items: dispatchItems,
        dispatchedAt: new Date().toISOString(),
        deliveredAt: null,
        createdAt: new Date().toISOString()
      };
      state.dispatches.push(dispatch);

      tx.stageEvent("dispatch.updated", session.tenantId, dispatch.id, {
        dispatchNumber: dispatch.dispatchNumber,
        orderNumber: order.orderNumber,
        status: dispatch.status
      });
      recordAudit(session, "dispatch.executed", "Dispatch", dispatch.id, {
        dispatchNumber: dispatch.dispatchNumber,
        orderNumber: order.orderNumber
      });
      return dispatch;
    });
  }

  async function deliverDispatch(session, { dispatchId, podReference = "POD-SIGNED" }) {
    assertPermission(session, "dispatch:write");
    return withTransaction(async (tx) => {
      const dispatch = assertTenantMatch(
        session,
        state.dispatches.find((d) => d.id === dispatchId),
        "Dispatch"
      );
      dispatch.status = "DELIVERED";
      dispatch.podReference = podReference;
      dispatch.deliveredAt = new Date().toISOString();

      const order = state.orders.find((o) => o.id === dispatch.orderId);
      if (order && order.items.every((i) => i.dispatchedQty >= i.orderedQty)) {
        order.status = "DELIVERED";
        order.updatedAt = new Date().toISOString();
        tx.stageEvent("order.updated", session.tenantId, order.id, {
          orderNumber: order.orderNumber,
          status: order.status
        });
      }
      tx.stageEvent("dispatch.updated", session.tenantId, dispatch.id, {
        dispatchNumber: dispatch.dispatchNumber,
        status: dispatch.status,
        podReference
      });
      recordAudit(session, "dispatch.delivered", "Dispatch", dispatch.id, {
        dispatchNumber: dispatch.dispatchNumber,
        podReference
      });
      return dispatch;
    });
  }

  // --- INVOICES & PAYMENTS (EXACT INTEGER MINOR UNITS) ---
  async function createInvoiceFromOrder(session, { orderId, financialYear = "2026-27", dueDays = 30 }) {
    assertPermission(session, "invoices:write");
    return withTransaction(async () => {
      const order = assertTenantMatch(session, state.orders.find((o) => o.id === orderId), "Order");
      if (["DRAFT", "CANCELLED"].includes(order.status)) {
        throw new DomainError("INELIGIBLE_ORDER", `Cannot issue invoice for order in status '${order.status}'.`, 409);
      }
      const tenant = state.tenants.find((t) => t.id === session.tenantId);
      const fyCount = state.invoices.filter(
        (inv) => inv.tenantId === session.tenantId && inv.financialYear === financialYear
      ).length + 1;
      const invoiceNumber = `INV-${financialYear}-${String(fyCount).padStart(4, "0")}`;

      const dueDate = new Date(Date.now() + dueDays * 86400000).toISOString();
      const invoice = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        customerId: order.customerId,
        orderId: order.id,
        financialYear,
        invoiceNumber,
        status: "ISSUED",
        currencyCode: tenant.currencyCode,
        subtotalMinor: order.subtotalMinor,
        discountMinor: order.discountMinor,
        taxMinor: order.taxMinor,
        totalMinor: order.totalMinor,
        paidMinor: 0,
        balanceDueMinor: order.totalMinor,
        items: structuredClone(order.items),
        issuedAt: new Date().toISOString(),
        dueDate
      };
      state.invoices.push(invoice);
      recordAudit(session, "invoice.issued", "Invoice", invoice.id, {
        invoiceNumber: invoice.invoiceNumber,
        totalMinor: invoice.totalMinor
      });
      return invoice;
    });
  }

  async function recordPayment(session, {
    invoiceId,
    amountMinor,
    method = "BANK_TRANSFER",
    reference,
    idempotencyKey
  }) {
    assertPermission(session, "payments:write");
    if (!idempotencyKey) {
      throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "Payment recording requires an idempotencyKey.");
    }
    const idemKey = `${session.tenantId}:PAYMENT:${idempotencyKey}`;
    if (state.idempotencyRecords.has(idemKey)) {
      return state.idempotencyRecords.get(idemKey);
    }
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new DomainError("INVALID_PAYMENT_AMOUNT", "Payment amountMinor must be a positive integer in minor units.");
    }
    return withTransaction(async (tx) => {
      const invoice = assertTenantMatch(
        session,
        state.invoices.find((i) => i.id === invoiceId),
        "Invoice"
      );
      if (amountMinor > invoice.balanceDueMinor) {
        throw new DomainError(
          "OVERPAYMENT_NOT_ALLOWED",
          `Payment amount (${amountMinor}) exceeds invoice balance due (${invoice.balanceDueMinor}).`,
          409
        );
      }
      const count = state.payments.filter((p) => p.tenantId === session.tenantId).length + 1;
      const payment = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        paymentNumber: `PAY-${String(count).padStart(4, "0")}`,
        amountMinor,
        method,
        reference: reference || `REF-${count}`,
        isReversal: false,
        reversedPaymentId: null,
        idempotencyKey,
        recordedByUserId: session.userId,
        paidAt: new Date().toISOString()
      };
      state.payments.push(payment);

      invoice.paidMinor += amountMinor;
      invoice.balanceDueMinor = invoice.totalMinor - invoice.paidMinor;
      invoice.status = invoice.balanceDueMinor === 0 ? "PAID" : "PARTIALLY_PAID";

      tx.stageEvent("payment.received", session.tenantId, payment.id, {
        paymentNumber: payment.paymentNumber,
        invoiceNumber: invoice.invoiceNumber,
        amountMinor: payment.amountMinor,
        balanceDueMinor: invoice.balanceDueMinor
      });
      recordAudit(session, "payment.recorded", "Payment", payment.id, {
        paymentNumber: payment.paymentNumber,
        invoiceNumber: invoice.invoiceNumber,
        amountMinor
      });

      const result = { payment, invoice };
      state.idempotencyRecords.set(idemKey, result);
      return result;
    });
  }

  async function reversePayment(session, { paymentId, reason }) {
    assertPermission(session, "payments:write");
    if (!reason || String(reason).trim().length < 5) {
      throw new DomainError("REASON_REQUIRED", "Payment reversal requires a mandatory reason.");
    }
    return withTransaction(async () => {
      const orig = assertTenantMatch(session, state.payments.find((p) => p.id === paymentId), "Payment");
      if (orig.isReversal || state.payments.some((p) => p.reversedPaymentId === orig.id)) {
        throw new DomainError("ALREADY_REVERSED", "Payment has already been reversed.", 409);
      }
      const invoice = state.invoices.find((i) => i.id === orig.invoiceId);
      const count = state.payments.filter((p) => p.tenantId === session.tenantId).length + 1;
      const reversal = {
        id: crypto.randomUUID(),
        tenantId: session.tenantId,
        invoiceId: orig.invoiceId,
        customerId: orig.customerId,
        paymentNumber: `REV-${String(count).padStart(4, "0")}`,
        amountMinor: -orig.amountMinor,
        method: orig.method,
        reference: `Reversal of ${orig.paymentNumber}: ${reason}`,
        isReversal: true,
        reversedPaymentId: orig.id,
        idempotencyKey: `rev_${orig.id}`,
        recordedByUserId: session.userId,
        paidAt: new Date().toISOString()
      };
      state.payments.push(reversal);
      invoice.paidMinor -= orig.amountMinor;
      invoice.balanceDueMinor = invoice.totalMinor - invoice.paidMinor;
      invoice.status = invoice.paidMinor > 0 ? "PARTIALLY_PAID" : "ISSUED";
      recordAudit(session, "payment.reversed", "Payment", reversal.id, {
        reversedPaymentId: orig.id,
        amountMinor: reversal.amountMinor,
        reason
      });
      return { reversal, invoice };
    });
  }

  function getCustomerStatement(session, customerId) {
    assertPermission(session, "customers:read");
    const customer = assertTenantMatch(
      session,
      state.customers.find((c) => c.id === customerId),
      "Customer"
    );
    const invoices = state.invoices.filter((i) => i.tenantId === session.tenantId && i.customerId === customer.id);
    const payments = state.payments.filter((p) => p.tenantId === session.tenantId && p.customerId === customer.id);
    const totalInvoicedMinor = invoices.reduce((acc, i) => acc + i.totalMinor, 0);
    const totalPaidMinor = payments.reduce((acc, p) => acc + p.amountMinor, 0);
    const outstandingBalanceMinor = totalInvoicedMinor - totalPaidMinor;
    return {
      customer,
      totalInvoicedMinor,
      totalPaidMinor,
      outstandingBalanceMinor,
      invoices,
      payments
    };
  }

  // --- REAL-TIME WEBSOCKET AUTHORIZATION & SUBSCRIPTION ---
  function authorizeSocketSubscription(session, room, callback) {
    if (!session || !session.tenantId) {
      throw new DomainError("WS_UNAUTHORIZED", "WebSocket connection requires a valid session.", 401);
    }
    const expectedRoom = `tenant:${session.tenantId}`;
    if (room !== expectedRoom) {
      throw new DomainError(
        "WS_FORBIDDEN_ROOM",
        `Cross-tenant WebSocket subscription denied for room '${room}'.`,
        403
      );
    }
    if (!state.wsSubscribers.has(room)) {
      state.wsSubscribers.set(room, new Set());
    }
    state.wsSubscribers.get(room).add(callback);
    return () => state.wsSubscribers.get(room)?.delete(callback);
  }

  // --- BACKGROUND JOBS (BULLMQ RETRY & IDEMPOTENT OVERDUE CHECKS) ---
  async function runOverdueInvoiceSweep(session) {
    assertPermission(session, "invoices:read");
    return withTransaction(async (tx) => {
      const now = Date.now();
      const newlyOverdue = [];
      for (const inv of state.invoices) {
        if (
          inv.tenantId === session.tenantId &&
          inv.balanceDueMinor > 0 &&
          new Date(inv.dueDate).getTime() < now &&
          inv.status !== "OVERDUE"
        ) {
          inv.status = "OVERDUE";
          newlyOverdue.push(inv);
          tx.stageEvent("invoice.overdue", session.tenantId, inv.id, {
            invoiceNumber: inv.invoiceNumber,
            balanceDueMinor: inv.balanceDueMinor
          });
          createNotification(tx, {
            tenantId: session.tenantId,
            type: "INVOICE_OVERDUE",
            title: `Overdue Invoice: ${inv.invoiceNumber}`,
            message: `Invoice ${inv.invoiceNumber} is past due with outstanding balance.`,
            entityType: "Invoice",
            entityId: inv.id,
            dedupeKey: `overdue_invoice:${inv.id}`
          });
        }
      }
      return newlyOverdue;
    });
  }

  async function processBackgroundJobWithRetry(jobFn, { maxAttempts = 3, baseDelayMs = 10 } = {}) {
    let attempt = 0;
    let lastError = null;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const result = await jobFn(attempt);
        return { status: "COMPLETED", attempts: attempt, result };
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
        }
      }
    }
    return { status: "FAILED", attempts: attempt, error: lastError?.message || "Job failed" };
  }

  // --- DASHBOARD SUMMARY ---
  function getDashboardSummary(session, { warehouseId = null } = {}) {
    assertPermission(session, "dashboard:view");
    const tenantId = session.tenantId;
    const balances = getInventoryBalances(session, { warehouseId });
    const inventoryValueMinor = balances.reduce((acc, b) => acc + b.valuationMinor, 0);
    const lowStockProducts = balances.filter((b) => b.isLowStock);

    const orders = state.orders.filter(
      (o) => o.tenantId === tenantId && (!warehouseId || o.warehouseId === warehouseId)
    );
    const todaysSalesMinor = orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((acc, o) => acc + o.totalMinor, 0);
    const pendingOrdersCount = orders.filter((o) =>
      ["DRAFT", "QUOTED", "CONFIRMED", "AWAITING_STOCK", "IN_PRODUCTION", "READY_FOR_DISPATCH"].includes(o.status)
    ).length;

    const batches = state.productionBatches.filter(
      (b) => b.tenantId === tenantId && (!warehouseId || b.warehouseId === warehouseId)
    );
    const productionOutputQty = batches
      .filter((b) => b.status === "COMPLETED")
      .reduce((acc, b) => acc + b.actualGoodQty, 0);

    const invoices = state.invoices.filter((i) => i.tenantId === tenantId);
    const outstandingReceivablesMinor = invoices.reduce((acc, i) => acc + i.balanceDueMinor, 0);
    const overdueInvoicesCount = invoices.filter((i) => i.status === "OVERDUE" || (i.balanceDueMinor > 0 && new Date(i.dueDate).getTime() < Date.now())).length;

    return {
      todaysSalesMinor,
      totalOrdersCount: orders.length,
      pendingOrdersCount,
      inventoryValueMinor,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      awaitingProductionCount: batches.filter((b) => b.status === "PLANNED" || b.status === "IN_PROGRESS").length,
      productionOutputQty,
      awaitingDispatchCount: orders.filter((o) => ["CONFIRMED", "READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED"].includes(o.status)).length,
      outstandingReceivablesMinor,
      overdueInvoicesCount,
      recentActivity: state.auditLogs.filter((a) => a.tenantId === tenantId).slice(-10).reverse()
    };
  }

  return {
    state,
    registerTenantAndOwner,
    login,
    logout,
    createWarehouse,
    createProduct,
    recordStockReceipt,
    recordStockAdjustment,
    transferStock,
    editStockMovement,
    reverseStockMovement,
    getInventoryBalances,
    createSupplier,
    createPurchaseOrder,
    receiveGoods,
    createCustomer,
    createQuotation,
    createOrder,
    confirmOrder,
    cancelOrder,
    createBom,
    calculateBomRequirements,
    createProductionBatch,
    startProductionBatch,
    completeProductionBatch,
    createAndExecuteDispatch,
    deliverDispatch,
    createInvoiceFromOrder,
    recordPayment,
    reversePayment,
    getCustomerStatement,
    authorizeSocketSubscription,
    runOverdueInvoiceSweep,
    processBackgroundJobWithRetry,
    getDashboardSummary
  };
}
