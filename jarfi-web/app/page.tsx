"use client";

import { useState } from "react";
import Link from "next/link";

function calcValues(monthly: number, years: number, gifts: number) {
  const n = years * 12;
  const rBank = 0.02 / 12;
  const rJarfi = 0.055 / 12;
  const bank =
    monthly * ((Math.pow(1 + rBank, n) - 1) / rBank) +
    gifts * Math.pow(1 + rBank, n);
  const jarfi =
    monthly * ((Math.pow(1 + rJarfi, n) - 1) / rJarfi) +
    gifts * Math.pow(1 + rJarfi, n);
  return { bank: Math.round(bank), jarfi: Math.round(jarfi) };
}

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

export default function Landing() {
  const [monthly, setMonthly] = useState(100);
  const [years, setYears] = useState(10);
  const [gifts, setGifts] = useState(0);
  const { bank, jarfi } = calcValues(monthly, years, gifts);

  return (
    <div style={{ fontFamily: "var(--font)", background: "var(--bg)", color: "var(--text-primary)", minHeight: "100vh" }}>

      {/* NAV */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 48px", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, background: "var(--bg)", zIndex: 100,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.3px" }}>
          jar<span style={{ color: "var(--green)" }}>fi</span>
        </div>
        <div style={{ display: "flex", gap: 32 }} className="nav-links">
          <a href="#how" style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}>How it works</a>
          <a href="#calculator" style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}>Calculator</a>
        </div>
        <Link href="/dashboard" style={{
          fontSize: 14, fontWeight: 500, background: "var(--text-primary)", color: "#fff",
          padding: "9px 20px", borderRadius: 8, textDecoration: "none", display: "inline-block",
        }}>
          Create a jar
        </Link>
      </nav>

      {/* HERO */}
      <section style={{ padding: "80px 48px 96px" }} className="hero-section">
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }} className="hero-grid">
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--green-light)", color: "var(--green)",
              fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 20, marginBottom: 28,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />
              Onchain savings, for everyone
            </div>
            <h1 style={{ fontSize: 54, fontWeight: 500, lineHeight: 1.1, letterSpacing: "-1.5px", marginBottom: 20, margin: "0 0 20px" }}>
              Save together.<br />Grow automatically.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--text-secondary)", marginBottom: 36, maxWidth: 440 }}>
              Create a savings jar, share a link, and let anyone contribute — even without crypto.
              Your funds grow onchain while you focus on what matters.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Link href="/dashboard" style={{
                display: "inline-flex", alignItems: "center",
                background: "var(--text-primary)", color: "#fff",
                fontSize: 15, fontWeight: 500, padding: "13px 28px",
                borderRadius: 8, textDecoration: "none",
              }}>
                Create a jar
              </Link>
              <a href="#how" style={{
                display: "inline-flex", alignItems: "center",
                background: "var(--bg)", color: "var(--text-primary)",
                fontSize: 15, fontWeight: 500, padding: "12px 24px",
                borderRadius: 8, border: "1px solid var(--border)", textDecoration: "none",
              }}>
                How it works
              </a>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 14 }}>
              No crypto knowledge needed to contribute.
            </p>
          </div>

          {/* Demo card */}
          <div>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, padding: 32, maxWidth: 420 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>EVA&apos;s 18th Birthday 🎁</div>
                <div style={{ fontSize: 11, background: "var(--bg-muted)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: 20, fontWeight: 500 }}>10 years</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, color: "var(--text-tertiary)" }}>If spent today</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-tertiary)" }}>$0</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>In a bank (2%)</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>$5,200</span>
                </div>
                <div style={{ height: 1, background: "var(--border)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>With Jarfi</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "var(--green)", letterSpacing: "-0.5px" }}>$8,940</span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
                  <span>$3,420 saved so far</span><span>34%</span>
                </div>
                <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: "34%", height: "100%", background: "var(--green)", borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>12 contributors</span>
                <Link href="/gift/anya" style={{ fontSize: 13, color: "var(--green)", fontWeight: 500, textDecoration: "none" }}>Contribute →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CALCULATOR */}
      <section id="calculator" style={{ padding: "96px 48px", background: "var(--bg-muted)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 500, letterSpacing: "-0.8px", marginBottom: 8 }}>See what small contributions can become</h2>
            <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>Adjust the sliders to see how your savings grow over time.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }} className="calc-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <SliderRow label="Monthly contribution" value={monthly} display={`$${monthly}`} min={10} max={500} step={10} onChange={setMonthly} minLabel="$10" maxLabel="$500" />
              <SliderRow label="Years" value={years} display={`${years} ${years === 1 ? "year" : "years"}`} min={1} max={30} step={1} onChange={setYears} minLabel="1" maxLabel="30" />
              <SliderRow label="One-time gifts" value={gifts} display={`$${gifts}`} min={0} max={5000} step={100} onChange={setGifts} minLabel="$0" maxLabel="$5,000" />
            </div>
            <div style={{ background: "var(--bg)", borderRadius: 20, padding: 36, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>After {years} {years === 1 ? "year" : "years"}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Do nothing</span>
                <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-tertiary)" }}>$0</span>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>In a bank (2%)</span>
                <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--text-secondary)" }}>{fmt(bank)}</span>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>With Jarfi</span>
                <span style={{ fontSize: 36, fontWeight: 600, color: "var(--green)", letterSpacing: "-1px" }}>{fmt(jarfi)}</span>
              </div>
              <Link href="/dashboard" style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--text-primary)", color: "#fff", fontSize: 15, fontWeight: 500,
                padding: "13px 28px", borderRadius: 8, textDecoration: "none", marginTop: 4,
              }}>
                Start saving now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: "96px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 500, letterSpacing: "-0.8px", marginBottom: 64 }}>How it works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 48 }} className="hiw-grid">
            {[
              { icon: "🫙", num: "01", title: "Create a jar", body: "Set your goal and start saving. Name it, set a target, and choose a timeframe." },
              { icon: "🔗", num: "02", title: "Share a link", body: "Anyone can contribute in seconds — no crypto knowledge or wallet needed." },
              { icon: "🌱", num: "03", title: "Watch it grow", body: "Your savings increase over time automatically. See the future value at every step." },
            ].map((s) => (
              <div key={s.num}>
                <div style={{ width: 40, height: 40, background: "var(--bg-muted)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 20 }}>{s.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.5px", marginBottom: 16 }}>{s.num}</div>
                <h3 style={{ fontSize: 19, fontWeight: 500, marginBottom: 8, letterSpacing: "-0.3px" }}>{s.title}</h3>
                <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EMOTIONAL */}
      <section style={{ padding: "96px 48px", background: "var(--bg-muted)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 40, fontWeight: 400, letterSpacing: "-1px", lineHeight: 1.2, marginBottom: 20 }}>Some things are easier together.</h2>
          <p style={{ fontSize: 18, lineHeight: 2, color: "var(--text-secondary)", marginBottom: 40 }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>A birthday.</strong><br />
            <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>A future.</strong><br />
            A goal you don&apos;t want to miss.
          </p>
          <Link href="/dashboard" style={{
            display: "inline-flex", alignItems: "center",
            background: "var(--text-primary)", color: "#fff",
            fontSize: 15, fontWeight: 500, padding: "13px 28px", borderRadius: 8, textDecoration: "none",
          }}>
            Create your first jar
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "40px 48px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>jar<span style={{ color: "var(--green)" }}>fi</span></div>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>© 2026 Jarfi. Onchain savings for everyone.</div>
      </footer>

      <style>{`
        :root { --bg-muted: #F7F8F7; --green-light: #EAF4EE; }
        .hero-grid, .calc-grid, .hiw-grid { display: grid !important; }
        @media (max-width: 900px) {
          .hero-section { padding: 56px 20px 72px !important; }
          .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .calc-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .hiw-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
        }
        @media (max-width: 768px) {
          nav { padding: 16px 20px !important; }
          .nav-links { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function SliderRow({ label, value, display, min, max, step, onChange, minLabel, maxLabel }: {
  label: string; value: number; display: string;
  min: number; max: number; step: number;
  onChange: (v: number) => void; minLabel: string; maxLabel: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px" }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)" }}>
        <span>{minLabel}</span><span>{maxLabel}</span>
      </div>
    </div>
  );
}
