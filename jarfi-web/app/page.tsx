"use client";

import { useState } from "react";
import Link from "next/link";

/* ── helpers ── */
function calcValues(monthly: number, years: number, gifts: number) {
  const n = years * 12, rB = 0.02 / 12, rJ = 0.055 / 12;
  return {
    bank:  Math.round(monthly * ((Math.pow(1 + rB, n) - 1) / rB) + gifts * Math.pow(1 + rB, n)),
    jarfi: Math.round(monthly * ((Math.pow(1 + rJ, n) - 1) / rJ) + gifts * Math.pow(1 + rJ, n)),
  };
}
function fmt(n: number) { return "$" + Math.round(n).toLocaleString(); }

/* ── design tokens (mapped from design file) ── */
const T = {
  bg:     "var(--bg)",
  bg2:    "#F6F7F5",
  bg3:    "#EDEEE9",
  text:   "var(--text-primary)",
  text2:  "#555555",
  text3:  "var(--text-tertiary)",
  border: "#E4E5E0",
  green:  "var(--green)",
  greenBg:"#ECFDF5",
  font:   "var(--font)",
  r:      "12px",
  w:      "1080px",
  px:     "40px",
};

/* ── shared button styles ── */
const btnDark: React.CSSProperties = {
  display:"inline-flex", alignItems:"center", gap:7,
  fontSize:14, fontWeight:600, padding:"12px 22px", borderRadius:9,
  border:"none", cursor:"pointer", fontFamily:T.font,
  background:T.text, color:"#fff", textDecoration:"none",
};
const btnOutline: React.CSSProperties = {
  display:"inline-flex", alignItems:"center", gap:7,
  fontSize:14, fontWeight:600, padding:"11px 20px", borderRadius:9,
  border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:T.font,
  background:"transparent", color:T.text2, textDecoration:"none",
};
const wrap: React.CSSProperties = { maxWidth:T.w, margin:"0 auto", padding:`0 ${T.px}` };
const sec: React.CSSProperties  = { padding:"64px 0" };
const secAlt: React.CSSProperties = { ...sec, background:T.bg2 };

/* ── Section label / title / sub ── */
function SecLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", color:T.text3, marginBottom:8 }}>{children}</div>;
}
function SecTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:34, fontWeight:600, letterSpacing:"-1px", lineHeight:1.1, marginBottom:10 }}>{children}</div>;
}
function SecSub({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize:15, color:T.text2, lineHeight:1.65, maxWidth:520, margin:0, ...style }}>{children}</p>;
}

/* ── Progress bar ── */
function Prog({ pct }: { pct: number }) {
  return (
    <div style={{ height:4, background:T.border, borderRadius:2, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:T.green, borderRadius:2 }} />
    </div>
  );
}

