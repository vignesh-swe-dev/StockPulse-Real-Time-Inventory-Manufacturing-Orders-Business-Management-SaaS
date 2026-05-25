import Link from "next/link";
import { LogoMark } from "../components/Logo";

export default function NotFound() {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
      <div className="page-enter">
        <div style={{ display: "inline-block", animation: "floatY 5s ease-in-out infinite" }}><LogoMark size={72} /></div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 96, fontWeight: 800, lineHeight: 1, marginTop: 12, background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>404</div>
        <h1 style={{ fontSize: 24, marginTop: 8 }}>This page flatlined</h1>
        <p style={{ color: "var(--text-muted)", margin: "8px auto 24px", maxWidth: 380 }}>The page you are looking for does not exist or has moved.</p>
        <Link href="/" className="btn-primary" style={{ display: "inline-flex", padding: "12px 22px", borderRadius: "var(--radius-md)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>Back to dashboard</Link>
      </div>
    </div>
  );
}
