"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { useRealtimeSocket } from "../hooks/useRealtimeSocket";
import { apiClient } from "../lib/api";
import { Notification, RoleName } from "../types/domain";
import { NotificationDrawer } from "./NotificationDrawer";
import { Logo, LogoMark } from "./Logo";
import { Icon, IconName } from "./Icon";
import { CommandPalette, Command } from "./CommandPalette";

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  requiredPermission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard", requiredPermission: "dashboard:view" },
  { label: "Inventory Ledger", href: "/inventory", icon: "inventory", requiredPermission: "inventory:read" },
  { label: "Products & SKUs", href: "/products", icon: "tag", requiredPermission: "products:read" },
  { label: "Sales Orders", href: "/orders", icon: "orders", requiredPermission: "orders:read" },
  { label: "Manufacturing & BOM", href: "/production", icon: "production", requiredPermission: "production:read" },
  { label: "Dispatches & POD", href: "/dispatch", icon: "truck", requiredPermission: "dispatch:read" },
  { label: "Invoices & Payments", href: "/invoices", icon: "invoice", requiredPermission: "invoices:read" },
  { label: "Suppliers & Purchases", href: "/purchases", icon: "building", requiredPermission: "purchases:read" },
  { label: "Financial Reports", href: "/reports", icon: "chart", requiredPermission: "reports:read" },
  { label: "Setup & Masters", href: "/setup", icon: "building", requiredPermission: "warehouses:read" },
  { label: "Audit & Compliance", href: "/audit", icon: "shield", requiredPermission: "audit:read" }
];