/* ── FAQ item ── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(v => !v)}
      style={{ background: open ? T.bg2 : T.bg, border:`1px solid ${T.border}`, borderRadius:T.r, padding:20, cursor:"pointer" }}
    >
      <div style={{ fontSize:14, fontWeight:600, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
        <span>{q}</span>
        <span style={{ fontSize:12, color:T.text3, flexShrink:0, transform: open ? "rotate(180deg)" : "none", transition:"transform .2s" }}>▾</span>
      </div>
      {open && <div style={{ fontSize:13, color:T.text2, lineHeight:1.65, marginTop:10 }}>{a}</div>}
    </div>
  );
}

/* ── SliderRow ── */
function SliderRow({ label, value, display, min, max, step, onChange }: {
  label: string; value: number; display: string;
  min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
        <span style={{ fontSize:13, fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.5px" }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} style={{ width:"100%" }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
export default function Landing() {
  const [monthly, setMonthly] = useState(100);
  const [years,   setYears]   = useState(10);
  const [gifts,   setGifts]   = useState(0);
  const { bank, jarfi } = calcValues(monthly, years, gifts);

  return (
    <div style={{ fontFamily:T.font, background:T.bg, color:T.text, minHeight:"100vh" }}>

      {/* ── NAV ── */}
      <nav style={{ borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, background:T.bg, zIndex:100 }}>
        <div style={{ ...wrap, display:"flex", alignItems:"center", justifyContent:"space-between", height:56 }}>
          <div style={{ display:"flex", alignItems:"center", gap:24 }}>
            <div style={{ fontSize:17, fontWeight:700, letterSpacing:"-.4px" }}>
              jar<span style={{ color:T.green }}>fi</span>
            </div>
          </div>
          <div className="nav-links-desktop" style={{ display:"flex", gap:24 }}>
            {["Jar types:#jar-types","How it works:#how","Calculator:#calculator","FAQ:#faq"].map(s => {
              const [label, href] = s.split(":");
              return <a key={href} href={href} style={{ fontSize:13, color:T.text2, textDecoration:"none" }}>{label}</a>;
            })}
          </div>
          <Link href="/dashboard" style={{ fontSize:13, fontWeight:600, background:T.text, color:"#fff", padding:"8px 16px", borderRadius:8, textDecoration:"none" }}>
            Create a jar
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{ ...wrap }}>
        <div className="hero-grid" style={{ display:"grid", gridTemplateColumns:"1fr 400px", gap:64, alignItems:"center", padding:"60px 0 56px" }}>
          {/* left */}
          <div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:T.greenBg, color:T.green, fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20, marginBottom:18, letterSpacing:".4px", textTransform:"uppercase" }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:T.green, flexShrink:0 }} />
              Onchain savings for everyone
            </div>
            <h1 style={{ fontSize:48, fontWeight:600, lineHeight:1.07, letterSpacing:"-2px", marginBottom:16, margin:"0 0 16px" }}>
              Your savings jar,<br /><em style={{ fontStyle:"normal", color:T.green }}>shared with anyone.</em>
            </h1>
            <p style={{ fontSize:16, lineHeight:1.65, color:T.text2, marginBottom:28, maxWidth:400 }}>
              Create a jar, set a goal, and let family or friends top it up instantly — your money earns 5.5% APY automatically, onchain.
            </p>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <Link href="/dashboard" style={btnDark}>Create a jar →</Link>
              <Link href="/dashboard" style={btnOutline}>See dashboard</Link>
            </div>
          </div>
          {/* right — demo jar card */}
          <div>
            <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:18, overflow:"hidden", boxShadow:"0 2px 24px rgba(0,0,0,.07)" }}>
              <div style={{ height:100, background:"linear-gradient(135deg,#d1fae5,#a7f3d0)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:42 }}>🎂</div>
              <div style={{ padding:"18px 20px" }}>
                <div style={{ fontSize:15, fontWeight:600, marginBottom:2 }}>Eva&apos;s 18th Birthday</div>
                <div style={{ fontSize:12, color:T.text3, marginBottom:14 }}>Opens Jan 2034 · 10 years</div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:T.greenBg, color:T.green, fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, marginBottom:12 }}>
                  ⚡ 5.5% APY — earning automatically
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:13, color:T.text2 }}>Bank savings (2%)</span>
                    <span style={{ fontSize:13, fontWeight:500, color:T.text3 }}>$21,840</span>
                  </div>
                  <div style={{ height:1, background:T.border }} />
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:13, color:T.text, fontWeight:600 }}>With Jarfi</span>
                    <span style={{ fontSize:20, fontWeight:700, color:T.green, letterSpacing:"-.5px" }}>$38,420</span>
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.text3, marginBottom:5 }}>
                    <span>$14,200 saved</span><span>37%</span>
                  </div>
                  <Prog pct={37} />
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center" }}>
                    <div style={{ display:"flex" }}>
                      {[["IV","#d1fae5"],["M","#dbeafe"],["G","#fce7f3"],["A","#fef3c7"],["+8","#ede9fe"]].map(([lbl, bg]) => (
                        <div key={lbl} style={{ width:22, height:22, borderRadius:"50%", border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:T.text2, marginLeft: lbl === "IV" ? 0 : -5, background: bg as string }}>
                          {lbl}
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize:11, color:T.text3, marginLeft:8 }}>12 contributors</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── JAR TYPES ── */}
      <section id="jar-types" style={secAlt}>
        <div style={wrap}>
          <SecLabel>What can you save for?</SecLabel>
          <SecTitle>A jar for every goal</SecTitle>
          <SecSub>Each jar has a purpose. Set rules, share it, and let it grow — automatically at 5.5% APY.</SecSub>
          <div className="jar-types-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginTop:36 }}>
            {[
              { icon:"⏳", name:"Time-lock jar", desc:"Funds unlock on a set date. Perfect for milestones — a birthday, graduation, or retirement.", eg:"Eva's 18th — unlocks Jan 2034, grows to $8,940" },
              { icon:"🎯", name:"Goal jar",      desc:"Save until you hit a target. A car, a holiday, a downpayment — whatever you're working toward.", eg:"Family Bali trip — goal $4,000" },
              { icon:"👥", name:"Shared jar",    desc:"Multiple people contribute to one jar. Great for family funds or groups saving together.", eg:"One link sent in the family chat — everyone chips in, one child gets a gift they'll never forget." },
              { icon:"🎁", name:"Gift jar",      desc:"Share a link. Anyone can top it up with Apple Pay or a card. No wallet, no sign-up.", eg:"20 colleagues chip in for a birthday — one URL, one jar" },
            ].map(t => (
              <div key={t.name} style={{ border:`1px solid ${T.border}`, borderRadius:T.r, padding:20, background:T.bg }}>
                <div style={{ fontSize:26, marginBottom:12 }}>{t.icon}</div>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:5, letterSpacing:"-.2px" }}>{t.name}</div>
                <div style={{ fontSize:13, color:T.text2, lineHeight:1.55 }}>{t.desc}</div>
                <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.border}`, fontSize:11, color:T.text3, lineHeight:1.5 }}>
                  <strong style={{ color:T.text2, fontWeight:500 }}>Example:</strong> {t.eg}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — ONRAMP ── */}
      <section id="how" style={sec}>
        <div style={wrap}>
          <div className="onramp-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"center" }}>
            {/* left */}
            <div>
              <SecLabel>No crypto required</SecLabel>
              <SecTitle>Pay with Apple Pay.<br />Grow onchain.</SecTitle>
              <SecSub style={{ marginBottom:28 }}>Contributing is as easy as buying a coffee. The magic — converting your payment to onchain yield — happens in the background.</SecSub>
              <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                {[
                  { n:"1", title:"Owner creates a jar",         desc:"Set a name, goal, and timeline. Your jar gets a unique shareable link." },
                  { n:"2", title:"Share the link with anyone",  desc:"Family and friends open a URL — no account, no wallet needed to contribute." },
                  { n:"3", title:"They pay by card or Apple Pay", desc:"Their payment converts and lands in your jar automatically — no crypto setup needed." },
                  { n:"4", title:"Money earns yield automatically", desc:"Funds are automatically staked onchain and auto-compound over time. When the time comes, withdraw to any wallet or bank." },
                ].map(s => (
                  <div key={s.n} style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", background:T.text, color:"#fff", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>{s.n}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:3 }}>{s.title}</div>
                      <div style={{ fontSize:13, color:T.text2, lineHeight:1.5 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* right — phone mockup */}
            <div>
              <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:22, padding:18, boxShadow:"0 8px 36px rgba(0,0,0,.1)", maxWidth:268, margin:"0 auto" }}>
                <div style={{ fontSize:13, fontWeight:600, textAlign:"center", marginBottom:3 }}>Contribute to Eva&apos;s jar 🎂</div>
                <div style={{ fontSize:11, color:T.text3, textAlign:"center", marginBottom:16 }}>jarfi.xyz/gift/eva-birthday</div>
                <div style={{ background:T.bg2, borderRadius:9, padding:12, marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>Eva&apos;s 18th Birthday</div>
                  <div style={{ fontSize:11, color:T.text3, marginBottom:8 }}>$3,420 raised · Goal $10,000</div>
                  <Prog pct={34} />
                </div>
                <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                  {["$25","$50","$100"].map((v,i) => (
                    <div key={v} style={{ flex:1, textAlign:"center", padding:"9px 0", borderRadius:8, border:`1px solid ${i===1?T.text:T.border}`, fontSize:14, fontWeight:600, background:i===1?T.text:"var(--bg)", color:i===1?"#fff":T.text }}>
                      {v}
                    </div>
                  ))}
                </div>
                <div style={{ width:"100%", padding:12, borderRadius:9, background:"#000", color:"#fff", fontSize:13, fontWeight:600, textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                   Pay with Apple Pay
                </div>
                <div style={{ display:"flex", gap:5, justifyContent:"center", marginTop:8, flexWrap:"wrap" }}>
                  {["Google Pay","Visa / MC","SEPA","Bank transfer"].map(m => (
                    <div key={m} style={{ fontSize:10, color:T.text3, background:T.bg2, border:`1px solid ${T.border}`, borderRadius:5, padding:"3px 7px" }}>{m}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RECURRING ── */}
      <section style={secAlt}>
        <div style={wrap}>
          <div className="recurring-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"center" }}>
            <div>
              <SecLabel>Set it and forget it</SecLabel>
              <SecTitle>Automatic monthly<br />deposits from your wallet</SecTitle>
              <SecSub style={{ marginBottom:28 }}>Turn on recurring payments and your wallet tops up the jar every month — automatically. No manual transfers, no forgetting.</SecSub>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {[
                  { icon:"🔄", title:"Monthly auto-deposit",    desc:"Set an amount once. Funds move from your wallet to the jar on the same day each month." },
                  { icon:"⏸️", title:"Pause or cancel anytime", desc:"Change the amount, skip a month, or stop completely — always in your control." },
                  { icon:"📩", title:"Get notified",            desc:"Receive a notification each time a deposit goes through, so you always know." },
                ].map(p => (
                  <div key={p.title} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                    <div style={{ width:34, height:34, borderRadius:9, background:T.bg3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{p.icon}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{p.title}</div>
                      <div style={{ fontSize:13, color:T.text2, lineHeight:1.5 }}>{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* recurring demo card */}
            <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:22, padding:22, boxShadow:"0 8px 36px rgba(0,0,0,.1)", maxWidth:340, margin:"0 auto", width:"100%" }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Eva&apos;s 18th Birthday · Recurring deposits</div>
              {[
                { name:"May deposit",  date:"May 1, 2026 · auto",      status:"Done", done:true },
                { name:"April deposit",date:"Apr 1, 2026 · auto",      status:"Done", done:true },
                { name:"June deposit", date:"Jun 1, 2026 · upcoming",  status:"Next", done:false },
              ].map(r => (
                <div key={r.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:30, height:30, borderRadius:8, background:T.bg2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🎂</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{r.name}</div>
                      <div style={{ fontSize:11, color:T.text3 }}>{r.date}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>$100</div>
                    <div style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:20, background:r.done?T.greenBg:"#FEF3C7", color:r.done?T.green:"#92400E" }}>{r.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SHARE ── */}
      <section style={sec}>
        <div style={wrap}>
          <div className="share-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"center" }}>
            <div>
              <SecLabel>Built for non-crypto people</SecLabel>
              <SecTitle>Share a link.<br />That&apos;s it.</SecTitle>
              <SecSub style={{ marginBottom:28 }}>Grandma doesn&apos;t need a wallet. Your colleague doesn&apos;t need an account. Anyone with a phone contributes in under 30 seconds.</SecSub>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {[
                  { icon:"🔗", title:"One link per jar",            desc:"Every jar gets a unique URL. Send it via WhatsApp, Telegram, or email." },
                  { icon:"⚡", title:"No sign-up for contributors", desc:"They open the link, pick an amount, tap Pay. Zero friction, zero accounts." },
                  { icon:"🌍", title:"Works across countries",       desc:"Contributors pay in their local currency — USD, EUR, GBP, UAH and more." },
                ].map(p => (
                  <div key={p.title} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                    <div style={{ width:34, height:34, borderRadius:9, background:T.bg3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{p.icon}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{p.title}</div>
                      <div style={{ fontSize:13, color:T.text2, lineHeight:1.5 }}>{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* messenger mockup */}
            <div style={{ background:"#E9EEF3", borderRadius:16, padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, paddingBottom:12, borderBottom:"1px solid rgba(0,0,0,.06)" }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"#25D366", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>💬</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Family chat</div>
                  <div style={{ fontSize:11, color:"#72808E" }}>6 members</div>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {/* sent */}
                <div style={{ alignSelf:"flex-end", maxWidth:"85%" }}>
                  <div style={{ padding:"9px 12px", borderRadius:"12px 12px 3px 12px", fontSize:13, lineHeight:1.45, background:"#DCF8C6", color:"#111" }}>
                    Hey! I created a savings jar for Eva&apos;s 18th 🎂 Anyone can add money here:
                    <div style={{ background:"#fff", borderRadius:8, overflow:"hidden", marginTop:8, border:"1px solid rgba(0,0,0,.08)" }}>
                      <div style={{ height:80, background:"linear-gradient(135deg,#d1fae5,#a7f3d0)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🎂</div>
                      <div style={{ padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:T.green, fontWeight:600, textTransform:"uppercase", marginBottom:3 }}>jarfi.xyz</div>
                        <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>Eva&apos;s 18th Birthday</div>
                        <div style={{ fontSize:11, color:"#72808E" }}>$3,420 saved · Tap to contribute</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:"#72808E", marginTop:3, textAlign:"right" }}>10:42 ✓✓</div>
                </div>
                {/* recv 1 */}
                <div style={{ alignSelf:"flex-start", maxWidth:"85%" }}>
                  <div style={{ padding:"9px 12px", borderRadius:"12px 12px 12px 3px", fontSize:13, lineHeight:1.45, background:"#fff", color:"#111" }}>
                    Wonderful! Just added $50 with Apple Pay 🙌
                  </div>
                  <div style={{ fontSize:10, color:"#72808E", marginTop:3 }}>10:44</div>
                </div>
                {/* recv 2 */}
                <div style={{ alignSelf:"flex-start", maxWidth:"85%" }}>
                  <div style={{ padding:"9px 12px", borderRadius:"12px 12px 12px 3px", fontSize:13, lineHeight:1.45, background:"#fff", color:"#111" }}>
                    Done! Paid by card, so easy 💚
                  </div>
                  <div style={{ fontSize:10, color:"#72808E", marginTop:3 }}>10:47</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALCULATOR ── */}
      <section id="calculator" style={secAlt}>
        <div style={wrap}>
          <SecLabel>See your future</SecLabel>
          <SecTitle>How much will you actually have?</SecTitle>
          <SecSub>Small contributions compound over time. See the difference a Jarfi yield makes vs. a regular bank.</SecSub>
          <div className="calc-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:56, alignItems:"start", marginTop:36 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
              <SliderRow label="Monthly contribution" value={monthly} display={`$${monthly}`} min={10} max={500} step={10} onChange={setMonthly} />
              <SliderRow label="Years" value={years} display={`${years} ${years===1?"yr":"yrs"}`} min={1} max={25} step={1} onChange={setYears} />
              <SliderRow label="One-off gifts" value={gifts} display={`$${gifts}`} min={0} max={5000} step={100} onChange={setGifts} />
            </div>
            <div>
              <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:14, padding:24 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.text3, letterSpacing:".5px", textTransform:"uppercase", paddingBottom:12, borderBottom:`1px solid ${T.border}`, marginBottom:4 }}>
                  After {years} {years===1?"year":"years"}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ fontSize:13, color:T.text2 }}>Bank savings (2% APY)</span>
                  <span style={{ fontSize:15, fontWeight:700, color:T.text3 }}>{fmt(bank)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0" }}>
                  <span style={{ fontSize:13, color:T.text, fontWeight:600 }}>With Jarfi (5.5% APY)</span>
                  <span style={{ fontSize:30, fontWeight:700, color:T.green, letterSpacing:"-1px" }}>{fmt(jarfi)}</span>
                </div>
                <div style={{ fontSize:11, color:T.text3, marginTop:14, lineHeight:1.5 }}>
                  Based on 5.5% APY onchain staking yield. Past performance does not guarantee future results.
                </div>
              </div>
              <Link href="/dashboard" style={{ ...btnDark, marginTop:14, width:"100%", justifyContent:"center", boxSizing:"border-box" }}>
                Start a jar →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={sec}>
        <div style={wrap}>
          <SecLabel>Questions</SecLabel>
          <SecTitle>FAQ</SecTitle>
          <div className="faq-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:36 }}>
            <FaqItem q="Is my money safe? Where is it stored?" a="Your funds are held in a non-custodial smart contract on Solana — meaning only you control them. Jarfi never has access to your money. The smart contract is open source." />
            <FaqItem q="What is staking / yield?" a="Staking means your funds are put to work in a DeFi lending protocol (Kamino) that earns interest. Jarfi does this automatically — you don't need to know anything about DeFi. Current estimated yield: 5.5–8.2% APY." />
            <FaqItem q="Do contributors need a crypto wallet?" a="No. Contributors open a link and pay by Apple Pay, Google Pay, card, or bank transfer. No wallet, no sign-up, no crypto knowledge needed. The conversion happens automatically in the background." />
            <FaqItem q="How do I withdraw my money?" a="When the jar unlocks (on the date you set), you can withdraw directly to your wallet. Offramp to a bank account is also supported in most countries." />
            <FaqItem q="Which countries and currencies are supported?" a="Jarfi works globally. Contributors can pay in USD, EUR, GBP, UAH, and 40+ other currencies. The owner receives funds onchain in USDC. Available in 160+ countries." />
            <FaqItem q="What if I lose access to my wallet?" a="Because Jarfi is non-custodial, losing your wallet seed phrase means losing access to funds — just like any crypto wallet. We strongly recommend using a hardware wallet or a reputable wallet with cloud backup." />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:`1px solid ${T.border}`, padding:"28px 0" }}>
        <div style={{ ...wrap, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:15, fontWeight:700 }}>jar<span style={{ color:T.green }}>fi</span></div>
          <div style={{ fontSize:12, color:T.text3 }}>© 2026 Jarfi · Onchain savings for everyone</div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 960px) {
          .hero-grid     { grid-template-columns: 1fr !important; gap: 36px !important; padding: 40px 0 36px !important; }
          .jar-types-grid { grid-template-columns: 1fr 1fr !important; }
          .onramp-grid, .recurring-grid, .share-grid, .calc-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
          .faq-grid      { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .nav-links-desktop { display: none !important; }
          .jar-types-grid { grid-template-columns: 1fr !important; }
        }
        input[type="range"] { -webkit-appearance:none; width:100%; height:3px; background:#E4E5E0; border-radius:2px; outline:none; cursor:pointer; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; background:#111; border-radius:50%; cursor:pointer; }
      `}</style>
    </div>
  );
}
