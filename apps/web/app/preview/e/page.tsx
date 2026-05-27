"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export const dynamic = "force-static";

const CSS = `
.pE { --paper: #faf8f3; --ink: #14110d; --ink-2: #4a443c; --muted: #8a8378; --hair: rgba(20,17,13,.10); --hair-2: rgba(20,17,13,.18); --rust: #b4502a; --rust-soft: #f3dccb; --green: #3d6a47; min-height: 100vh; background: var(--paper); color: var(--ink); font-family: var(--font-inter), system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.pE * { box-sizing: border-box; margin: 0; padding: 0; }
.pE a { color: inherit; text-decoration: none; }

/* sticky progress hairline */
.pE .top-prog { position: fixed; top: 0; left: 0; right: 0; height: 2px; background: transparent; z-index: 50; }
.pE .top-prog-fill { height: 100%; background: var(--rust); width: 0%; transition: width .25s ease; }

.pE .col { max-width: 720px; margin: 0 auto; padding: 32px 28px 80px; }

/* mast */
.pE .mast { display:flex; justify-content:space-between; align-items: baseline; padding-bottom: 14px; border-bottom: 1px solid var(--hair); }
.pE .mast-l { display:flex; gap: 14px; align-items: baseline; font-size: 13px; color: var(--ink-2); letter-spacing: .01em; }
.pE .mast-l b { color: var(--ink); font-weight: 600; }
.pE .mast-r { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }

/* hero */
.pE .head { padding: 80px 0 56px; }
.pE .eye { font-size: 11px; letter-spacing: .26em; color: var(--rust); font-weight: 600; text-transform: uppercase; margin-bottom: 28px; display:flex; align-items: center; gap: 10px; }
.pE .eye::after { content:""; flex:1; height: 1px; background: var(--hair-2); }
.pE h1 { font-family: var(--font-serif), serif; font-size: clamp(48px, 7vw, 84px); line-height: 1.02; letter-spacing: -0.025em; color: var(--ink); font-weight: 400; margin-bottom: 24px; }
.pE h1 em { font-style: italic; }
.pE .lede { font-family: var(--font-serif), serif; font-size: 22px; line-height: 1.4; color: var(--ink-2); font-style: italic; max-width: 32ch; }

/* body */
.pE .lead { padding: 40px 0 32px; }
.pE .lead p { font-size: 18px; line-height: 1.65; color: var(--ink); max-width: 60ch; }
.pE .lead p + p { margin-top: 18px; }
.pE .lead p .acc { color: var(--rust); }
.pE .lead p strong { font-weight: 600; }
.pE .lead p em { font-style: italic; }

/* the jar artifact (looks like pasted product UI) */
.pE .artifact { margin: 40px 0; border: 1px solid var(--hair-2); background: #fff; border-radius: 4px; overflow: hidden; }
.pE .artifact-head { padding: 10px 14px; border-bottom: 1px solid var(--hair); display:flex; justify-content:space-between; align-items: center; background: var(--paper); }
.pE .artifact-head-l { font-family: var(--font-mono), ui-monospace, monospace; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .14em; }
.pE .artifact-head-r { font-family: var(--font-mono), ui-monospace, monospace; font-size: 11px; color: var(--muted); }
.pE .artifact-body { padding: 24px 22px; }
.pE .art-name { font-size: 20px; font-weight: 600; letter-spacing: -.01em; margin-bottom: 4px; }
.pE .art-name::before { content: "🫙 "; }
.pE .art-tag { font-size: 13px; color: var(--muted); margin-bottom: 18px; font-family: var(--font-mono), monospace; }
.pE .art-row { display:flex; justify-content:space-between; padding: 9px 0; border-bottom: 1px dashed var(--hair); font-size: 14px; }
.pE .art-row:last-of-type { border-bottom: none; }
.pE .art-row .k { color: var(--muted); font-family: var(--font-mono), monospace; font-size: 12px; letter-spacing: .04em; }
.pE .art-row .v { color: var(--ink); font-variant-numeric: tabular-nums; }
.pE .art-bar { height: 4px; background: var(--hair); border-radius: 2px; margin: 16px 0 6px; overflow: hidden; }
.pE .art-bar-fill { height: 100%; background: var(--rust); width: 0%; transition: width .9s cubic-bezier(.2,.7,.1,1); border-radius: 2px; }
.pE .art-prog { display:flex; justify-content:space-between; font-family: var(--font-mono), monospace; font-size: 11.5px; color: var(--ink); font-variant-numeric: tabular-nums; }
.pE .art-prog .pct { color: var(--rust); font-weight: 600; }

/* the log */
.pE .log-head { display:flex; justify-content:space-between; align-items: baseline; padding-top: 24px; padding-bottom: 14px; border-bottom: 1px solid var(--hair-2); margin-bottom: 8px; }
.pE .log-head h2 { font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--ink); font-weight: 600; }
.pE .log-head .count { font-family: var(--font-mono), monospace; font-size: 11px; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
.pE .log { display:grid; grid-template-columns: 96px 1fr; gap: 0; }
.pE .row { display: contents; }
.pE .row .date { padding: 16px 24px 16px 0; border-bottom: 1px solid var(--hair); font-family: var(--font-mono), monospace; font-size: 11.5px; color: var(--muted); letter-spacing: .04em; padding-top: 18px; }
.pE .row .ev { padding: 16px 0; border-bottom: 1px solid var(--hair); }
.pE .ev-head { display:flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.pE .ev-who { font-size: 16px; color: var(--ink); }
.pE .ev-who b { font-weight: 600; }
.pE .ev-amt { font-family: var(--font-mono), monospace; font-size: 14.5px; color: var(--rust); font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.pE .ev-msg { font-family: var(--font-serif), serif; font-style: italic; color: var(--ink-2); font-size: 16px; margin-top: 4px; line-height: 1.5; }
.pE .ev-msg::before { content: "“"; color: var(--rust); margin-right: 1px; }
.pE .ev-msg::after { content: "”"; color: var(--rust); margin-left: 1px; }
.pE .ev.sys { background: var(--rust-soft); margin: 6px -16px; padding: 16px; border-radius: 4px; border: none; }
.pE .row.sys .date { border-bottom: none; padding-left: 16px; background: var(--rust-soft); border-radius: 4px 0 0 4px; margin-left: -16px; }
.pE .row.sys .ev { border-bottom: none; }
.pE .ev.sys .ev-who { font-family: var(--font-mono), monospace; font-size: 12px; color: var(--rust); letter-spacing: .12em; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; display:block; }
.pE .ev.sys .ev-title { font-family: var(--font-serif), serif; font-style: italic; font-size: 22px; color: var(--ink); line-height: 1.25; }

/* footnote */
.pE .foot-note { margin: 56px 0 0; padding: 22px 22px; background: #fff; border: 1px solid var(--hair); border-radius: 4px; font-size: 14.5px; line-height: 1.55; color: var(--ink-2); font-family: var(--font-serif), serif; font-style: italic; }
.pE .foot-note::before { content: "* "; color: var(--rust); font-style: normal; font-weight: 600; }
.pE .foot-note b { color: var(--ink); font-weight: 500; font-style: normal; font-family: var(--font-mono), monospace; font-size: 13.5px; }

/* close para */
.pE .close { padding: 48px 0 32px; }
.pE .close p { font-family: var(--font-serif), serif; font-size: 22px; font-style: italic; line-height: 1.45; color: var(--ink); max-width: 28ch; }

/* product reveal */
.pE .reveal { margin-top: 56px; padding: 32px 0 28px; border-top: 1px solid var(--hair-2); border-bottom: 1px solid var(--hair-2); }
.pE .reveal-eye { font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin-bottom: 18px; }
.pE .reveal h3 { font-family: var(--font-serif), serif; font-size: 36px; font-weight: 400; line-height: 1.12; letter-spacing: -.015em; margin-bottom: 18px; max-width: 22ch; }
.pE .reveal h3 em { font-style: italic; color: var(--rust); }
.pE .reveal ul { list-style: none; display:flex; flex-direction: column; gap: 6px; margin-bottom: 28px; }
.pE .reveal li { font-size: 16px; color: var(--ink-2); line-height: 1.6; padding-left: 22px; position: relative; }
.pE .reveal li::before { content:""; position:absolute; left: 0; top: 12px; width: 12px; height: 1px; background: var(--rust); }
.pE .reveal li b { color: var(--ink); font-weight: 500; }
.pE .reveal-cta { display:inline-flex; align-items:center; gap: 10px; padding: 14px 22px; background: var(--ink); color: var(--paper); border-radius: 2px; font-size: 14px; font-weight: 500; letter-spacing: .04em; }
.pE .reveal-cta:hover { background: var(--rust); }
.pE .reveal-cta::after { content: "→"; }

/* foot */
.pE .ft { padding-top: 26px; display:flex; justify-content: space-between; font-family: var(--font-mono), monospace; font-size: 11.5px; color: var(--muted); letter-spacing: .04em; }
.pE .ft a:hover { color: var(--ink); }

.pE .switcher { position: fixed; bottom: 18px; right: 18px; background: var(--ink); color: var(--paper); padding: 9px 14px; border-radius: 999px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; text-decoration: none; z-index: 10; }

@media (max-width: 640px) {
  .pE .col { padding: 24px 22px 60px; }
  .pE .log { grid-template-columns: 64px 1fr; }
  .pE .row .date { padding: 14px 14px 14px 0; }
  .pE h1 { font-size: clamp(40px, 11vw, 56px); }
  .pE .lede { font-size: 19px; }
}
`;

