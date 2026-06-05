"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../lib/api";
import { DataTable, Column } from "../../components/DataTable";
import { formatPaiseToInr, formatQuantity } from "../../lib/currency";

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<"valuation" | "ageing" | "sales" | "gst">("valuation");
  const [reportData, setReportData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (reportType: string) => {
    try {
      setIsLoading(true);
      setError(null);
      let endpoint = "/reports/inventory-valuation";
      if (reportType === "ageing") endpoint = "/reports/stock-ageing";
      if (reportType === "sales") endpoint = "/reports/sales-summary";
      if (reportType === "gst") endpoint = "/reports/gst-summary";

      const data = await apiClient<any>(endpoint);
      setReportData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load report.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activeReport);
  }, [activeReport]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner */}
      <div className="page-hero">
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Financial & Operational Reports</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Executive reports for inventory valuation, stock ageing buckets, customer turnover, and GST tax filings.
        </p>
      </div>

      {error && (
        <div style={{ padding: 14, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger-border)" }}>
          {error}
        </div>
      )}

      {/* Report Selector Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12, flexWrap: "wrap" }}>
        {[
          { id: "valuation", label: "Inventory Valuation", title: "Asset Valuation" },
          { id: "ageing", label: "⏳ Stock Ageing", title: "Inventory Ageing" },
          { id: "sales", label: "Sales & Revenue", title: "Sales Analysis" },
          { id: "gst", label: "GST Tax Summary", title: "Tax Filing Summary" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: activeReport === tab.id ? "var(--color-brand)" : "var(--bg-subtle)",
              color: activeReport === tab.id ? "#ffffff" : "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REPORT 1: Inventory Valuation */}
      {activeReport === "valuation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div style={{ padding: 16, backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Total Inventory Asset Valuation</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: "var(--color-brand)", marginTop: 4 }}>
                {formatPaiseToInr(reportData?.totalValuationMinor)}
              </div>
            </div>
            <div style={{ padding: 16, backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Total Tracked Balances</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {reportData?.itemCount ?? 0} SKUs
              </div>
            </div>
          </div>

          <DataTable<any>
            columns={[
              { key: "sku", header: "SKU", render: (r) => <span style={{ fontWeight: 700 }}>{r.sku}</span> },
              { key: "productName", header: "Product Name" },
              { key: "warehouseCode", header: "Hub", render: (r) => r.warehouseCode },
              { key: "onHandQty", header: "On-Hand Qty", isNumeric: true, render: (r) => formatQuantity(r.onHandQty, r.uom) },
              { key: "unitCostMinor", header: "Unit Cost (₹)", isNumeric: true, render: (r) => formatPaiseToInr(r.unitCostMinor) },
              { key: "valuationMinor", header: "Asset Valuation", isNumeric: true, render: (r) => <span style={{ fontWeight: 700 }}>{formatPaiseToInr(r.valuationMinor)}</span> }
            ]}
            data={reportData?.items || []}
            keyField="id"
            searchPlaceholder="Search valuation records..."
            exportFilename="inventory_valuation_report.csv"
            isLoading={isLoading}
          />
        </div>
      )}

      {/* REPORT 2: Stock Ageing */}
      {activeReport === "ageing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {["0-30 days", "31-60 days", "61-90 days", ">90 days"].map((bucket) => (
              <div key={bucket} style={{ padding: 16, backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{bucket} Valuation</div>
                <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                  {formatPaiseToInr(reportData?.summaryByBucket?.[bucket])}
                </div>
              </div>
            ))}
          </div>

          <DataTable<any>
            columns={[
              { key: "sku", header: "SKU", render: (r) => <span style={{ fontWeight: 700 }}>{r.sku}</span> },
              { key: "productName", header: "Product Name" },
              { key: "warehouseCode", header: "Warehouse" },
              { key: "ageDays", header: "Estimated Age", isNumeric: true, render: (r) => `${r.ageDays} days` },
              {
                key: "bucket",
                header: "Ageing Category",
                render: (r) => {
                  const isOld = r.bucket === ">90 days";
                  return (
                    <span style={{ padding: "2px 8px", borderRadius: "var(--radius-full)", fontSize: 11, fontWeight: 700, backgroundColor: isOld ? "var(--color-danger-bg)" : "var(--color-info-bg)", color: isOld ? "var(--color-danger-text)" : "var(--color-info-text)" }}>
                      {r.bucket}
                    </span>
                  );
                }
              },
              { key: "valuationMinor", header: "Inventory Value", isNumeric: true, render: (r) => formatPaiseToInr(r.valuationMinor) }
            ]}
            data={reportData?.items || []}
            keyField="id"
            searchPlaceholder="Search stock ageing..."
            exportFilename="stock_ageing_report.csv"
            isLoading={isLoading}
          />
        </div>
      )}

      {/* REPORT 3: Sales Summary */}
      {activeReport === "sales" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div style={{ padding: 16, backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Total Net Sales Revenue</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: "var(--color-brand)", marginTop: 4 }}>
                {formatPaiseToInr(reportData?.totalSalesMinor)}
              </div>
            </div>
            <div style={{ padding: 16, backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Total GST Tax Collected</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {formatPaiseToInr(reportData?.totalTaxMinor)}
              </div>
            </div>
          </div>

          <DataTable<any>
            columns={[
              { key: "customerName", header: "Client / Customer", render: (r) => <span style={{ fontWeight: 700 }}>{r.customerName}</span> },
              { key: "orderCount", header: "Orders Placed", isNumeric: true, render: (r) => r.orderCount },
              { key: "totalSalesMinor", header: "Total Turnover (₹)", isNumeric: true, render: (r) => <span style={{ fontWeight: 700 }}>{formatPaiseToInr(r.totalSalesMinor)}</span> }
            ]}
            data={reportData?.byCustomer || []}
            keyField="customerName"
            searchPlaceholder="Search revenue by customer..."
            exportFilename="sales_by_customer_report.csv"
            isLoading={isLoading}
          />
        </div>
      )}

      {/* REPORT 4: GST Summary */}
      {activeReport === "gst" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ padding: 16, backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Taxable Turnover</div>
              <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                {formatPaiseToInr(reportData?.totalTaxableMinor)}
              </div>
            </div>
            <div style={{ padding: 16, backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Central GST (CGST)</div>
              <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                {formatPaiseToInr(reportData?.totalCgstMinor)}
              </div>
            </div>
            <div style={{ padding: 16, backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>State GST (SGST)</div>
              <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                {formatPaiseToInr(reportData?.totalSgstMinor)}
              </div>
            </div>
            <div style={{ padding: 16, backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Total Invoiced (Gross)</div>
              <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, color: "var(--color-brand)", marginTop: 4 }}>
                {formatPaiseToInr(reportData?.totalInvoiceAmountMinor)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
