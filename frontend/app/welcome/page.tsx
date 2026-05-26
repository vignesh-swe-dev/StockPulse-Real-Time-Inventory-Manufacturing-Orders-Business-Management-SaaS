"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "../../components/Logo";
import { Icon, IconName } from "../../components/Icon";

const FEATURES: { icon: IconName; title: string; text: string; tint: string }[] = [
  { icon: "inventory", title: "Real-time inventory", text: "Multi-warehouse stock ledger with weighted-average costing and instant low-stock alerts.", tint: "#0369a1" },
  { icon: "production", title: "Manufacturing & BOM", text: "Plan batches, consume raw materials automatically and track finished-goods yield.", tint: "#0ea5e9" },
  { icon: "orders", title: "Sales orders", text: "Quote, confirm and fulfil orders with live availability and reservation control.", tint: "#0891b2" },
  { icon: "truck", title: "Dispatch & POD", text: "Schedule deliveries, capture proof of delivery and keep customers informed.", tint: "#059669" },
  { icon: "invoice", title: "GST invoicing & payments", text: "Compliant invoices, payment reconciliation and receivables ageing in rupees.", tint: "#d97706" },
  { icon: "shield", title: "Audit & access control", text: "Eight role profiles and an immutable audit trail for every business action.", tint: "#e11d48" }
];

const MODULES: { icon: IconName; label: string }[] = [
  { icon: "dashboard", label: "Dashboard" }, { icon: "inventory", label: "Inventory ledger" }, { icon: "tag", label: "Products & SKUs" },
  { icon: "orders", label: "Sales orders" }, { icon: "production", label: "Manufacturing" }, { icon: "truck", label: "Dispatch & POD" },
  { icon: "invoice", label: "GST invoices" }, { icon: "building", label: "Suppliers & purchases" }, { icon: "chart", label: "Financial reports" }, { icon: "shield", label: "Audit trail" }
];

const FAQS = [
  { q: "Does stock update in real time?", a: "Yes. Every receipt, production batch, sale and dispatch updates the ledger immediately, and connected screens refresh automatically." },
  { q: "Can different team members see different things?", a: "StockPulse ships with eight role profiles, from Owner to Viewer, and hides pages and actions a role is not allowed to use." },
  { q: "Is GST handled?", a: "Orders and invoices carry GST tax codes, and amounts are stored in exact paise so totals always reconcile." },
  { q: "How do I get started?", a: "Creating a company account is free and takes under a minute. Your data is stored for your company only." }
];

const STATS = [
  { v: "8", l: "Role profiles" },
  { v: "10", l: "Connected modules" },
  { v: "24/7", l: "Live sync" },
  { v: "100%", l: "Audit coverage" }
];

const STEPS = [
  { n: "01", t: "Receive", d: "Book purchases into any warehouse and see stock update instantly." },
  { n: "02", t: "Produce", d: "Run BOM-based batches that consume materials and create finished goods." },
  { n: "03", t: "Sell & dispatch", d: "Confirm orders, ship with proof of delivery and issue GST invoices." },
  { n: "04", t: "Get paid", d: "Reconcile payments and watch receivables and cash flow in real time." }
];