const ALL_ROLES: RoleName[] = [
  "OWNER",
  "ADMINISTRATOR",
  "MANAGER",
  "SALES_STAFF",
  "WAREHOUSE_STAFF",
  "PRODUCTION_STAFF",
  "ACCOUNTANT",
  "VIEWER"
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("sp-collapsed") === "1"); } catch {} }, []);
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem("sp-collapsed", c ? "0" : "1"); } catch {} return !c; });
  const { session, tenant, role, switchRole, hasPermission, logout, isLoading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time SSE integration
  const { status: realtimeStatus, reconnect } = useRealtimeSocket((event) => {
    // Show subtle toast on major events
    if (event.eventType === "inventory.low_stock") {
      setToastMessage(`Low Stock Alert: Product ${event.payload?.sku || ""}`);
    } else if (event.eventType === "order.created") {
      setToastMessage(`New Sales Order: ${event.payload?.orderNumber || ""}`);
    } else if (event.eventType === "payment.received") {
      setToastMessage(`Payment Received: ${event.payload?.paymentNumber || ""}`);
    }

    // Refresh notifications list
    fetchNotifications();
  });

  const fetchNotifications = async () => {
    try {
      const list = await apiClient<Notification[]>("/notifications");
      setNotifications(list);
    } catch {
      // Ignored if offline
    }
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchNotifications();
    }
  }, [session?.accessToken]);

  // Toast timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    try { localStorage.setItem("sp-theme", nextTheme); } catch {}
  };

  // Restore saved theme (falls back to the OS preference)
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("sp-theme"); } catch {}
    const initial = (saved as "light" | "dark" | null) ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  // Material-style click ripple on every button
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement)?.closest?.("button") as HTMLButtonElement | null;
      if (!btn || btn.disabled || btn.getAttribute("aria-label")) return;
      const rect = btn.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "ripple-dot";
      dot.style.left = `${e.clientX - rect.left}px`;
      dot.style.top = `${e.clientY - rect.top}px`;
      if (getComputedStyle(btn).overflow === "visible") btn.style.overflow = "hidden";
      btn.appendChild(dot);
      setTimeout(() => dot.remove(), 700);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  // Close the mobile drawer on navigation
  useEffect(() => setSidebarOpen(false), [pathname]);

  // Signed-out visitors are sent to the login page
  useEffect(() => {
    if (!authLoading && !session && !["/login", "/register", "/welcome"].includes(pathname)) router.replace("/login");
  }, [authLoading, session, pathname, router]);

  // Ctrl/Cmd + K opens quick search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Escape closes the top-most open modal by pressing its close / cancel button
        const overlays = Array.from(document.querySelectorAll<HTMLElement>('div[style*="position: fixed"][style*="inset: 0"]'));
        const top = overlays[overlays.length - 1];
        const closer = top && Array.from(top.querySelectorAll("button")).find((b) => /^(✕|close|cancel)/i.test((b.textContent || "").trim()));
        closer?.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await apiClient(`/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient("/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // The public marketing page renders without the application chrome
  if (["/welcome", "/login", "/register"].includes(pathname)) {
    return <>{children}</>;
  }

  const commands: Command[] = [
    ...NAV_ITEMS.filter((n) => !n.requiredPermission || hasPermission(n.requiredPermission)).map((n) => ({
      id: n.href, label: n.label, hint: "Go to page", icon: n.icon, run: () => router.push(n.href)
    })),
    ...(hasPermission("orders:write") ? [{ id: "a-order", label: "Create new sales order", hint: "Action", icon: "plus" as IconName, run: () => router.push("/orders") }] : []),
    ...(hasPermission("inventory:write") ? [{ id: "a-recv", label: "Receive stock", hint: "Action", icon: "download" as IconName, run: () => router.push("/inventory") }] : []),
    { id: "a-notif", label: "Open notifications", hint: "Action", icon: "bell" as IconName, run: () => setNotificationsOpen(true) },
    { id: "a-theme", label: theme === "light" ? "Switch to dark mode" : "Switch to light mode", hint: "Action", icon: (theme === "light" ? "moon" : "sun") as IconName, run: toggleTheme },
    { id: "a-site", label: "Open marketing website", hint: "Go to page", icon: "globe" as IconName, run: () => router.push("/welcome") },
    { id: "a-out", label: "Sign out", hint: "Action", icon: "lock" as IconName, run: async () => { await logout(); router.push("/login"); } }
  ];

  const now = new Date();
  const fyStart = now.getMonth() + 1 >= (tenant?.financialYearStart || 4) ? now.getFullYear() : now.getFullYear() - 1;
  const fyLabel = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;

  const currentNav = NAV_ITEMS.find((n) => n.href === pathname);
  const initials = (session?.fullName || "SP").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-canvas)" }}>
      {/* Real-time Reconnecting Banner */}
      {realtimeStatus === "disconnected" && (
        <div
          className="reconnecting-banner"
          style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1100 }}
        >
          <span>Real-time connection interrupted. Resyncing live tenant updates...</span>
          <button
            onClick={reconnect}
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(0,0,0,0.15)",
              border: "1px solid rgba(0,0,0,0.25)",
              color: "#000",
              fontWeight: 700,
              fontSize: 11,
              cursor: "pointer"
            }}
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Floating In-App Toast */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1200,
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
            padding: "12px 20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-xl)",
            fontWeight: 600,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "slideInRight 0.25s ease-out"
          }}
        >
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 16
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 900,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)"
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Collapsible Enterprise Sidebar */}
      <aside
        style={{
          width: collapsed ? 84 : 272,
          backgroundColor: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 950,
          flexShrink: 0
        }}
        className={`sp-sidebar${sidebarOpen ? " sidebar-mobile-open" : ""}${collapsed ? " collapsed" : ""}`}
      >
        {/* Brand / Organization Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Link href="/welcome" className="brand-link" style={{ textDecoration: "none", display: "flex", minWidth: 0 }} aria-label="StockPulse home">
            {collapsed ? <LogoMark size={40} /> : <Logo size={40} tagline={tenant?.name || "Your company"} />}
          </Link>
        </div>

        {/* Navigation Links with RBAC Capability Filtering */}
        <nav style={{ flex: 1, padding: "16px 12px 16px 12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isPermitted = !item.requiredPermission || hasPermission(item.requiredPermission);
            if (!isPermitted) return null; // RBAC action & navigation hiding

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                onClick={() => setSidebarOpen(false)}
                className={`nav-link${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--text-secondary)"
                }}
              >
                <Icon name={item.icon} size={19} />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Tenant Information & Plan Tier Badge */}
        <div className="sp-side-footer"
          style={{
            padding: 16,
            borderTop: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-subtle)",
            fontSize: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)" }}>Active Tenant</span>
            <span
              style={{
                backgroundColor: "var(--color-success-bg)",
                color: "var(--color-success-text)",
                padding: "1px 6px",
                borderRadius: "var(--radius-full)",
                fontSize: 10,
                fontWeight: 700
              }}
            >
              {tenant?.taxRegistrationNo ? "GST READY" : "GSTIN PENDING"}
            </span>
          </div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
            {tenant?.taxRegistrationNo || tenant?.name || "Add your GSTIN in Setup"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Financial Year: {fyLabel} (Apr–Mar)
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          className="glass"
          style={{
            height: 68,
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 800,
          }}
        >
          {/* Mobile Menu Hamburger */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="sp-collapse"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{ background: "none", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: 8, display: "inline-flex", color: "var(--text-primary)", backgroundColor: "var(--bg-surface)" }}
            >
              <Icon name="menu" size={20} />
            </button>
            <button
              className="sp-burger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle mobile sidebar"
              style={{
                display: "inline-flex",
                background: "none",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: 8,
                cursor: "pointer",
                color: "var(--text-primary)"
              }}
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="sp-title">
              <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>
                Workspace
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>
                {currentNav?.label ?? "StockPulse"}
              </div>
            </div>
          </div>

          {/* Controls: Role Switcher, Real-time status, Notifications, Theme */}
          <div className="sp-controls" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Quick search */}
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Open quick search"
              className="sp-search"
              style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", fontSize: 13 }}
            >
              <Icon name="search" size={16} /> <span className="sp-search-text">Search</span> <span className="kbd">Ctrl K</span>
            </button>

            {/* Real-time Status Indicator */}
            <div
              className="sp-live"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                fontSize: 12,
                fontWeight: 600,
                backgroundColor:
                  realtimeStatus === "connected"
                    ? "var(--color-success-bg)"
                    : "var(--color-warning-bg)",
                color:
                  realtimeStatus === "connected"
                    ? "var(--color-success-text)"
                    : "var(--color-warning-text)"
              }}
            >
              <span
                className={realtimeStatus === "connected" ? "live-dot" : undefined}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor:
                    realtimeStatus === "connected"
                      ? "var(--color-success)"
                      : "var(--color-warning)",
                  display: "inline-block"
                }}
              />
              <span>{realtimeStatus === "connected" ? "Live Sync" : "Reconnecting"}</span>
            </div>

            {/* Role Preview Switcher (Allows testing all 8 roles) */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="sp-role-label" style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Role:</span>
              <select
                value={role}
                onChange={(e) => switchRole(e.target.value as RoleName)}
                style={{
                  padding: "5px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Notification Drawer Trigger */}
            <button
              onClick={() => setNotificationsOpen(true)}
              aria-label="Open notifications"
              style={{
                position: "relative",
                background: "none",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "8px 10px",
                display: "inline-flex",
                cursor: "pointer",
                fontSize: 16,
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)"
              }}
            >
              <Icon name="bell" size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: "var(--color-danger)",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: "var(--radius-full)",
                    padding: "1px 5px",
                    lineHeight: 1
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              style={{
                background: "none",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "8px 10px",
                display: "inline-flex",
                cursor: "pointer",
                fontSize: 14,
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)"
              }}
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={18} />
            </button>

            {/* Signed-in user */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                className="sp-avatar"
                title={session?.fullName || "Demo user"}
                style={{
                  width: 36, height: 36, borderRadius: "50%", background: "var(--gradient-brand)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13
                }}
              >
                {initials}
              </div>
              <button
                onClick={async () => { await logout(); router.push("/login"); }}
                aria-label="Sign out"
                title="Sign out"
                style={{ background: "none", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "8px 10px", display: "inline-flex", color: "var(--text-primary)", backgroundColor: "var(--bg-surface)" }}
              >
                <Icon name="lock" size={17} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="sp-main" style={{ flex: 1, padding: "32px 36px", maxWidth: 1440, width: "100%", margin: "0 auto" }}>
          {authLoading ? (
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18 }}>
              <div style={{ animation: "pulseGlow 1.4s ease-in-out infinite" }}><LogoMark size={64} /></div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>Loading your workspace</div>
            </div>
          ) : (
            <div key={pathname} className="page-enter">
              {children}
            </div>
          )}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
      />
    </div>
  );
}
