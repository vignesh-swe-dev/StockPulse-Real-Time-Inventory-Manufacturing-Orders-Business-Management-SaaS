"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { apiClient } from "../../lib/api";
import { Product, ProductType } from "../../types/domain";
import { DataTable, Column } from "../../components/DataTable";
import { formatPaiseToInr, formatBpsToPercent, parseInrToPaise } from "../../lib/currency";

export default function ProductsPage() {
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [formUom, setFormUom] = useState("PCS");
  const [formType, setFormType] = useState<ProductType>("FINISHED_GOOD");
  const [formPurchasePrice, setFormPurchasePrice] = useState("0.00");
  const [formSellingPrice, setFormSellingPrice] = useState("0.00");
  const [formTaxRateBps, setFormTaxRateBps] = useState(1800);
  const [formReorder, setFormReorder] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      setError(null);
      const data = await apiClient<Product[]>("/products");
      setProducts(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch products.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formSku.trim() || !formName.trim()) {
      setFormError("SKU and Product Name are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const purchaseMinor = parseInrToPaise(formPurchasePrice);
      const sellingMinor = parseInrToPaise(formSellingPrice);

      await apiClient<Product>("/products", {
        method: "POST",
        body: JSON.stringify({
          sku: formSku.trim(),
          name: formName.trim(),
          categoryName: formCategory.trim(),
          uom: formUom.trim().toUpperCase(),
          productType: formType,
          purchasePriceMinor: purchaseMinor,
          sellingPriceMinor: sellingMinor,
          taxRateBps: Number(formTaxRateBps),
          reorderThreshold: Number(formReorder) || 0
        })
      });

      setIsModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || "Failed to create product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormSku("");
    setFormName("");
    setFormCategory("General");
    setFormUom("PCS");
    setFormType("FINISHED_GOOD");
    setFormPurchasePrice("0.00");
    setFormSellingPrice("0.00");
    setFormTaxRateBps(1800);
    setFormReorder("0");
    setFormError(null);
  };

  const columns: Column<Product>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (p) => (
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.sku}</span>
      )
    },
    {
      key: "name",
      header: "Product Name",
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600 }}>{p.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.categoryName}</div>
        </div>
      )
    },
    {
      key: "productType",
      header: "Type",
      render: (p) => {
        const isFg = p.productType === "FINISHED_GOOD";
        return (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: isFg ? "var(--color-brand-subtle)" : "var(--bg-subtle)",
              color: isFg ? "var(--color-brand-text)" : "var(--text-secondary)"
            }}
          >
            {p.productType.replace("_", " ")}
          </span>
        );
      }
    },
    {
      key: "uom",
      header: "UOM",
      align: "center",
      render: (p) => <span style={{ fontWeight: 600 }}>{p.uom}</span>
    },
    {
      key: "purchasePriceMinor",
      header: "Purchase Price",
      isNumeric: true,
      render: (p) => formatPaiseToInr(p.purchasePriceMinor)
    },
    {
      key: "sellingPriceMinor",
      header: "Selling Price",
      isNumeric: true,
      render: (p) => formatPaiseToInr(p.sellingPriceMinor)
    },
    {
      key: "taxRateBps",
      header: "GST Rate",
      align: "center",
      render: (p) => formatBpsToPercent(p.taxRateBps)
    },
    {
      key: "reorderThreshold",
      header: "Reorder Min",
      isNumeric: true,
      render: (p) => `${p.reorderThreshold} ${p.uom}`
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner */}
      <div className="page-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Products & Materials Catalog</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Master catalog for finished goods, raw materials, pricing in minor units, and GST tax codes.
          </p>
        </div>

        {hasPermission("products:write") && (
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
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
            + Add Product SKU
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: 14, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger-border)" }}>
          {error}
        </div>
      )}

      {/* Products Table */}
      <DataTable
        columns={columns}
        data={products}
        keyField="id"
        searchPlaceholder="Search by SKU, name, or category..."
        exportFilename="stockpulse_products.csv"
        isLoading={isLoading}
        emptyTitle="No products found"
        emptyDescription="Create your first finished good or raw material SKU to start managing inventory."
        emptyAction={
          hasPermission("products:write") ? (
            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-brand)",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              + Add Product
            </button>
          ) : undefined
        }
      />

      {/* New Product Modal */}
      {isModalOpen && (
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
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
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
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Add New Product SKU</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ padding: "8px 12px", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProduct} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FG-PAVER-80"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 80mm Interlocking Paver Block"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as ProductType)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  >
                    <option value="FINISHED_GOOD">Finished Good</option>
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="TRADED_GOOD">Traded Good</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Category
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    UOM
                  </label>
                  <input
                    type="text"
                    placeholder="PCS, KG, TON"
                    value={formUom}
                    onChange={(e) => setFormUom(e.target.value.toUpperCase())}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Purchase Price (₹)
                  </label>
                  <input
                    type="text"
                    placeholder="22.00"
                    value={formPurchasePrice}
                    onChange={(e) => setFormPurchasePrice(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Selling Price (₹)
                  </label>
                  <input
                    type="text"
                    placeholder="35.00"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    GST Tax Rate
                  </label>
                  <select
                    value={formTaxRateBps}
                    onChange={(e) => setFormTaxRateBps(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={500}>5% GST</option>
                    <option value={1200}>12% GST</option>
                    <option value={1800}>18% GST (Standard)</option>
                    <option value={2800}>28% GST</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Reorder Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 200"
                    value={formReorder}
                    onChange={(e) => setFormReorder(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "transparent",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-secondary)",
                    cursor: "pointer"
                  }}
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
                  {isSubmitting ? "Saving..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
