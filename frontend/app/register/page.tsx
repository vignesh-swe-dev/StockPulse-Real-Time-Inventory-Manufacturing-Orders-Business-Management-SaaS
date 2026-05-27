"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { Logo, LogoMark } from "../../components/Logo";
import { Icon } from "../../components/Icon";

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ companyName: "", ownerName: "", email: "", password: "", taxRegistrationNo: "", allowNegativeStock: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const gst = f.taxRegistrationNo.trim().toUpperCase();
    if (gst && !GSTIN.test(gst)) return setError("GSTIN looks invalid. It has 15 characters, for example 33ABCDE1234F1Z5. Leave it empty to add it later.");
    if (f.password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      await register({
        companyName: f.companyName.trim(),
        ownerName: f.ownerName.trim(),
        email: f.email.trim(),
        password: f.password,
        taxRegistrationNo: gst || null,
        allowNegativeStock: f.allowNegativeStock
      });
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Could not create the account.");
      setBusy(false);
    }
  };

  const input: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14.5 };
  const label: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, fontWeight: 600 };

  return (
    <div className="login-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)", minHeight: "100vh" }}>
      <div className="login-art" style={{ position: "relative", overflow: "hidden", color: "#fff", padding: 56, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div className="grid-bg" aria-hidden style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <LogoMark size={44} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>StockPulse</span>
        </div>
        <div style={{ position: "relative", maxWidth: 440 }}>
          <h1 style={{ fontSize: 36, lineHeight: 1.12, color: "#fff" }}>Set up your company in a minute.</h1>
          <div style={{ display: "grid", gap: 14, marginTop: 28, fontSize: 14.5 }}>
            {["Create your account and become the Owner", "Add warehouses, products and customers", "Receive stock, sell, dispatch and invoice"].map((t, i) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{i + 1}</span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", fontSize: 12.5, color: "rgba(255,255,255,.6)" }}>Your data is saved to your own database.</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div className="page-enter" style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ marginBottom: 24 }}><Logo size={34} showTagline={false} /></div>
          <h2 style={{ fontSize: 27, fontWeight: 700 }}>Create your account</h2>
          <p style={{ color: "var(--text-muted)", margin: "6px 0 22px" }}>For your company. You will be the Owner.</p>

          {error && <div role="alert" style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--color-danger-bg)", border: "1px solid var(--color-danger-border)", color: "var(--color-danger-text)", fontSize: 13.5, marginBottom: 14 }}>{error}</div>}

          <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
            <label style={label}>Company name
              <input required style={input} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="e.g. Sri Lakshmi Traders" />
            </label>
            <label style={label}>GSTIN <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional, can be added later)</span>
              <input style={{ ...input, fontFamily: "var(--font-mono)", textTransform: "uppercase" }} maxLength={15} value={f.taxRegistrationNo} onChange={(e) => set("taxRegistrationNo", e.target.value)} placeholder="33ABCDE1234F1Z5" />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={label}>Your name
                <input required style={input} value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
              </label>
              <label style={label}>Work email
                <input required type="email" style={input} value={f.email} onChange={(e) => set("email", e.target.value)} />
              </label>
            </div>
            <label style={label}>Password
              <input required type="password" minLength={8} style={input} value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" />
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={f.allowNegativeStock} onChange={(e) => set("allowNegativeStock", e.target.checked)} style={{ marginTop: 3 }} />
              Allow negative stock (sell before goods are received). Leave off for strict stock control.
            </label>
            <button type="submit" disabled={busy} style={{ padding: "14px 18px", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-brand)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
              {busy ? <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite" }} /> : <>Create account <Icon name="arrow" size={18} /></>}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-muted)" }}>
            Already have an account? <Link href="/login" style={{ color: "var(--color-brand)", fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .login-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