type Row =
  | { date: string; who: string; amt: string; msg?: string }
  | { date: string; sys: true; head: string; title: string };

const LOG: Row[] = [
  { date: "Oct 24", who: "Carla", amt: "+ €200", msg: "let's bring papà home." },
  { date: "Oct 24", who: "Marco", amt: "+ €500", msg: "for the wine alone." },
  { date: "Oct 25", who: "Anon. — L.", amt: "+ €30", msg: "tell him his accordion lessons saved my life." },
  { date: "Oct 25", who: "Beppe", amt: "+ €100", msg: "fratellone." },
  { date: "Oct 26", who: "Sara (granddaughter)", amt: "+ €40" },
  { date: "Oct 27", who: "Tio Vito", amt: "+ €250", msg: "tell him the lemon tree is still alive." },
  { date: "Oct 28", who: "Anon.", amt: "+ €15" },
  { date: "Oct 29", who: "Nonna Lucia", amt: "+ €600", msg: "i sold the ring i never wore. enjoy, both of you." },
  { date: "Oct 30", who: "Marco", amt: "+ €200", msg: "second wave." },
  { date: "Nov 01", who: "Stefano (his old student)", amt: "+ €120", msg: "1979, Conservatorio. he never let me quit. — S." },
  { date: "Nov 02", who: "Anon. — F.", amt: "+ €1,000", msg: "no message. he'll know." },
  { date: "Nov 04", who: "Carla", amt: "+ €300" },
  { date: "Nov 05", who: "Pia & Tommaso", amt: "+ €450", msg: "from amsterdam. we'd come if we could." },
  { date: "Nov 06", who: "The accordion club, Antwerp", amt: "+ €380", msg: "we passed the hat. all 23 of us." },
  { date: "Nov 07", who: "Marco", amt: "+ €200", msg: "third wave. last one i promise." },
  { date: "Nov 08", who: "Anon.", amt: "+ €50" },
  { date: "Nov 09", who: "Sara (granddaughter)", amt: "+ €60", msg: "saved from babysitting. ❤" },
  { date: "Nov 10", who: "Davide (the bartender)", amt: "+ €40", msg: "for that night he sang u napulitano till close." },
  { date: "Nov 10", who: "Anon. — V.", amt: "+ €900", msg: "buy him the good prosciutto." },
  { date: "Nov 11", who: "Carla", amt: "+ €15", msg: "this is the last one. three… two… one." },
  { date: "Nov 11", sys: true, head: "🔓 lid unlocked", title: "€6,400 reached. The flights were booked at 11:04 p.m." },
];

