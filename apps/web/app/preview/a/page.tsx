import Link from "next/link";

export const metadata = { title: "A — editorial maximalist" };

const CSS = `
.pA { --paper: #efe9dc; --ink: #1a1714; --ink-2: #5a5147; --muted: #8c8275; --rule: rgba(26,23,20,.16); --hair: rgba(26,23,20,.08); --accent: #8c2e2a; --accent-soft: #f0e0dd; min-height:100vh; background:var(--paper); color:var(--ink); font-family: var(--font-inter), system-ui, sans-serif; }
.pA * { box-sizing: border-box; margin:0; padding:0; }
.pA .grain { position: fixed; inset:0; pointer-events:none; opacity:.5; mix-blend-mode:multiply; background-image: radial-gradient(rgba(26,23,20,.08) 1px, transparent 1px); background-size: 3px 3px; }
.pA .wrap { max-width: 1280px; margin: 0 auto; padding: 28px 48px 80px; position:relative; }
.pA .topbar { display:flex; justify-content:space-between; align-items:center; padding-bottom: 22px; border-bottom: 1px solid var(--rule); margin-bottom: 8px; }
.pA .mast { font-family: var(--font-serif), serif; font-size: 28px; font-style: italic; letter-spacing: -0.02em; }
.pA .topbar nav { display:flex; gap:24px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-2); }
.pA .topbar nav a:hover { color: var(--ink); }
.pA .topbar a { color: inherit; text-decoration: none; }
.pA .topdate { font-size: 11px; letter-spacing: .14em; text-transform:uppercase; color: var(--muted); display:flex; justify-content:space-between; padding: 8px 0 24px; border-bottom: 3px double var(--rule); }

/* HERO */
.pA .hero { display:grid; grid-template-columns: 5fr 3fr; gap: 56px; padding: 64px 0 80px; align-items:end; }
.pA .h-eyebrow { font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--accent); font-weight: 600; margin-bottom: 28px; }
.pA .h-fig { font-family: var(--font-serif), serif; font-size: clamp(120px, 18vw, 240px); line-height: .9; letter-spacing: -0.04em; color: var(--ink); font-feature-settings: "lnum","tnum"; }
.pA .h-fig em { font-style: italic; color: var(--accent); }
.pA .h-cap { font-family: var(--font-serif), serif; font-style: italic; font-size: 28px; line-height: 1.25; color: var(--ink-2); margin-top: 18px; max-width: 22ch; }
.pA .h-side { padding-bottom: 8px; border-left: 1px solid var(--rule); padding-left: 32px; }
.pA .h-side p { font-family: var(--font-serif), serif; font-size: 20px; line-height: 1.45; color: var(--ink); margin-bottom: 18px; }
.pA .h-side p .drop { float:left; font-family: var(--font-serif), serif; font-size: 56px; line-height: .85; padding: 6px 8px 0 0; color: var(--accent); }
.pA .h-side small { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); display:block; margin-bottom: 8px; }
.pA .h-actions { margin-top: 28px; display:flex; gap: 14px; }
.pA .btn-pri { display:inline-flex; align-items:center; gap:10px; padding: 14px 22px; background: var(--ink); color: var(--paper); border-radius: 2px; font-size: 13px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; text-decoration: none; }
.pA .btn-pri:hover { background: var(--accent); }
.pA .btn-sec { display:inline-flex; align-items:center; padding: 14px 18px; border: 1px solid var(--ink); border-radius: 2px; font-size: 13px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; text-decoration: none; color: var(--ink); }

/* TICKER */
.pA .ticker { border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); padding: 14px 0; overflow: hidden; position: relative; margin: 16px 0 0; }
.pA .ticker-track { display:flex; gap: 56px; white-space: nowrap; animation: pA-tick 38s linear infinite; }
.pA .ticker-item { font-family: var(--font-serif), serif; font-size: 18px; color: var(--ink); display:inline-flex; align-items:center; gap: 12px; }
.pA .ticker-item b { color: var(--accent); font-style: italic; font-weight: 400; }
.pA .ticker-item span { color: var(--muted); font-size: 13px; letter-spacing: .14em; text-transform: uppercase; font-family: var(--font-inter), sans-serif; }
@keyframes pA-tick { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* COMPARE */
.pA .compare { padding: 96px 0 64px; display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border-top: 1px solid var(--rule); margin-top: 56px; }
.pA .compare > div { padding: 32px 32px; }
.pA .compare > div + div { border-left: 1px solid var(--rule); }
.pA .cmp-label { font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--muted); margin-bottom: 18px; }
.pA .cmp-num { font-family: var(--font-serif), serif; font-size: 88px; line-height: .9; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.pA .cmp-num.win { color: var(--accent); font-style: italic; }
.pA .cmp-sub { font-size: 13px; color: var(--ink-2); margin-top: 14px; line-height: 1.5; }
.pA .cmp-delta { font-family: var(--font-serif), serif; font-size: 88px; line-height: .9; letter-spacing: -0.03em; color: var(--ink); font-feature-settings: "lnum","tnum"; }
.pA .cmp-delta::before { content: "+"; color: var(--accent); }

/* FULL-WIDTH PULL */
.pA .pull { padding: 80px 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); margin-top: 8px; text-align: center; }
.pA .pull h2 { font-family: var(--font-serif), serif; font-style: italic; font-size: clamp(48px, 7vw, 96px); line-height: 1.05; letter-spacing: -0.02em; max-width: 18ch; margin: 0 auto; color: var(--ink); }
.pA .pull h2 mark { background: transparent; color: var(--accent); border-bottom: 4px solid var(--accent); padding-bottom: 2px; }
.pA .pull-meta { margin-top: 36px; font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--muted); display:flex; justify-content:center; gap: 28px; }
.pA .pull-meta span::before { content:"§ "; color: var(--accent); }

/* STAMP CTA */
.pA .stamp { margin: 96px auto 0; padding: 56px 48px; border: 2px solid var(--ink); border-radius: 4px; max-width: 880px; text-align:center; position: relative; background: var(--accent-soft); }
.pA .stamp::before, .pA .stamp::after { content:""; position:absolute; inset: 8px; border: 1px dashed var(--ink); border-radius: 2px; pointer-events:none; opacity:.4; }
.pA .stamp::after { inset: 14px; border-color: var(--accent); opacity:.3; }
.pA .stamp-eye { font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--accent); margin-bottom: 16px; }
.pA .stamp h2 { font-family: var(--font-serif), serif; font-style: italic; font-size: clamp(40px, 5vw, 64px); line-height: 1.05; color: var(--ink); margin-bottom: 24px; }
.pA .stamp-go { display:inline-block; padding: 16px 36px; background: var(--ink); color: var(--paper); text-decoration:none; border-radius: 2px; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; font-weight: 500; }

.pA .foot { margin-top: 64px; padding-top: 22px; border-top: 1px solid var(--rule); display:flex; justify-content:space-between; font-size: 12px; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
.pA .switcher { position: fixed; bottom: 20px; right: 20px; background: var(--ink); color: var(--paper); padding: 10px 14px; border-radius: 999px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; text-decoration:none; z-index: 10; }

@media (max-width: 860px){
  .pA .wrap { padding: 20px 22px 60px; }
  .pA .hero { grid-template-columns: 1fr; gap: 32px; padding: 32px 0 48px; }
  .pA .h-side { border-left: none; padding-left: 0; border-top: 1px solid var(--rule); padding-top: 24px; }
  .pA .compare { grid-template-columns: 1fr; }
  .pA .compare > div + div { border-left: none; border-top: 1px solid var(--rule); }
}
`;

