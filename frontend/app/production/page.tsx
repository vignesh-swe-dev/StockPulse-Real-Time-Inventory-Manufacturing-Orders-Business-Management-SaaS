"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { useRealtimeSocket } from "../../hooks/useRealtimeSocket";
import { apiClient } from "../../lib/api";
import { BillOfMaterials, ProductionBatch, Warehouse, Product } from "../../types/domain";
import { DataTable, Column } from "../../components/DataTable";
import { formatPaiseToInr, formatQuantity, formatDateIndian } from "../../lib/currency";

export default function ProductionPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"batches" | "boms">("batches");
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // BOM Calculator State
  const [calcBomId, setCalcBomId] = useState("");
  const [calcQty, setCalcQty] = useState("100");
  const [calcResult, setCalcResult] = useState<any | null>(null);

  // Modals
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [fBomId, setFBomId] = useState("");
  const [fWarehouseId, setFWarehouseId] = useState("");
  const [fPlannedQty, setFPlannedQty] = useState("100");

  const [completingBatch, setCompletingBatch] = useState<ProductionBatch[] | null>(null);
  const [selectedBatchForCompletion, setSelectedBatchForCompletion] = useState<ProductionBatch | null>(null);
  const [actualGoodQty, setActualGoodQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [batchList, bomList, whList, prodList] = await Promise.all([
        apiClient<ProductionBatch[]>("/production/batches"),
        apiClient<BillOfMaterials[]>("/production/boms"),
        apiClient<Warehouse[]>("/warehouses"),
        apiClient<Product[]>("/products")
      ]);

      setBatches(batchList);
      setBoms(bomList);
      setWarehouses(whList);
      setProducts(prodList);

      if (bomList.length > 0 && !fBomId) {
        setFBomId(bomList[0].id);
        setCalcBomId(bomList[0].id);
      }
      if (whList.length > 0 && !fWarehouseId) {
        setFWarehouseId(whList[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load production data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeSocket((event) => {
    if (["production.started", "production.completed"].includes(event.eventType)) {
      fetchData();
    }
  });

  const handleCalculateBom = async () => {
    if (!calcBomId) return;
    try {
      const res = await apiClient<any>(`/production/boms/${calcBomId}/calculate?plannedQty=${calcQty}`);
      setCalcResult(res);
    } catch (err: any) {
      setError(err.message || "Calculation failed.");
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      setIsSubmitting(true);
      await apiClient<ProductionBatch>("/production/batches", {
        method: "POST",
        body: JSON.stringify({
          bomId: fBomId,
          warehouseId: fWarehouseId,
          plannedQty: Number(fPlannedQty)
        })
      });
      setIsBatchModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to schedule batch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartBatch = async (batchId: string) => {
    try {
      await apiClient(`/production/batches/${batchId}/start`, { method: "POST" });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to start batch.");
    }
  };

  const handleCompleteBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForCompletion) return;
    try {
      setIsSubmitting(true);
      await apiClient(`/production/batches/${selectedBatchForCompletion.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          actualGoodQty: Number(actualGoodQty),
          rejectedWastageQty: Number(rejectedQty) || 0
        })
      });
      setSelectedBatchForCompletion(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to complete batch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const batchColumns: Column<ProductionBatch>[] = [
    {
      key: "batchNumber",
      header: "Batch #",
      render: (b) => <span style={{ fontWeight: 700 }}>{b.batchNumber}</span>
    },
    {
      key: "finishedProductName",
      header: "Product / Recipe",
      render: (b) => (
        <div>
          <div style={{ fontWeight: 600 }}>{b.finishedProductName}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.bomCode}</div>
        </div>
      )
    },
    {
      key: "warehouseCode",
      header: "Hub",
      render: (b) => <span>{b.warehouseCode}</span>
    },
    {
      key: "status",
      header: "Status",
      render: (b) => {
        let bg = "var(--bg-subtle)";
        let color = "var(--text-secondary)";
        if (b.status === "COMPLETED") {
          bg = "var(--color-success-bg)";
          color = "var(--color-success-text)";
        } else if (b.status === "IN_PROGRESS") {
          bg = "var(--color-warning-bg)";
          color = "var(--color-warning-text)";
        }
        return (
          <span style={{ padding: "2px 8px", borderRadius: "var(--radius-full)", fontSize: 11, fontWeight: 700, backgroundColor: bg, color }}>
            {b.status}
          </span>
        );
      }
    },
    {
      key: "plannedQty",
      header: "Planned Qty",
      isNumeric: true,
      render: (b) => formatQuantity(b.plannedQty, b.uom)
    },
    {
      key: "actualGoodQty",
      header: "Good Yield",
      isNumeric: true,
      render: (b) => (
        <span style={{ fontWeight: 700, color: b.actualGoodQty > 0 ? "var(--color-success-text)" : "var(--text-muted)" }}>
          {b.status === "COMPLETED" ? formatQuantity(b.actualGoodQty, b.uom) : "—"}
        </span>
      )
    },
    {
      key: "actualTotalCostMinor",
      header: "Total Cost",
      isNumeric: true,
      render: (b) => formatPaiseToInr(b.status === "COMPLETED" ? b.actualTotalCostMinor : b.estimatedCostMinor)
    },
    {
      key: "actions",
      header: "Action",
      align: "center",
      render: (b) => {
        if (!hasPermission("production:write")) return null;
        if (b.status === "PLANNED") {
          return (
            <button
              onClick={() => handleStartBatch(b.id)}
              style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-brand)", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              Start Batch
            </button>
          );
        }
        if (b.status === "IN_PROGRESS") {
          return (
            <button
              onClick={() => {
                setSelectedBatchForCompletion(b);
                setActualGoodQty(String(b.plannedQty));
                setRejectedQty("0");
              }}
              style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-success)", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              Complete & Yield
            </button>
          );
        }
        return <span style={{ fontSize: 12, color: "var(--color-success-text)", fontWeight: 600 }}>Done</span>;
      }
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner */}
      <div className="page-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Manufacturing & Bill of Materials</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Recipes, material requirements calculation, batch execution, and manufacturing cost variance.
          </p>
        </div>

        {hasPermission("production:write") && (
          <button
            onClick={() => setIsBatchModalOpen(true)}
            style={{
              padding: "9px 18px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-brand)",
              color: "#ffffff",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            + Schedule Production Batch
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: 14, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger-border)" }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
        <button
          onClick={() => setActiveTab("batches")}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            backgroundColor: activeTab === "batches" ? "var(--color-brand)" : "var(--bg-subtle)",
            color: activeTab === "batches" ? "#ffffff" : "var(--text-secondary)",
            cursor: "pointer"
          }}
        >
          Production Batches ({batches.length})
        </button>
        <button
          onClick={() => setActiveTab("boms")}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            backgroundColor: activeTab === "boms" ? "var(--color-brand)" : "var(--bg-subtle)",
            color: activeTab === "boms" ? "#ffffff" : "var(--text-secondary)",
            cursor: "pointer"
          }}
        >
          Bills of Materials ({boms.length})
        </button>
      </div>

      {/* BOM Requirement Estimator Box */}
      <div
        style={{
          padding: 18,
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Interactive BOM Material Requirement Calculator</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select
            value={calcBomId}
            onChange={(e) => setCalcBomId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13 }}
          >
            {boms.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name} ({b.finishedProductName})
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={calcQty}
            onChange={(e) => setCalcQty(e.target.value)}
            placeholder="Planned units"
            style={{ width: 130, padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13 }}
          />
          <button
            onClick={handleCalculateBom}
            style={{ padding: "8px 16px", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border-default)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Compute Requirements
          </button>
        </div>

        {calcResult && (
          <div style={{ marginTop: 8, padding: 12, backgroundColor: "var(--bg-subtle)", borderRadius: "var(--radius-md)", fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Estimated Total Manufacturing Cost: <span style={{ color: "var(--color-brand)" }}>{formatPaiseToInr(calcResult.estimatedTotalCostMinor)}</span>
              {" "}(Materials: {formatPaiseToInr(calcResult.estMaterialCostMinor)} + Labor: {formatPaiseToInr(calcResult.estLaborMinor)})
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {calcResult.requirements?.map((r: any, idx: number) => (
                <div key={idx} style={{ padding: "6px 10px", backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  <strong>{r.sku || r.name}:</strong> {r.requiredQty} units ({formatPaiseToInr(r.lineCostMinor)})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      {activeTab === "batches" ? (
        <DataTable
          columns={batchColumns}
          data={batches}
          keyField="id"
          searchPlaceholder="Search batches by number or finished product..."
          exportFilename="stockpulse_production_batches.csv"
          isLoading={isLoading}
          emptyTitle="No production batches"
          emptyDescription="Schedule a production batch to convert raw materials into finished goods."
        />
      ) : (
        <DataTable
          columns={[
            { key: "code", header: "BOM Code", render: (b) => <span style={{ fontWeight: 700 }}>{b.code}</span> },
            { key: "name", header: "Recipe Name", render: (b) => <span style={{ fontWeight: 600 }}>{b.name}</span> },
            { key: "finishedProductName", header: "Output Good", render: (b) => b.finishedProductName },
            { key: "baseOutputQty", header: "Base Batch Qty", isNumeric: true, render: (b) => `${b.baseOutputQty} ${b.uom}` },
            { key: "estLaborCostMinor", header: "Base Labor", isNumeric: true, render: (b) => formatPaiseToInr(b.estLaborCostMinor) },
            { key: "estOverheadCostMinor", header: "Base Overhead", isNumeric: true, render: (b) => formatPaiseToInr(b.estOverheadCostMinor) }
          ]}
          data={boms}
          keyField="id"
          searchPlaceholder="Search BOMs..."
          exportFilename="stockpulse_boms.csv"
          isLoading={isLoading}
          emptyTitle="No BOM recipes created"
          emptyDescription="Create standard mixing recipes and bills of materials."
        />
      )}

      {/* Complete Batch Modal */}
      {selectedBatchForCompletion && (
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
          onClick={() => setSelectedBatchForCompletion(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
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
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Complete Batch {selectedBatchForCompletion.batchNumber}</h3>
              <button onClick={() => setSelectedBatchForCompletion(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ padding: "8px 12px", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCompleteBatchSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: 12, backgroundColor: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
                <div>Output Product: <strong>{selectedBatchForCompletion.finishedProductName}</strong></div>
                <div>Planned Quantity: <strong>{selectedBatchForCompletion.plannedQty} {selectedBatchForCompletion.uom}</strong></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Actual Good Output *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={actualGoodQty}
                    onChange={(e) => setActualGoodQty(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Rejected / Scrap Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={rejectedQty}
                    onChange={(e) => setRejectedQty(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setSelectedBatchForCompletion(null)}
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
                    backgroundColor: "var(--color-success)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting ? "Yielding..." : "Complete & Receive Goods"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Batch Modal */}
      {isBatchModalOpen && (
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
          onClick={() => setIsBatchModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
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
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Schedule Production Batch</h3>
              <button onClick={() => setIsBatchModalOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBatch} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  BOM Recipe *
                </label>
                <select
                  value={fBomId}
                  onChange={(e) => setFBomId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                >
                  {boms.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name} ({b.finishedProductName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Manufacturing Hub *
                </label>
                <select
                  value={fWarehouseId}
                  onChange={(e) => setFWarehouseId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Planned Output Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={fPlannedQty}
                  onChange={(e) => setFPlannedQty(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
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
                    backgroundColor: "var(--color-brand)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting ? "Scheduling..." : "Create Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
