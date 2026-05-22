"use client";

import { Icon } from "./Icon";
import React, { useState, useMemo } from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  isNumeric?: boolean;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | ((row: T) => string);
  searchPlaceholder?: string;
  searchFilter?: (row: T, term: string) => boolean;
  exportFilename?: string;
  actions?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  searchPlaceholder = "Search records...",
  searchFilter,
  exportFilename = "stockpulse_export.csv",
  actions,
  emptyTitle = "No records found",
  emptyDescription = "There are no entries matching your current filters.",
  emptyAction,
  isLoading = false
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    if (searchFilter) {
      return data.filter((row) => searchFilter(row, term));
    }
    return data.filter((row) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(term)
      )
    );
  }, [data, searchTerm, searchFilter]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const res = valA < valB ? -1 : 1;
      return sortDirection === "asc" ? res : -res;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortKey(null);
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleExportCsv = () => {
    if (!data.length) return;
    const headers = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
    const rows = sortedData.map((row) =>
      columns
        .map((col) => {
          const val = row[col.key];
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Table Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: 14,
              width: "100%",
              maxWidth: 360
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {actions}
          <button
            onClick={handleExportCsv}
            disabled={!data.length}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: data.length ? "pointer" : "not-allowed",
              opacity: data.length ? 1 : 0.6
            }}
          >
            <span>↓</span> CSV Export
          </button>
        </div>
      </div>

      {/* Table Surface */}
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-sm)"
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
          <thead>
            <tr
              style={{
                backgroundColor: "var(--bg-subtle)",
                borderBottom: "1px solid var(--border-subtle)",
                position: "sticky",
                top: 0,
                zIndex: 10
              }}
            >
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    style={{
                      padding: "12px 16px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      textAlign: col.align || (col.isNumeric ? "right" : "left"),
                      cursor: col.sortable !== false ? "pointer" : "default",
                      userSelect: "none",
                      whiteSpace: "nowrap"
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {col.header}
                      {col.sortable !== false && (
                        <span style={{ fontSize: 10, color: isSorted ? "var(--color-brand)" : "var(--text-muted)" }}>
                          {isSorted ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {columns.map((col, j) => (
                    <td key={j} style={{ padding: "14px 16px" }}>
                      <div className="skeleton" style={{ height: 16, width: col.isNumeric ? "60%" : "80%", marginLeft: col.isNumeric ? "auto" : 0 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 48, textAlign: "center" }}>
                  <div style={{ maxWidth: 360, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--color-brand-subtle)", color: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="search" size={28} /></div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text-primary)" }}>{emptyTitle}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{emptyDescription}</div>
                    {emptyAction && <div style={{ marginTop: 8 }}>{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const key = typeof keyField === "function" ? keyField(row) : String(row[keyField] ?? idx);
                return (
                  <tr
                    key={key}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      transition: "background-color 0.1s ease"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={col.isNumeric ? "tabular-nums" : ""}
                        style={{
                          padding: "12px 16px",
                          color: "var(--text-primary)",
                          textAlign: col.align || (col.isNumeric ? "right" : "left"),
                          whiteSpace: "nowrap"
                        }}
                      >
                        {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && sortedData.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 4px",
            fontSize: 13,
            color: "var(--text-muted)",
            flexWrap: "wrap",
            gap: 12
          }}
        >
          <div>
            Showing <span className="tabular-nums" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{Math.min(sortedData.length, (page - 1) * pageSize + 1)}</span> to{" "}
            <span className="tabular-nums" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{Math.min(sortedData.length, page * pageSize)}</span> of{" "}
            <span className="tabular-nums" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{sortedData.length}</span> entries
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: 13
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-surface)",
                  color: page <= 1 ? "var(--text-muted)" : "var(--text-primary)",
                  cursor: page <= 1 ? "not-allowed" : "pointer"
                }}
              >
                Previous
              </button>
              <span className="tabular-nums" style={{ padding: "0 8px", fontWeight: 600 }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-surface)",
                  color: page >= totalPages ? "var(--text-muted)" : "var(--text-primary)",
                  cursor: page >= totalPages ? "not-allowed" : "pointer"
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