export default function WelcomePage() {
  const root = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const bar = root.current?.querySelector<HTMLElement>(".scroll-progress");
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar?.style.setProperty("--p", String(max > 0 ? window.scrollY / max : 0));
      setShowTop(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const els = root.current?.querySelectorAll(".sr") ?? [];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const container: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 28px" };

  return (
    <div ref={root} style={{ overflowX: "hidden" }}>
      <div className="scroll-progress" aria-hidden />
      <button className={`to-top${showTop ? " show" : ""}`} aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{ ...(showTop ? {} : {}) }} data-show={showTop}>
        <span style={{ transform: "rotate(-90deg)", display: "inline-flex" }}><Icon name="arrow" size={20} /></span>
      </button>

      {/* Top navigation */}
      <header className="glass" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ ...container, height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/welcome" className="brand-link" style={{ textDecoration: "none" }}><Logo size={38} showTagline={false} /></Link>
          <nav style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 14, fontWeight: 500 }} className="landing-nav">
            <a href="#features" style={{ color: "var(--text-secondary)" }}>Features</a>
            <a href="#workflow" style={{ color: "var(--text-secondary)" }}>Workflow</a>
            <a href="#stats" style={{ color: "var(--text-secondary)" }}>Why StockPulse</a>
          </nav>
          <Link href="/login" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: "var(--radius-md)", color: "#fff", textDecoration: "none", fontSize: 13.5, fontWeight: 600 }}>
            Sign in <Icon name="arrow" size={16} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{ position: "relative", padding: "92px 0 72px" }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 520, height: 520, left: "-8%", top: -120, borderRadius: "50%", background: "radial-gradient(circle, rgba(2,132,199,.28), transparent 65%)", animation: "floatY 9s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 460, height: 460, right: "-6%", top: 40, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,.25), transparent 65%)", animation: "floatY 11s ease-in-out infinite reverse" }} />
        </div>
        <div style={{ ...container, position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 56, alignItems: "center" }}>
          <div>
            <span className="reveal" style={{ ["--i" as any]: 0, display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: "var(--radius-full)", background: "var(--color-brand-subtle)", color: "var(--color-brand-text)", fontSize: 12.5, fontWeight: 600 }}>
              <Icon name="zap" size={14} /> Built for Indian manufacturers and traders
            </span>
            <h1 className="reveal" style={{ ["--i" as any]: 1, fontSize: "clamp(36px, 5.2vw, 58px)", lineHeight: 1.06, fontWeight: 800, marginTop: 20 }}>
              Run inventory, production and finance{" "}
              <span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>in one live pulse.</span>
            </h1>
            <p className="reveal" style={{ ["--i" as any]: 2, fontSize: 17, color: "var(--text-muted)", marginTop: 20, maxWidth: 520 }}>
              StockPulse connects your warehouses, shop floor, sales desk and accounts so every decision is made on numbers that are current to the second.
            </p>
            <div className="reveal" style={{ ["--i" as any]: 3, display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <Link href="/register" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", borderRadius: "var(--radius-md)", color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 600 }}>
                Get started free <Icon name="arrow" size={18} />
              </Link>
              <a href="#features" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}>
                Explore features
              </a>
            </div>
          </div>

          {/* Product mock */}
          <div className="reveal" style={{ ["--i" as any]: 3, position: "relative" }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 22, padding: 22, boxShadow: "var(--shadow-xl)", animation: "floatY 7s ease-in-out infinite" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>Operational dashboard <span style={{ fontWeight: 500, fontSize: 11, color: "var(--text-muted)" }}>(illustration)</span></span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "var(--color-success-text)", background: "var(--color-success-bg)", padding: "3px 10px", borderRadius: 99 }}>
                  <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-success)" }} /> Live
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
                {[["Sales value", "Updates live"], ["Stock value", "Updates live"]].map(([l, v]) => (
                  <div key={l} style={{ background: "var(--bg-subtle)", borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6, color: "var(--text-secondary)" }}>{v}</div>
                  </div>
                ))}
              </div>
              <svg viewBox="0 0 300 110" style={{ width: "100%", marginTop: 18 }}>
                <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0284c7" stopOpacity=".35" /><stop offset="1" stopColor="#0284c7" stopOpacity="0" /></linearGradient></defs>
                <path d="M0 85 C30 70 45 78 70 58 S120 62 145 40 S200 48 225 28 S275 18 300 10 V110 H0Z" fill="url(#area)" />
                <path d="M0 85 C30 70 45 78 70 58 S120 62 145 40 S200 48 225 28 S275 18 300 10" fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" strokeDasharray="420" style={{ ["--len" as any]: 420, animation: "drawLine 2.2s var(--ease-out) .6s both" }} />
              </svg>
            </div>
            <div style={{ position: "absolute", left: -26, bottom: 34, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-lg)", borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, animation: "floatY 6s ease-in-out infinite reverse" }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: "var(--color-warning-bg)", color: "var(--color-warning)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="alert" size={19} /></span>
              <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>Low stock alert</div><div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Warns you before you run out</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" style={{ padding: "16px 0 64px" }}>
        <div style={{ ...container, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 18 }}>
          {STATS.map((s, i) => (
            <div key={s.l} className="sr" style={{ ["--i" as any]: i, textAlign: "center", padding: "26px 12px", borderRadius: 20, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 800, background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{s.v}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "48px 0 72px" }}>
        <div style={container}>
          <div className="sr" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 48px" }}>
            <h2 style={{ fontSize: "clamp(28px, 3.6vw, 40px)", fontWeight: 700 }}>Everything your business runs on, connected</h2>
            <p style={{ color: "var(--text-muted)", marginTop: 12, fontSize: 16 }}>Ten modules share one source of truth, so stock, production, sales and money never disagree.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 22 }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className="sr kpi" style={{ ["--i" as any]: i % 3, padding: 28, borderRadius: 22, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" }}>
                <span style={{ width: 52, height: 52, borderRadius: 16, background: f.tint, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 12px 22px -8px ${f.tint}` }}>
                  <Icon name={f.icon} size={25} />
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 20 }}>{f.title}</h3>
                <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 14.5 }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" style={{ padding: "48px 0 80px" }}>
        <div style={container}>
          <div className="sr" style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 44px" }}>
            <h2 style={{ fontSize: "clamp(28px, 3.6vw, 40px)", fontWeight: 700 }}>From raw material to cash in hand</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} className="sr" style={{ ["--i" as any]: i, padding: 26, borderRadius: 20, background: "var(--gradient-brand-soft)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--color-brand)" }}>{s.n}</div>
                <h3 style={{ fontSize: 20, fontWeight: 600, margin: "10px 0 8px" }}>{s.t}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Module marquee */}
      <section style={{ padding: "0 0 72px" }}>
        <div className="marquee">
          <div className="marquee-track">
            {[...MODULES, ...MODULES].map((m, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 20px", borderRadius: 99, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", boxShadow: "var(--shadow-sm)" }}>
                <span style={{ color: "var(--color-brand)", display: "inline-flex" }}><Icon name={m.icon} size={18} /></span>{m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "0 0 80px" }}>
        <div style={{ ...container, maxWidth: 820 }}>
          <h2 className="sr" style={{ fontSize: "clamp(26px, 3.4vw, 36px)", fontWeight: 700, textAlign: "center", marginBottom: 32 }}>Frequently asked questions</h2>
          <div className="faq" style={{ display: "grid", gap: 12 }}>
            {FAQS.map((f, i) => (
              <details key={f.q} className="sr" style={{ ["--i" as any]: i }}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "0 0 88px" }}>
        <div className="sr" style={{ ...container }}>
          <div style={{ borderRadius: 28, padding: "56px 32px", textAlign: "center", color: "#fff", background: "linear-gradient(120deg, #082f49, #0c4a6e 50%, #0f766e 130%)", backgroundSize: "200% 200%", animation: "gradientShift 12s ease infinite", boxShadow: "var(--shadow-xl)" }}>
            <h2 style={{ fontSize: "clamp(26px, 3.4vw, 38px)", fontWeight: 700, color: "#fff" }}>See your whole business pulse in one place</h2>
            <p style={{ color: "rgba(255,255,255,.78)", margin: "12px auto 28px", maxWidth: 520 }}>Create your company account in under a minute and start tracking real stock today.</p>
            <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: "var(--radius-md)", background: "#fff", color: "#0c4a6e", textDecoration: "none", fontWeight: 700, fontSize: 15 }}>
              Create your account <Icon name="arrow" size={18} />
            </Link>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "28px 0", background: "var(--bg-surface)" }}>
        <div style={{ ...container, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Logo size={30} showTagline={false} />
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>© 2026 StockPulse. Inventory, manufacturing and business management.</span>
        </div>
      </footer>
    </div>
  );
}
