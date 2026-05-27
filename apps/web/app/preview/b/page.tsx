import Link from "next/link";

export const metadata = { title: "B — brutalist ledger" };

const CSS = `
.pB { --paper: #f4f1ea; --ink: #0e0d0b; --ink-2: #3a342d; --muted: #8a8378; --rule: #0e0d0b; --hair: rgba(14,13,11,.12); --crt: #00b85a; --crt-soft: #d6f5e2; min-height:100vh; background: var(--paper); color: var(--ink); font-family: var(--font-grotesk), system-ui, sans-serif; font-feature-settings: "tnum","lnum"; }
.pB * { box-sizing: border-box; margin: 0; padding: 0; }
.pB .wrap { max-width: 1320px; margin: 0 auto; padding: 0; }

/* HEADER: ledger top */
.pB .head { display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; border-bottom: 2px solid var(--ink); padding: 16px 32px; gap: 32px; }
.pB .head-l, .pB .head-r { font-family: var(--font-mono), ui-monospace, monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-2); }
.pB .head-r { text-align: right; }
.pB .head-l span, .pB .head-r span { color: var(--ink); }
.pB .head-c { font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
.pB .subhead { display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--ink); padding: 10px 32px; font-family: var(--font-mono), ui-monospace, monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-2); }
.pB .subhead nav { display:flex; gap: 24px; }
.pB .subhead a { color: inherit; text-decoration: none; }
.pB .subhead a:hover { color: var(--crt); }
.pB .subhead .live { display:inline-flex; align-items:center; gap:6px; color: var(--ink); }
.pB .blink { width:8px; height:8px; background: var(--crt); animation: pB-blink 1.2s steps(1) infinite; display:inline-block; }
@keyframes pB-blink { 50% { opacity: 0; } }

/* HERO */
.pB .hero { padding: 48px 32px 32px; border-bottom: 1px solid var(--ink); }
.pB .h-row1 { display:flex; justify-content:space-between; align-items:flex-end; gap: 24px; margin-bottom: 24px; }
.pB .h-eye { font-family: var(--font-mono), monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .2em; color: var(--ink-2); }
.pB .h-eye b { color: var(--ink); }
.pB .h-title { font-size: clamp(64px, 11vw, 168px); font-weight: 700; line-height: .88; letter-spacing: -0.045em; color: var(--ink); text-transform: uppercase; }
.pB .h-title .slash { color: var(--crt); }
.pB .h-sub { display:grid; grid-template-columns: 1.4fr 1fr 1fr; border-top: 2px solid var(--ink); margin-top: 32px; }
.pB .h-sub > div { padding: 22px 24px 22px 0; border-right: 1px solid var(--ink); }
.pB .h-sub > div:last-child { border-right: none; padding-right: 0; }
.pB .h-sub > div + div { padding-left: 24px; }
.pB .h-sub-k { font-family: var(--font-mono), monospace; font-size: 10px; text-transform:uppercase; letter-spacing: .2em; color: var(--muted); margin-bottom: 12px; }
.pB .h-sub-v { font-size: 18px; line-height: 1.35; color: var(--ink); font-weight: 500; }
.pB .h-sub-v.mono { font-family: var(--font-mono), monospace; font-size: 20px; }
.pB .h-actions { margin-top: 32px; display:flex; gap: 12px; }
.pB .btn { display:inline-flex; align-items:center; gap: 10px; padding: 18px 24px; font-family: var(--font-mono), monospace; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; font-weight: 700; text-decoration:none; border: 2px solid var(--ink); color: var(--ink); background: var(--paper); transition: background .12s, color .12s; }
.pB .btn:hover { background: var(--ink); color: var(--paper); }
.pB .btn.pri { background: var(--ink); color: var(--paper); }
.pB .btn.pri:hover { background: var(--crt); color: var(--ink); border-color: var(--crt); }

/* TICKER strip */
.pB .strip { display:flex; border-bottom: 1px solid var(--ink); background: var(--ink); color: var(--paper); overflow:hidden; }
.pB .strip-track { display:flex; gap: 0; white-space: nowrap; animation: pB-tick 32s linear infinite; font-family: var(--font-mono), monospace; font-size: 12px; padding: 12px 0; }
.pB .strip-item { display:inline-flex; align-items:center; gap: 10px; padding: 0 22px; border-right: 1px solid rgba(244,241,234,.18); }
.pB .strip-item b { color: var(--crt); font-weight: 600; }
.pB .strip-item u { text-decoration: none; color: rgba(244,241,234,.6); }
@keyframes pB-tick { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* LEDGER TABLE */
.pB .ledger { padding: 56px 32px; border-bottom: 1px solid var(--ink); }
.pB .led-head { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 32px; }
.pB .led-head h2 { font-size: 40px; letter-spacing: -0.02em; font-weight: 700; text-transform: uppercase; }
.pB .led-head h2 i { font-style: normal; color: var(--muted); }
.pB .led-head .meta { font-family: var(--font-mono), monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-2); text-align: right; line-height: 1.6; }
.pB .table { width: 100%; border-collapse: collapse; font-family: var(--font-mono), monospace; }
.pB .table th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .2em; color: var(--muted); padding: 10px 12px; border-bottom: 2px solid var(--ink); font-weight: 500; }
.pB .table th.r, .pB .table td.r { text-align: right; }
.pB .table td { padding: 16px 12px; border-bottom: 1px solid var(--hair); font-size: 14px; color: var(--ink); vertical-align: middle; }
.pB .table tr:last-child td { border-bottom: none; }
.pB .table .delta { color: var(--crt); font-weight: 700; }
.pB .table .neg { color: var(--ink-2); }
.pB .pill { display:inline-block; padding: 3px 8px; border: 1px solid var(--ink); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; }
.pB .pill.live { background: var(--crt); color: var(--ink); border-color: var(--crt); }

/* BIG STATS row */
.pB .stats { display:grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--ink); }
.pB .stat { padding: 40px 24px; border-right: 1px solid var(--ink); }
.pB .stat:last-child { border-right: none; }
.pB .stat-k { font-family: var(--font-mono), monospace; font-size: 10px; text-transform: uppercase; letter-spacing: .2em; color: var(--muted); margin-bottom: 14px; }
.pB .stat-v { font-size: 56px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; font-feature-settings: "tnum"; }
.pB .stat-v.crt { color: var(--crt); }
.pB .stat-d { margin-top: 10px; font-family: var(--font-mono), monospace; font-size: 11px; color: var(--ink-2); text-transform: uppercase; letter-spacing: .12em; }

/* PROJECTION BLOCK */
.pB .proj { padding: 64px 32px; }
.pB .proj-grid { display:grid; grid-template-columns: 1fr 1.4fr; gap: 48px; align-items:start; }
.pB .proj h2 { font-size: 48px; line-height: 1; font-weight: 700; letter-spacing: -0.03em; text-transform: uppercase; margin-bottom: 18px; }
.pB .proj h2 u { text-decoration: none; color: var(--crt); }
.pB .proj p { font-size: 15px; color: var(--ink-2); line-height: 1.55; margin-bottom: 12px; max-width: 38ch; }
.pB .proj small { font-family: var(--font-mono), monospace; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.pB .chart { border: 2px solid var(--ink); padding: 24px; background: var(--paper); position: relative; }
.pB .chart-bars { display:flex; align-items:flex-end; gap: 6px; height: 220px; }
.pB .bar { flex: 1; background: var(--ink); position: relative; }
.pB .bar.win { background: var(--crt); }
.pB .bar-y { position:absolute; top: -22px; left:50%; transform:translateX(-50%); font-family: var(--font-mono), monospace; font-size: 9px; color: var(--ink-2); letter-spacing: .1em; }
.pB .chart-foot { display:flex; justify-content:space-between; margin-top: 14px; font-family: var(--font-mono), monospace; font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-2); }
.pB .chart-foot b { color: var(--ink); }

/* FOOT */
.pB .foot { padding: 22px 32px; border-top: 2px solid var(--ink); display:flex; justify-content:space-between; align-items:center; font-family: var(--font-mono), monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-2); }

.pB .switcher { position: fixed; bottom: 20px; right: 20px; background: var(--ink); color: var(--paper); padding: 10px 14px; font-family: var(--font-mono), monospace; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; text-decoration:none; z-index: 10; border: 2px solid var(--ink); }
.pB .switcher:hover { background: var(--crt); color: var(--ink); border-color: var(--crt); }

@media (max-width: 860px){
  .pB .head { grid-template-columns: 1fr; text-align:center; }
  .pB .head-l, .pB .head-r { text-align: center; }
  .pB .h-sub { grid-template-columns: 1fr; }
  .pB .h-sub > div { border-right: none; border-bottom: 1px solid var(--ink); padding: 18px 0 !important; }
  .pB .stats { grid-template-columns: 1fr 1fr; }
  .pB .stat { border-right: 1px solid var(--ink); border-bottom: 1px solid var(--ink); }
  .pB .proj-grid { grid-template-columns: 1fr; }
}
`;

