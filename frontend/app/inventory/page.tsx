"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { useRealtimeSocket } from "../../hooks/useRealtimeSocket";
import { apiClient } from "../../lib/api";
import { StockBalance, StockMovement, Warehouse, Product } from "../../types/domain";
import { DataTable, Column } from "../../components/DataTable";
import { formatPaiseToInr, formatQuantity, formatDateIndian, parseInrToPaise } from "../../lib/currency";

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"balances" | "movements">("balances");
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals: Receive, Adjust, Transfer, Reverse
  const [modalType, setModalType] = useState<"RECEIVE" | "ADJUST" | "TRANSFER" | "REVERSE" | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);

  // Form fields
  const [fWarehouseId, setFWarehouseId] = useState("");
  const [fToWarehouseId, setFToWarehouseId] = useState("");
  const [fProductId, setFProductId] = useState("");
  const [fQuantity, setFQuantity] = useState("10");
  const [fUnitCost, setFUnitCost] = useState("");
  const [fReason, setFReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const whParam = selectedWarehouseId !== "ALL" ? `?warehouseId=${selectedWarehouseId}` : "";
      const [bData, mData, whList, prodList] = await Promise.all([
        apiClient<StockBalance[]>(`/inventory/balances${whParam}`),
        apiClient<StockMovement[]>(`/inventory/movements${whParam}`),
        apiClient<Warehouse[]>("/warehouses"),
        apiClient<Product[]>("/products")
      ]);

      setBalances(bData);
      setMovements(mData);
      setWarehouses(whList);
      setProducts(prodList);
      if (whList.length > 0 && !fWarehouseId) {
        setFWarehouseId(whList[0].id);
      }
      if (prodList.length > 0 && !fProductId) {
        setFProductId(prodList[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load inventory data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouseId]);

  useRealtimeSocket((event) => {
    if (["inventory.updated", "inventory.low_stock"].includes(event.eventType)) {
      fetchData();
    }
  });

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      setIsSubmitting(true);
      if (modalType === "RECEIVE") {
        const unitCostMinor = fUnitCost ? parseInrToPaise(fUnitCost) : null;
        await apiClient("/inventory/receipts", {
          method: "POST",
          body: JSON.stringify({
            warehouseId: fWarehouseId,
            productId: fProductId,
            quantity: Number(fQuantity),
            unitCostMinor,
            reason: fReason.trim() || "Manual direct stock receipt"
          })
        });
      } else if (modalType === "ADJUST") {
        if (!fReason || fReason.trim().length < 5) {
          throw new Error("Audit reason must be at least 5 characters.");
        }
        await apiClient("/inventory/adjustments", {
          method: "POST",
          body: JSON.stringify({
            warehouseId: fWarehouseId,
            productId: fProductId,
            quantityDelta: Number(fQuantity),
            reason: fReason.trim()
          })
        });
      } else if (modalType === "TRANSFER") {
        if (fWarehouseId === fToWarehouseId) {
          throw new Error("Destination warehouse must be different from source warehouse.");
        }
        await apiClient("/inventory/transfers", {
          method: "POST",
          body: JSON.stringify({
            fromWarehouseId: fWarehouseId,
            toWarehouseId: fToWarehouseId,
            productId: fProductId,
            quantity: Number(fQuantity),
            reason: fReason.trim() || "Inter-warehouse stock transfer"
          })
        });
      } else if (modalType === "REVERSE" && selectedMovement) {
        if (!fReason || fReason.trim().length < 5) {
          throw new Error("Reversal reason must be at least 5 characters.");
        }
        await apiClient("/inventory/reversals", {
          method: "POST",
          body: JSON.stringify({
            movementId: selectedMovement.id,
            reason: fReason.trim()
          })
        });
      }

      setModalType(null);
      setSelectedMovement(null);
      setFReason("");
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Operation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const balanceColumns: Column<StockBalance>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (b) => <span style={{ fontWeight: 700 }}>{b.sku}</span>
    },
    {
      key: "productName",
      header: "Product Name",
      render: (b) => (
        <div>
          <div style={{ fontWeight: 600 }}>{b.productName}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.warehouseCode}</div>
        </div>
      )
    },
    {
      key: "onHandQty",
      header: "On-Hand",
      isNumeric: true,
      render: (b) => formatQuantity(b.onHandQty, b.uom)
    },
    {
      key: "reservedQty",
      header: "Reserved",
      isNumeric: true,
      render: (b) => (
        <span style={{ color: b.reservedQty > 0 ? "var(--color-warning)" : "var(--text-muted)", fontWeight: 600 }}>
          {formatQuantity(b.reservedQty, b.uom)}
        </span>
      )
    },
    {
      key: "availableQty",
      header: "Available (Unreserved)",
      isNumeric: true,
      render: (b) => {
        const isLow = b.isLowStock;
        return (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              fontWeight: 700,
              backgroundColor: isLow ? "var(--color-warning-bg)" : "var(--color-success-bg)",
              color: isLow ? "var(--color-warning-text)" : "var(--color-success-text)"
            }}
          >
            {formatQuantity(b.availableQty, b.uom)}
          </span>
        );
      }
    },
    {
      key: "unitCostMinor",
      header: "Unit Cost",
      isNumeric: true,
      render: (b) => formatPaiseToInr(b.unitCostMinor)
    },
    {
      key: "valuationMinor",
      header: "Valuation",
      isNumeric: true,
      render: (b) => (
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatPaiseToInr(b.valuationMinor)}</span>
      )
    }
  ];

  const movementColumns: Column<StockMovement>[] = [
    {
      key: "createdAt",
      header: "Timestamp",
      render: (m) => formatDateIndian(m.createdAt, { includeTime: true })
    },
    {
      key: "movementType",
      header: "Type",
      render: (m) => {
        const isPositive = m.quantityDelta > 0;
        const isReversal = m.movementType === "REVERSAL";
        return (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: isReversal ? "var(--color-danger-bg)" : isPositive ? "var(--color-success-bg)" : "var(--bg-subtle)",
              color: isReversal ? "var(--color-danger-text)" : isPositive ? "var(--color-success-text)" : "var(--text-secondary)"
            }}
          >
            {m.movementType}
          </span>
        );
      }
    },
    {
      key: "sku",
      header: "SKU / Product",
      render: (m) => (
        <div>
          <div style={{ fontWeight: 700 }}>{m.sku}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.productName}</div>
        </div>
      )
    },
    {
      key: "warehouseCode",
      header: "Warehouse",
      render: (m) => <span style={{ fontWeight: 600 }}>{m.warehouseCode}</span>
    },
    {
      key: "quantityDelta",
      header: "Quantity Delta",
      isNumeric: true,
      render: (m) => {
        const isPos = m.quantityDelta > 0;
        return (
          <span
            style={{
              fontWeight: 700,
              color: isPos ? "var(--color-success-text)" : "var(--color-danger-text)"
            }}
          >
            {isPos ? `+${m.quantityDelta}` : m.quantityDelta} {m.uom}
          </span>
        );
      }
    },
    {
      key: "balanceAfter",
      header: "Balance After",
      isNumeric: true,
      render: (m) => `${m.balanceAfter} ${m.uom}`
    },
    {
      key: "reason",
      header: "Audit Reason",
      render: (m) => <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.reason}</span>
    },
    {
      key: "actions",
      header: "Action",
      align: "center",
      render: (m) => {
        if (!hasPermission("inventory:write") || m.movementType === "REVERSAL") return null;
        return (
          <button
            onClick={() => {
              setSelectedMovement(m);
              setFReason(`Correction of erroneous entry on ${m.sku}`);
              setModalType("REVERSE");
            }}
            style={{
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--color-danger)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Reverse
          </button>
        );
      }
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner & Invariant Formula */}
      <div className="page-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Stock Ledger & Warehouse Balances</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Immutable Ledger Invariant:</span>
            <code
              style={{
                backgroundColor: "var(--color-brand-subtle)",
                color: "var(--color-brand-text)",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 700,
                fontSize: 12
              }}
            >
              Available = On-Hand − Reserved
            </code>
          </div>
        </div>

        {/* Action Buttons */}
        {hasPermission("inventory:write") && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setModalType("RECEIVE");
                setFReason("Manual warehouse stock receipt");
              }}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-brand)",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)"
              }}
            >
              Receive Stock
            </button>
            <button
              onClick={() => {
                setModalType("ADJUST");
                setFReason("");
              }}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              Stock Adjustment
            </button>
            <button
              onClick={() => {
                setModalType("TRANSFER");
                setFReason("Inter-warehouse transfer");
              }}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              Transfer
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: 14, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger-border)" }}>
          {error}
        </div>
      )}

      {/* Tabs & Warehouse Filter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setActiveTab("balances")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: activeTab === "balances" ? "var(--color-brand)" : "var(--bg-subtle)",
              color: activeTab === "balances" ? "#ffffff" : "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            Warehouse Balances ({balances.length})
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: activeTab === "movements" ? "var(--color-brand)" : "var(--bg-subtle)",
              color: activeTab === "movements" ? "#ffffff" : "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            Movement Ledger ({movements.length})
          </button>
        </div>

        {/* Warehouse Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Warehouse:</span>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 600
            }}
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table View */}
      {activeTab === "balances" ? (
        <DataTable
          columns={balanceColumns}
          data={balances}
          keyField="id"
          searchPlaceholder="Search balances by SKU or product name..."
          exportFilename="stockpulse_inventory_balances.csv"
          isLoading={isLoading}
          emptyTitle="No inventory balances"
          emptyDescription="Receive opening stock to populate your warehouse ledger."
        />
      ) : (
        <DataTable
          columns={movementColumns}
          data={movements}
          keyField="id"
          searchPlaceholder="Search movements by SKU or audit reason..."
          exportFilename="stockpulse_stock_movements.csv"
          isLoading={isLoading}
          emptyTitle="No stock movements recorded"
          emptyDescription="All stock transactions and reversals are logged immutably here."
        />
      )}

      {/* Modal Dialog for Inventory Operations */}
      {modalType && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
          onClick={() => setModalType(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              backgroundColor: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: 16
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                {modalType === "RECEIVE" && "Record Physical Stock Receipt"}
                {modalType === "ADJUST" && "Record Stock Count Adjustment"}
                {modalType === "TRANSFER" && "Inter-Warehouse Stock Transfer"}
                {modalType === "REVERSE" && `Reverse Movement ${selectedMovement?.id?.slice(0, 8)}...`}
              </h3>
              <button onClick={() => setModalType(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ padding: "8px 12px", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleModalSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {modalType !== "REVERSE" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                        {modalType === "TRANSFER" ? "Source Warehouse *" : "Warehouse *"}
                      </label>
                      <select
                        value={fWarehouseId}
                        onChange={(e) => setFWarehouseId(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} ({w.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    {modalType === "TRANSFER" ? (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                          Destination Warehouse *
                        </label>
                        <select
                          value={fToWarehouseId}
                          onChange={(e) => setFToWarehouseId(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                        >
                          <option value="">Select destination...</option>
                          {warehouses.filter((w) => w.id !== fWarehouseId).map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.code} ({w.name})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                          Product SKU *
                        </label>
                        <select
                          value={fProductId}
                          onChange={(e) => setFProductId(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} — {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {modalType === "TRANSFER" && (
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                        Product SKU *
                      </label>
                      <select
                        value={fProductId}
                        onChange={(e) => setFProductId(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: modalType === "RECEIVE" ? "1fr 1fr" : "1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                        {modalType === "ADJUST" ? "Quantity Delta (+ or -) *" : "Quantity *"}
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={fQuantity}
                        onChange={(e) => setFQuantity(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                      />
                    </div>
                    {modalType === "RECEIVE" && (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                          Unit Cost (₹ Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Leave blank for master cost"
                          value={fUnitCost}
                          onChange={(e) => setFUnitCost(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {modalType === "REVERSE" && selectedMovement && (
                <div style={{ padding: 12, backgroundColor: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
                  <div><strong>Reversing:</strong> {selectedMovement.movementType} of {selectedMovement.quantityDelta} {selectedMovement.uom}</div>
                  <div style={{ color: "var(--text-muted)", marginTop: 2 }}>Original reason: {selectedMovement.reason}</div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Auditable Reason * {modalType === "ADJUST" || modalType === "REVERSE" ? "(Min 5 chars required)" : ""}
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Mandatory reason for ledger entry..."
                  value={fReason}
                  onChange={(e) => setFReason(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", backgroundColor: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: modalType === "REVERSE" ? "var(--color-danger)" : "var(--color-brand)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting ? "Processing..." : modalType === "REVERSE" ? "Confirm Reversal" : "Record Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