export default function PreviewA() {
  return (
    <main className="pA">
      <style>{CSS}</style>
      <div className="grain" />
      <div className="wrap">
        <div className="topbar">
          <div className="mast">jarfi</div>
          <nav>
            <a href="#">Vol. I</a>
            <a href="#">Edition 01</a>
            <a href="#">Manifest</a>
            <a href="#">Dashboard</a>
          </nav>
        </div>
        <div className="topdate">
          <span>Est. 2025 — A jar for the long haul</span>
          <span>Tuesday, May 27, 2026</span>
        </div>

        <section className="hero">
          <div>
            <div className="h-eyebrow">§ One number, eighteen years</div>
            <h1 className="h-fig">$21,400<em>.</em></h1>
            <div className="h-cap">From fifty dollars a month, quietly compounding while you sleep.</div>
            <div className="h-actions">
              <Link href="/create" className="btn-pri">Start your jar →</Link>
              <a href="#" className="btn-sec">See it live</a>
            </div>
          </div>
          <aside className="h-side">
            <small>Editorial — The Premise</small>
            <p><span className="drop">A</span> jar is just a goal with a deadline. Set the number, share a link, and friends top it up with a bank card. No wallets. No phrases. The money stakes itself and the lid pops the day you hit the figure.</p>
          </aside>
        </section>

        <div className="ticker">
          <div className="ticker-track">
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i} style={{ display: "inline-flex", gap: 56 }}>
                <span className="ticker-item">Maria → <b>+$120</b> <span>Honeymoon jar · 2m</span></span>
                <span className="ticker-item">Anon → <b>+$25</b> <span>New camera · 5m</span></span>
                <span className="ticker-item">Pat → <b>+$300</b> <span>Down payment · 8m</span></span>
                <span className="ticker-item">D. → <b>+$50</b> <span>Birthday · 11m</span></span>
                <span className="ticker-item">L. → <b>+$1,000</b> <span>Wedding · 14m</span></span>
                <span className="ticker-item">Sam → <b>+$15</b> <span>Coffee fund · 17m</span></span>
              </span>
            ))}
          </div>
        </div>

        <section className="compare">
          <div>
            <div className="cmp-label">§ Your bank</div>
            <div className="cmp-num">$10,800</div>
            <div className="cmp-sub">50 a month, eighteen years, 0.5% APY. Inflation eats most of it.</div>
          </div>
          <div>
            <div className="cmp-label">§ jarfi</div>
            <div className="cmp-num win">$21,400</div>
            <div className="cmp-sub">Same money, ~7% APY from Kamino USDC lending. Compounding daily.</div>
          </div>
          <div>
            <div className="cmp-label">§ The difference</div>
            <div className="cmp-delta">$10,600</div>
            <div className="cmp-sub">A second jar, for free. Projection, not a promise.</div>
          </div>
        </section>

        <section className="pull">
          <h2>Save for anything. <mark>Let it grow</mark> on its own.</h2>
          <div className="pull-meta">
            <span>No wallets</span>
            <span>No seed phrases</span>
            <span>Bank cards only</span>
            <span>Auto-staked</span>
          </div>
        </section>

        <section className="stamp">
          <div className="stamp-eye">★ One minute away ★</div>
          <h2>Your jar, fresh off the press.</h2>
          <Link href="/create" className="stamp-go">Start your jar</Link>
        </section>

        <div className="foot">
          <span>© jarfi · Vol I · 2026</span>
          <span>github · twitter · docs</span>
        </div>
      </div>
      <Link href="/preview" className="switcher">← variants</Link>
    </main>
  );
}
