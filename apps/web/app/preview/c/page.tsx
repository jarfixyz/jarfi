import Link from "next/link";

export const metadata = { title: "C — object-first" };

const CSS = `
.pC { --paper: #f5ead4; --paper-2: #efe0c4; --ink: #2a1f17; --ink-2: #5e4d3c; --muted: #9a8a72; --rule: rgba(42,31,23,.14); --glass: #b6d8c9; --glass-2: #88baa6; --coin: #d49a3a; --coin-d: #a06a16; --label: #f8f3e5; --tape: #e8c25e; --hot: #d8442a; min-height:100vh; background: var(--paper); color: var(--ink); font-family: var(--font-inter), system-ui, sans-serif; overflow-x: hidden; }
.pC * { box-sizing: border-box; margin:0; padding:0; }
.pC .bg-grad { position: fixed; inset:0; pointer-events:none; background: radial-gradient(80% 50% at 50% 0%, rgba(216,68,42,.07), transparent 60%), radial-gradient(60% 60% at 80% 80%, rgba(136,186,166,.18), transparent 60%); }
.pC .wrap { max-width: 1180px; margin: 0 auto; padding: 24px 32px 80px; position: relative; }

.pC .nav { display:flex; justify-content:space-between; align-items:center; padding: 12px 0 32px; }
.pC .logo { font-family: var(--font-serif), serif; font-size: 30px; font-style: italic; letter-spacing: -0.01em; transform: rotate(-2deg); display:inline-block; }
.pC .logo::after { content:"·"; color: var(--hot); margin-left: 4px; }
.pC .nav-r { display:flex; gap: 22px; align-items:center; }
.pC .nav-r a { color: var(--ink-2); text-decoration:none; font-size: 14px; }
.pC .nav-r a:hover { color: var(--ink); }
.pC .nav-cta { background: var(--ink); color: var(--paper); padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 500; }
.pC .nav-cta:hover { background: var(--hot) !important; color: #fff !important; }

/* HERO */
.pC .hero { display:grid; grid-template-columns: 1.05fr .95fr; gap: 32px; align-items:center; padding: 24px 0 64px; min-height: 580px; }
.pC .h-text { position: relative; }
.pC .h-eye { display:inline-block; font-family: var(--font-serif), serif; font-style: italic; font-size: 18px; color: var(--hot); margin-bottom: 18px; transform: rotate(-1.5deg); }
.pC .h-eye::before { content: "~ "; color: var(--ink-2); font-style: normal; }
.pC .h-title { font-family: var(--font-serif), serif; font-size: clamp(56px, 8vw, 112px); line-height: .95; letter-spacing: -0.02em; color: var(--ink); margin-bottom: 24px; }
.pC .h-title em { font-style: italic; color: var(--hot); }
.pC .h-title .scribble { position: relative; display: inline-block; }
.pC .h-title .scribble::after { content:""; position:absolute; left:-2%; right:-2%; bottom: 8%; height: 14px; background: var(--coin); opacity: .55; z-index: -1; transform: skewY(-2deg); border-radius: 4px; }
.pC .h-body { font-size: 18px; color: var(--ink-2); line-height: 1.55; max-width: 38ch; margin-bottom: 28px; }
.pC .h-actions { display:flex; gap: 12px; align-items:center; }
.pC .btn-go { background: var(--ink); color: var(--paper); border:none; padding: 16px 26px; border-radius: 999px; font-size: 15px; font-weight: 500; text-decoration:none; display:inline-flex; align-items:center; gap:8px; box-shadow: 0 8px 0 -4px var(--coin), 0 18px 30px -10px rgba(42,31,23,.4); transition: transform .15s; }
.pC .btn-go:hover { transform: translateY(-2px); }
.pC .btn-go::after { content:"→"; }
.pC .btn-link { font-size: 14px; color: var(--ink-2); text-decoration: underline; text-decoration-style: wavy; text-underline-offset: 4px; text-decoration-color: var(--hot); }

/* JAR */
.pC .jar-wrap { display:flex; justify-content:center; align-items:center; position: relative; }
.pC .jar { position: relative; width: 360px; height: 460px; filter: drop-shadow(0 30px 40px rgba(42,31,23,.25)); }
.pC .jar-lid { position:absolute; top: 0; left: 50%; transform: translateX(-50%); width: 240px; height: 36px; background: linear-gradient(180deg, #4a3a2a 0%, #2a1f17 100%); border-radius: 8px 8px 4px 4px; border: 1px solid #1a130d; z-index: 5; }
.pC .jar-lid::after { content:""; position:absolute; bottom: -8px; left: 6px; right: 6px; height: 12px; background: linear-gradient(180deg, #5a4634, #3a2a1d); border-radius: 0 0 4px 4px; }
.pC .jar-neck { position:absolute; top: 36px; left: 50%; transform: translateX(-50%); width: 220px; height: 22px; background: linear-gradient(180deg, rgba(182,216,201,.85), rgba(136,186,166,.7)); border: 1px solid rgba(42,31,23,.25); border-bottom: none; border-radius: 4px 4px 0 0; z-index: 4; }
.pC .jar-body { position:absolute; top: 56px; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, rgba(182,216,201,.45) 0%, rgba(136,186,166,.55) 40%, rgba(110,160,140,.7) 100%); border: 2px solid rgba(42,31,23,.32); border-radius: 24px 24px 36px 36px; overflow: hidden; backdrop-filter: blur(1px); }
.pC .jar-body::before { content:""; position:absolute; top: 12px; left: 16px; width: 28px; height: 65%; background: linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.05)); border-radius: 14px; filter: blur(2px); }
.pC .jar-body::after { content:""; position:absolute; top: 12px; right: 22px; width: 8px; height: 40%; background: linear-gradient(180deg, rgba(255,255,255,.4), transparent); border-radius: 4px; }

.pC .coins { position:absolute; left: 6px; right: 6px; bottom: 6px; height: 68%; overflow: hidden; border-radius: 0 0 30px 30px; }
.pC .coin { position:absolute; width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #f5c870, var(--coin) 55%, var(--coin-d) 100%); border: 1px solid var(--coin-d); box-shadow: inset 0 -2px 0 rgba(0,0,0,.18); }
.pC .coin.sm { width: 20px; height: 20px; }
.pC .coin::after { content: "$"; position:absolute; inset: 0; display:flex; align-items:center; justify-content:center; font-size: 12px; font-weight: 700; color: var(--coin-d); font-family: var(--font-serif), serif; }
.pC .coin.sm::after { font-size: 9px; }

.pC .jar-label { position:absolute; top: 36%; left: 50%; transform: translate(-50%, 0) rotate(-2deg); background: var(--label); padding: 14px 22px; border-radius: 4px; box-shadow: 0 4px 10px rgba(42,31,23,.18); z-index: 6; min-width: 200px; text-align: center; border: 1px solid rgba(42,31,23,.1); }
.pC .jar-label::before, .pC .jar-label::after { content:""; position:absolute; width: 42px; height: 18px; background: var(--tape); opacity: .85; top: -10px; }
.pC .jar-label::before { left: -12px; transform: rotate(-22deg); }
.pC .jar-label::after { right: -12px; transform: rotate(20deg); }
.pC .jar-label .l1 { font-family: var(--font-serif), serif; font-style: italic; font-size: 22px; color: var(--ink); line-height: 1; }
.pC .jar-label .l2 { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-2); margin-top: 6px; }
.pC .jar-label .l3 { font-family: var(--font-serif), serif; font-size: 28px; color: var(--hot); margin-top: 6px; font-feature-settings: "tnum"; }

.pC .jar-meter { position:absolute; right: -90px; top: 80px; width: 80px; height: 320px; display:flex; flex-direction: column; align-items:center; gap: 6px; }
.pC .jar-meter-bar { width: 6px; flex: 1; background: rgba(42,31,23,.12); border-radius: 3px; position: relative; }
.pC .jar-meter-fill { position:absolute; bottom: 0; left: 0; right: 0; height: 64%; background: linear-gradient(0deg, var(--hot), var(--coin)); border-radius: 3px; }
.pC .jar-meter-fill::after { content: "64%"; position:absolute; top: -22px; left: 50%; transform: translateX(-50%); font-family: var(--font-serif), serif; font-style: italic; font-size: 14px; color: var(--ink); }
.pC .jar-meter-cap { font-family: var(--font-serif), serif; font-size: 11px; font-style: italic; color: var(--ink-2); text-align:center; line-height: 1.2; }

.pC .drop { animation: pC-drop 3.4s ease-in infinite; opacity: 0; }
@keyframes pC-drop { 0% { transform: translate(var(--x), -120px) rotate(0); opacity: 0; } 8% { opacity:1; } 70% { transform: translate(var(--x), var(--y)) rotate(180deg); opacity:1; } 75%, 100% { opacity: 0; } }
.pC .stick { animation: none; opacity: 1; }

/* CONTRIB STREAM card */
.pC .stream { display:grid; grid-template-columns: 1.1fr 1fr; gap: 48px; padding: 56px 0; align-items:center; border-top: 1px dashed var(--rule); }
.pC .stream-t h2 { font-family: var(--font-serif), serif; font-size: clamp(36px, 4.4vw, 56px); line-height: 1.05; letter-spacing: -0.015em; margin-bottom: 18px; }
.pC .stream-t h2 em { font-style: italic; color: var(--hot); }
.pC .stream-t p { font-size: 16px; color: var(--ink-2); line-height: 1.6; max-width: 38ch; margin-bottom: 12px; }
.pC .stream-card { background: var(--label); border-radius: 18px; padding: 24px; box-shadow: 0 30px 50px -22px rgba(42,31,23,.28); transform: rotate(1deg); position: relative; }
.pC .stream-card::before { content:""; position:absolute; top: -12px; left: 30%; width: 60px; height: 18px; background: var(--tape); opacity: .85; transform: rotate(-2deg); }
.pC .stream-card h3 { font-family: var(--font-serif), serif; font-style: italic; font-size: 22px; margin-bottom: 4px; }
.pC .stream-card .url { font-family: ui-monospace, monospace; font-size: 12px; color: var(--ink-2); margin-bottom: 16px; }
.pC .stream-list { display:flex; flex-direction: column; gap: 0; }
.pC .stream-item { display:grid; grid-template-columns: 32px 1fr auto; gap: 10px; align-items:center; padding: 10px 0; border-bottom: 1px dashed var(--rule); }
.pC .stream-item:last-child { border-bottom: none; }
.pC .av { width: 32px; height: 32px; border-radius: 50%; background: var(--glass); display:flex; align-items:center; justify-content:center; font-family: var(--font-serif), serif; font-style: italic; font-size: 14px; color: var(--ink); }
.pC .av.b { background: var(--coin); color: #fff; }
.pC .av.c { background: var(--hot); color: #fff; }
.pC .av.d { background: var(--ink); color: var(--paper); }
.pC .nm { font-size: 14px; font-weight: 500; color: var(--ink); }
.pC .nt { font-family: var(--font-serif), serif; font-style: italic; font-size: 12.5px; color: var(--ink-2); }
.pC .am { font-family: var(--font-serif), serif; font-size: 18px; color: var(--hot); font-feature-settings: "tnum"; }

/* WHY 3-CARDS (tactile sticky-note style) */
.pC .why { padding: 80px 0 32px; }
.pC .why-head { text-align:center; max-width: 640px; margin: 0 auto 48px; }
.pC .why-head h2 { font-family: var(--font-serif), serif; font-size: clamp(36px, 4.4vw, 54px); line-height: 1.05; letter-spacing: -0.015em; margin-bottom: 14px; }
.pC .why-head h2 em { font-style: italic; color: var(--hot); }
.pC .why-head p { font-size: 16px; color: var(--ink-2); line-height: 1.55; }
.pC .why-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.pC .note { background: var(--label); padding: 28px 24px 32px; border-radius: 6px; box-shadow: 0 16px 30px -14px rgba(42,31,23,.25); position: relative; transition: transform .2s; }
.pC .note:hover { transform: translateY(-4px) rotate(0) !important; }
.pC .note:nth-child(1) { transform: rotate(-1.6deg); }
.pC .note:nth-child(2) { transform: rotate(1.2deg); }
.pC .note:nth-child(3) { transform: rotate(-.6deg); }
.pC .note::before { content:""; position:absolute; top: -10px; left: 30%; width: 64px; height: 18px; background: var(--tape); opacity: .8; transform: rotate(-3deg); }
.pC .note .ic { width: 44px; height: 44px; border-radius: 12px; background: var(--glass); display:flex; align-items:center; justify-content:center; font-family: var(--font-serif), serif; font-style: italic; font-size: 22px; color: var(--ink); margin-bottom: 14px; }
.pC .note h3 { font-family: var(--font-serif), serif; font-size: 22px; line-height: 1.1; margin-bottom: 8px; }
.pC .note p { font-size: 14px; color: var(--ink-2); line-height: 1.5; }

/* CTA */
.pC .cta { margin-top: 72px; padding: 56px 40px; background: var(--ink); color: var(--paper); border-radius: 28px; position: relative; overflow: hidden; display:flex; align-items:center; justify-content:space-between; gap: 32px; }
.pC .cta::before { content:""; position:absolute; right: -80px; top: -80px; width: 320px; height: 320px; background: radial-gradient(circle, var(--hot) 0%, transparent 70%); opacity: .5; }
.pC .cta-t h2 { font-family: var(--font-serif), serif; font-size: clamp(32px, 4vw, 48px); line-height: 1.05; margin-bottom: 8px; }
.pC .cta-t h2 em { font-style: italic; color: var(--coin); }
.pC .cta-t p { color: rgba(245,234,212,.7); font-size: 15px; }
.pC .cta-btn { background: var(--paper); color: var(--ink); padding: 18px 30px; border-radius: 999px; font-size: 15px; font-weight: 500; text-decoration:none; box-shadow: 0 8px 0 -4px var(--coin); white-space: nowrap; }
.pC .cta-btn:hover { background: var(--hot); color: #fff; }

.pC .foot { margin-top: 40px; display:flex; justify-content:space-between; font-size: 13px; color: var(--muted); }

.pC .switcher { position: fixed; bottom: 20px; right: 20px; background: var(--ink); color: var(--paper); padding: 10px 14px; border-radius: 999px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; text-decoration:none; z-index: 10; }

@media (max-width: 860px){
  .pC .hero { grid-template-columns: 1fr; gap: 48px; }
  .pC .jar-meter { display:none; }
  .pC .stream, .pC .why-grid { grid-template-columns: 1fr; gap: 32px; }
  .pC .cta { flex-direction: column; align-items: flex-start; }
}
`;