export default function PreviewB() {
  const bars = [
    { mo: "yr1", v: 8 }, { mo: "y3", v: 16 }, { mo: "y5", v: 26 },
    { mo: "y7", v: 38 }, { mo: "y10", v: 56 }, { mo: "y12", v: 70 },
    { mo: "y15", v: 86 }, { mo: "y18", v: 100, win: true },
  ];
  return (
    <main className="pB">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="head">
          <div className="head-l">Vol. <span>I</span> · No. <span>001</span></div>
          <div className="head-c">jarfi // ledger</div>
          <div className="head-r"><span>05.27.2026</span> · 11:42 UTC</div>
        </div>
        <div className="subhead">
          <nav>
            <a href="#">/how</a>
            <a href="#">/cases</a>
            <a href="#">/yield</a>
            <a href="#">/faq</a>
            <Link href="/dashboard">/dash</Link>
          </nav>
          <div className="live"><span className="blink" /> APY 7.04% · LIVE</div>
        </div>

        <section className="hero">
          <div className="h-row1">
            <div className="h-eye">FILE 001 / <b>SAVE → STAKE → SHARE</b></div>
            <div className="h-eye">EST. 2025</div>
          </div>
          <h1 className="h-title">SAVE<span className="slash">/</span>SHARE<span className="slash">/</span>GROW.</h1>
          <div className="h-sub">
            <div>
              <div className="h-sub-k">// the brief</div>
              <div className="h-sub-v">A jar is a goal with a deadline. Share a link. Friends top it up with a card. Money auto-stakes. Lid pops at the number.</div>
            </div>
            <div>
              <div className="h-sub-k">// inputs</div>
              <div className="h-sub-v mono">$50.00 / mo<br />216 deposits<br />18.0 years</div>
            </div>
            <div>
              <div className="h-sub-k">// output</div>
              <div className="h-sub-v mono" style={{ color: "var(--crt)" }}>$21,400.<br />+$10,600 vs bank</div>
            </div>
          </div>
          <div className="h-actions">
            <Link href="/create" className="btn pri">▶ Start a jar</Link>
            <a href="#" className="btn">See it live</a>
          </div>
        </section>

        <div className="strip">
          <div className="strip-track">
            {Array.from({ length: 2 }).map((_, k) => (
              <span key={k} style={{ display: "inline-flex" }}>
                <span className="strip-item">MARIA <b>+$120.00</b> <u>HONEYMOON</u></span>
                <span className="strip-item">ANON <b>+$25.00</b> <u>CAMERA</u></span>
                <span className="strip-item">PAT <b>+$300.00</b> <u>DOWNPAY</u></span>
                <span className="strip-item">D. <b>+$50.00</b> <u>BIRTHDAY</u></span>
                <span className="strip-item">L. <b>+$1,000.00</b> <u>WEDDING</u></span>
                <span className="strip-item">SAM <b>+$15.00</b> <u>COFFEE</u></span>
                <span className="strip-item">JK <b>+$420.00</b> <u>MOVE</u></span>
              </span>
            ))}
          </div>
        </div>

        <section className="stats">
          <div className="stat">
            <div className="stat-k">// active jars</div>
            <div className="stat-v">12,408</div>
            <div className="stat-d">↑ 218 today</div>
          </div>
          <div className="stat">
            <div className="stat-k">// total locked</div>
            <div className="stat-v">$4.2M</div>
            <div className="stat-d">USDC · Kamino</div>
          </div>
          <div className="stat">
            <div className="stat-k">// avg APY</div>
            <div className="stat-v crt">7.04%</div>
            <div className="stat-d">7d trailing</div>
          </div>
          <div className="stat">
            <div className="stat-k">// jars closed</div>
            <div className="stat-v">1,883</div>
            <div className="stat-d">goal reached</div>
          </div>
        </section>

        <section className="ledger">
          <div className="led-head">
            <h2>Recent <i>contributions</i></h2>
            <div className="meta">
              page 1/47<br />
              auto-refresh · 30s
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>contributor</th>
                <th>jar</th>
                <th>method</th>
                <th>status</th>
                <th className="r">amount</th>
                <th className="r">time</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>001</td><td>Maria L.</td><td>Honeymoon — Bali</td><td>Apple Pay</td><td><span className="pill live">cleared</span></td><td className="r delta">+$120.00</td><td className="r neg">2m</td></tr>
              <tr><td>002</td><td>Anonymous</td><td>Sony A7 fund</td><td>Visa ****4421</td><td><span className="pill live">cleared</span></td><td className="r delta">+$25.00</td><td className="r neg">5m</td></tr>
              <tr><td>003</td><td>Pat K.</td><td>House — deposit</td><td>Apple Pay</td><td><span className="pill live">cleared</span></td><td className="r delta">+$300.00</td><td className="r neg">8m</td></tr>
              <tr><td>004</td><td>Dani</td><td>Mom&apos;s birthday</td><td>Google Pay</td><td><span className="pill live">cleared</span></td><td className="r delta">+$50.00</td><td className="r neg">11m</td></tr>
              <tr><td>005</td><td>Lena &amp; Co.</td><td>Wedding fund</td><td>Visa ****0091</td><td><span className="pill live">cleared</span></td><td className="r delta">+$1,000.00</td><td className="r neg">14m</td></tr>
              <tr><td>006</td><td>Sam</td><td>Coffee jar</td><td>Apple Pay</td><td><span className="pill live">cleared</span></td><td className="r delta">+$15.00</td><td className="r neg">17m</td></tr>
            </tbody>
          </table>
        </section>

        <section className="proj">
          <div className="proj-grid">
            <div>
              <h2>$50<br />becomes<br /><u>$21,400</u>.</h2>
              <p>Same fifty bucks. Eighteen years. Your bank gives you ten thousand and change. jarfi pushes the same money through Kamino USDC lending at ~7% APY — compounding daily.</p>
              <small>Projection, not a promise. Not financial advice.</small>
            </div>
            <div className="chart">
              <div className="chart-bars">
                {bars.map((b) => (
                  <div key={b.mo} className={`bar ${b.win ? "win" : ""}`} style={{ height: `${b.v}%` }}>
                    {b.win && <span className="bar-y">$21.4K</span>}
                  </div>
                ))}
              </div>
              <div className="chart-foot">
                <span>YR <b>1</b></span>
                <span>YR <b>9</b></span>
                <span>YR <b>18</b> · <b style={{ color: "var(--crt)" }}>$21,400</b></span>
              </div>
            </div>
          </div>
        </section>

        <div className="foot">
          <span>© jarfi · 2026 · usdc on solana</span>
          <span><Link href="/create" style={{ color: "var(--crt)", textDecoration: "none" }}>▶ start a jar</Link></span>
        </div>
      </div>
      <Link href="/preview" className="switcher">← variants</Link>
    </main>
  );
}
