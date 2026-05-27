import Link from "next/link";

export const metadata = { title: "jarfi — landing previews" };

export default function PreviewIndex() {
  const opts = [
    { href: "/preview/a", label: "A — Editorial maximalist", note: "Serif display, asymmetric grid, oxblood accent" },
    { href: "/preview/b", label: "B — Brutalist ledger", note: "Mono, hairlines, FT/Bloomberg vibe" },
    { href: "/preview/c", label: "C — Object-first", note: "Jar as the hero, tactile, playful" },
    { href: "/preview/d", label: "D — Group chat", note: "Лендинг = один чат. Без фичей, без секций." },
    { href: "/preview/e", label: "E — One jar story", note: "Case №001. Long-form, evidence trail, anti-marketing." },
  ];
  return (
    <main style={{
      minHeight: "100vh", background: "#0e0d0b", color: "#f4f1ea",
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 28, padding: 40,
    }}>
      <h1 style={{ fontFamily: "var(--font-serif), serif", fontSize: 56, fontStyle: "italic", letterSpacing: "-0.02em", margin: 0 }}>
        pick a direction
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "min(560px, 100%)" }}>
        {opts.map((o) => (
          <Link key={o.href} href={o.href} style={{
            display: "block", padding: "20px 24px", border: "1px solid #2a2723",
            color: "#f4f1ea", textDecoration: "none", borderRadius: 4,
            transition: "background .15s, border-color .15s",
          }}>
            <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}>{o.label}</div>
            <div style={{ fontSize: 13, color: "#8a8378", marginTop: 4 }}>{o.note}</div>
          </Link>
        ))}
      </div>
      <Link href="/" style={{ fontSize: 12, color: "#6b6258", marginTop: 12 }}>← current landing</Link>
    </main>
  );
}