// stationary coins inside the jar
const stickCoins = [
  { l: 14, b: 6, sz: 28 }, { l: 50, b: 10, sz: 28 }, { l: 90, b: 4, sz: 28 },
  { l: 130, b: 12, sz: 28 }, { l: 170, b: 6, sz: 28 }, { l: 210, b: 10, sz: 28 }, { l: 250, b: 4, sz: 28 }, { l: 290, b: 8, sz: 28 },
  { l: 24, b: 36, sz: 28 }, { l: 60, b: 38, sz: 28 }, { l: 100, b: 34, sz: 28 }, { l: 140, b: 40, sz: 28 }, { l: 180, b: 36, sz: 28 }, { l: 220, b: 38, sz: 28 }, { l: 260, b: 36, sz: 28 },
  { l: 38, b: 64, sz: 22 }, { l: 78, b: 68, sz: 22 }, { l: 118, b: 64, sz: 22 }, { l: 158, b: 68, sz: 22 }, { l: 198, b: 66, sz: 22 }, { l: 238, b: 68, sz: 22 },
  { l: 60, b: 96, sz: 22 }, { l: 100, b: 100, sz: 22 }, { l: 140, b: 98, sz: 22 }, { l: 180, b: 100, sz: 22 }, { l: 220, b: 96, sz: 22 },
  { l: 90, b: 128, sz: 20 }, { l: 130, b: 132, sz: 20 }, { l: 170, b: 128, sz: 20 },
];
const drops = [
  { x: "100px", y: "120px", d: "0s" },
  { x: "180px", y: "160px", d: "1.2s" },
  { x: "60px", y: "140px", d: "2.4s" },
];