export default function PreviewE() {
  const [scroll, setScroll] = useState(0);
  const [fill, setFill] = useState(0);
  const artRef = useRef<HTMLDivElement>(null);
  const [artInView, setArtInView] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      setScroll(pct);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!artRef.current) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setArtInView(true)), { threshold: 0.4 });
    io.observe(artRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!artInView) return;
    let raf = 0; let t0 = 0;
    const animate = (t: number) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / 1400);
      setFill(k * 100);
      if (k < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [artInView]);

  return (
    <main className="pE">
      <style>{CSS}</style>
      <div className="top-prog"><div className="top-prog-fill" style={{ width: `${scroll}%` }} /></div>

      <div className="col">
        <div className="mast">
          <div className="mast-l"><b>jarfi</b><span>· stories</span></div>
          <div className="mast-r">№001 · Nov 2026</div>
        </div>

        <header className="head">
          <div className="eye">Case №001 · The Pierangelo Jar</div>
          <h1>A jar that <em>filled itself.</em></h1>
          <div className="lede">Eighty candles. Twenty-one contributors. Nineteen days.</div>
        </header>

        <section className="lead">
          <p>In November, <strong>Pierangelo</strong> turns eighty. He left Sicily in 1968 for work in Antwerp and hasn&apos;t been back since his mother&apos;s funeral. His daughter Carla wanted to fly him home for his birthday — and his eight grandkids, four siblings, two of his old students, and a man named Beppe who once shared a bunk with him in Catania.</p>
          <p>Six flights, three nights, one rented Fiat. <span className="acc">€6,400 by November 12th.</span> Nobody in the group owned crypto. Nobody wanted to learn.</p>
          <p>Carla opened a jar.</p>
        </section>

        <div ref={artRef} className="artifact">
          <div className="artifact-head">
            <div className="artifact-head-l">jarfi · jar</div>
            <div className="artifact-head-r">jarfi.xyz/j/papà-home</div>
          </div>
          <div className="artifact-body">
            <div className="art-name">papà comes home</div>
            <div className="art-tag">opens when full · deadline 12.11.2026</div>
            <div className="art-row"><span className="k">goal</span><span className="v">€6,400.00</span></div>
            <div className="art-row"><span className="k">currency</span><span className="v">USDC · Solana</span></div>
            <div className="art-row"><span className="k">yield</span><span className="v">~7.04% APY · Kamino</span></div>
            <div className="art-row"><span className="k">accepts</span><span className="v">Apple Pay · Google Pay · Visa · MC</span></div>
            <div className="art-bar"><div className="art-bar-fill" style={{ width: `${fill}%` }} /></div>
            <div className="art-prog">
              <span>€{(fill * 64).toFixed(2)}</span>
              <span className="pct">{fill.toFixed(0)}%</span>
              <span>of €6,400.00</span>
            </div>
          </div>
        </div>

        <section className="lead">
          <p>She sent the link to the family WhatsApp. Marco — her brother, the loud one — opened it at lunch and replied with a screenshot of the receipt.</p>
        </section>

        <div className="log-head">
          <h2>The log</h2>
          <div className="count">21 events · 19 days</div>
        </div>
        <div className="log">
          {LOG.map((r, i) =>
            "sys" in r ? (
              <div key={i} className="row sys">
                <div className="date">{r.date}</div>
                <div className="ev sys">
                  <span className="ev-who">{r.head}</span>
                  <div className="ev-title">{r.title}</div>
                </div>
              </div>
            ) : (
              <div key={i} className="row">
                <div className="date">{r.date}</div>
                <div className="ev">
                  <div className="ev-head">
                    <div className="ev-who"><b>{r.who}</b></div>
                    <div className="ev-amt">{r.amt}</div>
                  </div>
                  {r.msg && <div className="ev-msg">{r.msg}</div>}
                </div>
              </div>
            )
          )}
        </div>

        <div className="foot-note">
          Over those nineteen days the money didn&apos;t sit still. It earned <b>€37.18</b> in interest, lending itself out as USDC through Kamino. Nobody touched anything. That&apos;s how this works — the moment a coin lands in the jar, it starts compounding.
        </div>

        <section className="close">
          <p>Carla booked the flights at 11:04 p.m. on a Wednesday. Pierangelo finds out at his birthday dinner. He cries a little. The accordion comes out around midnight.</p>
        </section>

        <section className="reveal">
          <div className="reveal-eye">↳ This is jarfi.</div>
          <h3>Share a link. <em>Anyone with a card chips in.</em></h3>
          <ul>
            <li><b>No wallets, no seed phrases.</b> Contributors pay with the card already in their phone.</li>
            <li><b>~7% APY, automatically.</b> Every euro starts compounding the moment it lands.</li>
            <li><b>Locks until the goal is hit.</b> No early withdrawals to tempt you off the plan.</li>
            <li><b>$0 fees</b> to create. We earn a thin slice of the yield.</li>
          </ul>
          <Link href="/create" className="reveal-cta">Open a jar</Link>
        </section>

        <div className="ft">
          <span>Case №002 coming.</span>
          <span>Got one to tell? <a href="mailto:stories@jarfi.xyz" style={{ color: "var(--rust)" }}>stories@jarfi.xyz</a></span>
        </div>
      </div>
      <Link href="/preview" className="switcher">← variants</Link>
    </main>
  );
}