export default function PreviewC() {
  return (
    <main className="pC">
      <style>{CSS}</style>
      <div className="bg-grad" />
      <div className="wrap">
        <div className="nav">
          <div className="logo">jarfi</div>
          <div className="nav-r">
            <a href="#">How it works</a>
            <a href="#">Cases</a>
            <a href="#">FAQ</a>
            <Link href="/create" className="nav-cta">Start a jar</Link>
          </div>
        </div>

        <section className="hero">
          <div className="h-text">
            <span className="h-eye">A jar for your goal</span>
            <h1 className="h-title">
              Save for <em>anything</em>.<br />
              <span className="scribble">Drop in</span><br />
              with friends.
            </h1>
            <p className="h-body">Name a goal. Share the link. Friends top up with a bank card — no wallets, no seed phrases. The money stakes itself and the lid pops when you hit the number.</p>
            <div className="h-actions">
              <Link href="/create" className="btn-go">Start your jar</Link>
              <a href="#" className="btn-link">see how it grows</a>
            </div>
          </div>

          <div className="jar-wrap">
            <div className="jar">
              <div className="jar-lid" />
              <div className="jar-neck" />
              <div className="jar-body">
                <div className="coins">
                  {stickCoins.map((c, i) => (
                    <div key={i} className={`coin stick ${c.sz < 28 ? "sm" : ""}`} style={{ left: c.l, bottom: c.b }} />
                  ))}
                  {drops.map((d, i) => (
                    <div key={`d${i}`} className="coin drop" style={{ ["--x" as string]: d.x, ["--y" as string]: d.y, animationDelay: d.d }} />
                  ))}
                </div>
                <div className="jar-label">
                  <div className="l1">Honeymoon — Bali</div>
                  <div className="l2">goal · $6,400</div>
                  <div className="l3">$4,118</div>
                </div>
              </div>
              <div className="jar-meter">
                <div className="jar-meter-bar">
                  <div className="jar-meter-fill" />
                </div>
                <div className="jar-meter-cap">filled</div>
              </div>
            </div>
          </div>
        </section>

        <section className="stream">
          <div className="stream-t">
            <h2>Share a link. <em>Friends chip in.</em></h2>
            <p>Send it to the group chat. Drop it in a wedding invite. Stick it on a fridge. Anyone with a bank card can drop a coin — Apple Pay, Google Pay, Visa, Mastercard.</p>
            <p style={{ color: "var(--ink)", fontFamily: "var(--font-serif), serif", fontStyle: "italic" }}>The jar fills itself. You just open the link.</p>
          </div>
          <div className="stream-card">
            <h3>Honeymoon — Bali</h3>
            <div className="url">jarfi.xyz/j/honeymoon-bali</div>
            <div className="stream-list">
              <div className="stream-item">
                <div className="av">M</div>
                <div><div className="nm">Maria</div><div className="nt">"go enjoy paradise, you two" — 2m</div></div>
                <div className="am">+$120</div>
              </div>
              <div className="stream-item">
                <div className="av b">A</div>
                <div><div className="nm">Anon</div><div className="nt">"♡" — 5m</div></div>
                <div className="am">+$25</div>
              </div>
              <div className="stream-item">
                <div className="av c">P</div>
                <div><div className="nm">Pat &amp; Jo</div><div className="nt">"buy the good wine" — 8m</div></div>
                <div className="am">+$300</div>
              </div>
              <div className="stream-item">
                <div className="av d">D</div>
                <div><div className="nm">Dani</div><div className="nt">"send pics!" — 11m</div></div>
                <div className="am">+$50</div>
              </div>
            </div>
          </div>
        </section>

        <section className="why">
          <div className="why-head">
            <h2>Not a wallet. <em>Just a jar.</em></h2>
            <p>The friction of crypto, hidden. The simplicity of an envelope, kept.</p>
          </div>
          <div className="why-grid">
            <div className="note">
              <div className="ic">¢</div>
              <h3>Bank cards in, bank cards out</h3>
              <p>Friends pay with Apple Pay or Visa. You cash out the same way. We handle the chain plumbing in the back room.</p>
            </div>
            <div className="note">
              <div className="ic">↑</div>
              <h3>Grows while it sits</h3>
              <p>Every dollar earns ~7% APY through Kamino USDC lending. $50/mo for 18 years compounds to over $21,400.</p>
            </div>
            <div className="note">
              <div className="ic">⌁</div>
              <h3>Lid pops at the number</h3>
              <p>Set a goal. The jar unlocks the day you hit it. No early withdrawals to tempt you off the plan.</p>
            </div>
          </div>
        </section>

        <section className="cta">
          <div className="cta-t">
            <h2>Your jar. <em>One minute</em> away.</h2>
            <p>Name it. Set a goal. Share the link.</p>
          </div>
          <Link href="/create" className="cta-btn">Start your jar →</Link>
        </section>

        <div className="foot">
          <span>jarfi · 2026</span>
          <span>github · twitter · docs</span>
        </div>
      </div>
      <Link href="/preview" className="switcher">← variants</Link>
    </main>
  );
}
