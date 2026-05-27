"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const CSS = `
.pD { --bg: #aab9c5; --bg-2: #b9c8d3; --paper: #ffffff; --in: #ffffff; --out: #effdde; --ink: #000; --muted: #707579; --link: #3390ec; --sys: rgba(0,0,0,.06); --sys-ink: #4a4a4a; --green: #4fae4e; --tg-blue: #3390ec; min-height: 100vh; background: var(--bg); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif; -webkit-font-smoothing: antialiased; color: var(--ink); position: relative; }
.pD * { box-sizing: border-box; margin:0; padding:0; }
.pD a { color: inherit; text-decoration: none; }

.pD .wallpaper { position: fixed; inset: 0; background:
  radial-gradient(40% 30% at 20% 10%, rgba(255,255,255,.18), transparent 70%),
  radial-gradient(50% 40% at 90% 60%, rgba(0,0,0,.06), transparent 70%),
  linear-gradient(160deg, #b3c6d6 0%, #a3b7c6 60%, #95acbf 100%);
  pointer-events: none;
}
.pD .wallpaper::before { content:""; position:absolute; inset:0; background-image:
  radial-gradient(rgba(255,255,255,.08) 1px, transparent 1.5px),
  radial-gradient(rgba(0,0,0,.05) 1px, transparent 1.5px);
  background-size: 22px 22px, 14px 14px; background-position: 0 0, 11px 7px; opacity: .8;
}

.pD .stage { position: relative; max-width: 480px; margin: 0 auto; min-height: 100vh; display:flex; flex-direction: column; }

/* CHAT HEADER */
.pD .ch-head { background: var(--paper); padding: 10px 14px; display:flex; align-items:center; gap: 10px; border-bottom: 1px solid rgba(0,0,0,.06); position: sticky; top: 0; z-index: 5; }
.pD .ch-back { color: var(--tg-blue); font-size: 17px; }
.pD .ch-av { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #ffb86c, #ff7e5f); display:flex; align-items:center; justify-content:center; color: #fff; font-weight: 600; font-size: 16px; }
.pD .ch-meta { flex: 1; min-width: 0; }
.pD .ch-name { font-size: 16px; font-weight: 600; letter-spacing: -.01em; display:flex; align-items:center; gap:6px; }
.pD .ch-sub { font-size: 13px; color: var(--muted); margin-top: 1px; }
.pD .ch-sub b { color: var(--green); font-weight: 400; }
.pD .ch-icons { display:flex; gap: 14px; color: var(--muted); font-size: 20px; }

/* PINNED jar status */
.pD .pin { background: var(--paper); padding: 9px 14px 11px; display:flex; align-items:center; gap: 10px; border-bottom: 1px solid rgba(0,0,0,.06); position: sticky; top: 59px; z-index: 4; }
.pD .pin-bar { width: 3px; align-self: stretch; background: var(--tg-blue); border-radius: 2px; }
.pD .pin-body { flex: 1; min-width: 0; }
.pD .pin-l { font-size: 13px; color: var(--tg-blue); font-weight: 600; }
.pD .pin-t { font-size: 14px; color: var(--ink); margin-top: 1px; display:flex; align-items:center; gap: 6px; }
.pD .pin-t b { font-variant-numeric: tabular-nums; }
.pD .pin-prog { height: 3px; background: rgba(0,0,0,.08); border-radius: 2px; margin-top: 6px; overflow: hidden; }
.pD .pin-prog-fill { height: 100%; background: linear-gradient(90deg, var(--tg-blue), var(--green)); width: 24%; transition: width 1s ease; }
.pD .pin-num { font-size: 11px; color: var(--muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
.pD .pin-pct { color: var(--green); }

/* FEED */
.pD .feed { flex: 1; padding: 18px 10px 14px; display:flex; flex-direction: column; gap: 2px; }
.pD .day { align-self: center; background: rgba(0,0,0,.18); color: #fff; font-size: 12px; padding: 4px 12px; border-radius: 12px; margin: 8px 0 14px; font-weight: 500; backdrop-filter: blur(8px); }

.pD .msg { display:flex; gap: 6px; margin-top: 2px; }
.pD .msg.out { justify-content: flex-end; }
.pD .msg .av { width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; display:flex; align-items:center; justify-content:center; color:#fff; font-size: 12.5px; font-weight: 600; align-self: flex-end; }
.pD .msg.same .av { visibility: hidden; height: 0; width: 30px; margin: 0; }
.pD .bub { max-width: 78%; background: var(--in); padding: 6px 10px 7px; border-radius: 12px; font-size: 15px; line-height: 1.32; position: relative; box-shadow: 0 1px 0 rgba(0,0,0,.05); word-wrap: break-word; }
.pD .msg.out .bub { background: var(--out); }
.pD .bub .nm { font-size: 13px; font-weight: 600; color: var(--tg-blue); margin-bottom: 1px; line-height: 1.1; }
.pD .bub .nm.c2 { color: #e17076; } .pD .bub .nm.c3 { color: #faa757; } .pD .bub .nm.c4 { color: #a695e7; } .pD .bub .nm.c5 { color: #7bc862; } .pD .bub .nm.c6 { color: #65aadd; }
.pD .bub .tm { font-size: 11px; color: var(--muted); float: right; margin: 6px 0 0 8px; line-height: 1; padding-bottom: 1px; }
.pD .msg.out .bub .tm::after { content:" ✓✓"; color: var(--tg-blue); }
.pD .bub .react { display:inline-flex; align-items:center; gap: 2px; background: #e8f3ff; color: var(--tg-blue); padding: 2px 7px; border-radius: 10px; font-size: 12px; margin: 6px 4px 0 0; font-weight: 500; }
.pD .bub .react b { color: var(--tg-blue); font-weight: 500; margin-left: 2px; font-variant-numeric: tabular-nums; }

/* Avatars colors */
.pD .av.c1 { background: linear-gradient(135deg,#5ca8e6,#3390ec); }
.pD .av.c2 { background: linear-gradient(135deg,#ff8a6e,#e17076); }
.pD .av.c3 { background: linear-gradient(135deg,#ffcd71,#faa757); }
.pD .av.c4 { background: linear-gradient(135deg,#b7a4ee,#a695e7); }
.pD .av.c5 { background: linear-gradient(135deg,#9ed68b,#7bc862); }
.pD .av.c6 { background: linear-gradient(135deg,#86c2eb,#65aadd); }

/* Link preview card (the jar) */
.pD .card { margin-top: 4px; border-left: 3px solid var(--tg-blue); padding: 4px 0 4px 8px; }
.pD .card-t { font-size: 14px; font-weight: 600; color: var(--tg-blue); }
.pD .card-d { font-size: 13.5px; color: var(--ink); margin-top: 1px; line-height: 1.3; }
.pD .card-img { margin-top: 6px; height: 110px; border-radius: 8px; background:
  radial-gradient(60% 80% at 70% 30%, rgba(255,255,255,.4), transparent 70%),
  linear-gradient(160deg, #6fa68c 0%, #3e7058 100%);
  position: relative; overflow: hidden; display:flex; align-items:flex-end; padding: 12px; color: #fff;
}
.pD .card-img::before { content:"🫙"; position:absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 64px; filter: drop-shadow(0 4px 8px rgba(0,0,0,.2)); }
.pD .card-img-meta { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; opacity: .9; }
.pD .card-img-num { font-size: 22px; font-weight: 700; letter-spacing: -.02em; line-height: 1; }
.pD .card-url { font-size: 12px; color: var(--muted); margin-top: 4px; font-family: ui-monospace, monospace; }

/* Money-drop system bubble */
.pD .drop { align-self: center; background: rgba(255,255,255,.92); padding: 8px 14px 9px; border-radius: 14px; box-shadow: 0 1px 0 rgba(0,0,0,.05); margin: 6px 0; display:inline-flex; flex-direction: column; align-items:center; gap: 2px; max-width: 78%; }
.pD .drop-r { display:inline-flex; align-items:center; gap: 8px; font-size: 14.5px; color: var(--ink); }
.pD .drop-r b { color: var(--green); font-weight: 600; font-variant-numeric: tabular-nums; }
.pD .drop-msg { font-size: 13px; color: var(--muted); font-style: italic; }
.pD .drop-coin { font-size: 16px; }

/* COMPOSER becomes CTA */
.pD .cta-wrap { background: linear-gradient(180deg, rgba(255,255,255,0) 0%, var(--paper) 30%); padding: 28px 16px 22px; position: sticky; bottom: 0; z-index: 5; }
.pD .cta-line { font-size: 14.5px; color: var(--muted); text-align: center; margin-bottom: 14px; line-height: 1.45; }
.pD .cta-line b { color: var(--ink); font-weight: 600; }
.pD .cta-form { display:flex; gap: 8px; background: var(--paper); border: 1px solid rgba(0,0,0,.08); border-radius: 22px; padding: 5px 5px 5px 16px; box-shadow: 0 4px 16px -4px rgba(0,0,0,.15); align-items:center; }
.pD .cta-form input { flex: 1; border: none; outline: none; font-size: 16px; background: transparent; padding: 8px 0; font-family: inherit; }
.pD .cta-form input::placeholder { color: #b3b3b3; }
.pD .cta-form button { background: var(--tg-blue); color: #fff; border: none; padding: 0 16px; height: 36px; border-radius: 18px; font-size: 14.5px; font-weight: 600; cursor: pointer; font-family: inherit; display:inline-flex; align-items:center; gap: 6px; }
.pD .cta-form button:hover { background: #1d7fd9; }
.pD .cta-foot { display:flex; gap: 16px; justify-content: center; margin-top: 12px; font-size: 11.5px; color: var(--muted); letter-spacing: .02em; }
.pD .cta-foot span { display:inline-flex; align-items:center; gap: 4px; }

/* Switcher */
.pD .switcher { position: fixed; bottom: 14px; left: 14px; background: rgba(0,0,0,.7); color: #fff; padding: 8px 12px; border-radius: 999px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; text-decoration: none; backdrop-filter: blur(8px); z-index: 10; }

@media (max-width: 520px){
  .pD .stage { max-width: 100%; }
}
`;

type Av = "c1" | "c2" | "c3" | "c4" | "c5" | "c6";
type Msg =
  | { kind: "day"; t: string }
  | { kind: "txt"; who: string; av: Av; out?: boolean; same?: boolean; text: string; time: string; reacts?: { e: string; n: number }[] }
  | { kind: "card"; who: string; av: Av; out?: boolean; same?: boolean; time: string; pre?: string; cardTitle: string; cardDesc: string; cardUrl: string; cardLabel: string; cardNum: string }
  | { kind: "drop"; coin: string; who: string; amount: string; msg?: string };

const FEED: Msg[] = [
  { kind: "day", t: "пятница" },
  { kind: "txt", who: "маша", av: "c2", text: "пацаны короче. едем на бали в декабре", time: "19:42" },
  { kind: "txt", who: "маша", av: "c2", same: true, text: "хватит уже это обсуждать пятый год", time: "19:42" },
  { kind: "txt", who: "дима", av: "c1", out: true, text: "сколько надо то", time: "19:43" },
  { kind: "txt", who: "маша", av: "c2", text: "200к на четверых. с жильём", time: "19:43" },
  { kind: "card", who: "маша", av: "c2", same: true, time: "19:44", pre: "вот, заводите сюда:", cardTitle: "Бали 2026 🫙", cardDesc: "Откроется когда соберём 200 000 ₽. До декабря.", cardUrl: "jarfi.xyz/j/bali-2026", cardLabel: "цель · 200 000 ₽", cardNum: "0 ₽" },
  { kind: "txt", who: "дима", av: "c1", out: true, text: "это что блять, крипта?", time: "19:45" },
  { kind: "txt", who: "маша", av: "c2", text: "нет. просто ссылка. картой кидаешь", time: "19:45" },
  { kind: "txt", who: "маша", av: "c2", same: true, text: "и оно само лежит на стейкинге. процент капает пока ждём", time: "19:46" },
  { kind: "txt", who: "дима", av: "c1", out: true, text: "а", time: "19:46" },
  { kind: "txt", who: "дима", av: "c1", out: true, same: true, text: "ну ок держи", time: "19:46" },
  { kind: "drop", coin: "💸", who: "Дима", amount: "+ 5 000 ₽", msg: "погнали уже" },
  { kind: "txt", who: "катя", av: "c3", text: "🔥🔥🔥", time: "19:48", reacts: [{ e: "❤️", n: 2 }] },
  { kind: "txt", who: "катя", av: "c3", same: true, text: "я в деле", time: "19:48" },
  { kind: "drop", coin: "💸", who: "Катя", amount: "+ 3 000 ₽", msg: "пока всё что есть, докину" },
  { kind: "txt", who: "жорик", av: "c4", text: "вы серьёзно", time: "19:51" },
  { kind: "txt", who: "жорик", av: "c4", same: true, text: "это самая адекватная идея за весь чат с 2021 года", time: "19:51" },
  { kind: "drop", coin: "🏦", who: "Жорик", amount: "+ 10 000 ₽", msg: "вписываюсь полностью" },
  { kind: "txt", who: "маша", av: "c2", text: "жор база ❤️", time: "19:53", reacts: [{ e: "❤️", n: 3 }, { e: "🔥", n: 2 }] },
  { kind: "day", t: "сегодня" },
  { kind: "drop", coin: "📈", who: "Капнул процент", amount: "+ 142 ₽", msg: "пока вы спали" },
  { kind: "txt", who: "дима", av: "c1", out: true, text: "ору. оно правда копится само", time: "11:04" },
  { kind: "txt", who: "маша", av: "c2", text: "ну я ж говорю. ещё по 10 к маю и летим", time: "11:07", reacts: [{ e: "🏝", n: 4 }] },
];

export default function PreviewD() {
  const [pct, setPct] = useState(24);
  const [amt, setAmt] = useState(47812);
  useEffect(() => {
    const id = setInterval(() => {
      setAmt((a) => a + Math.floor(Math.random() * 3 + 1));
    }, 2400);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setPct(Math.min(100, (amt / 200000) * 100));
  }, [amt]);

  return (
    <main className="pD">
      <style>{CSS}</style>
      <div className="wallpaper" />
      <div className="stage">
        {/* chat header */}
        <div className="ch-head">
          <div className="ch-back">‹</div>
          <div className="ch-av">Б</div>
          <div className="ch-meta">
            <div className="ch-name">Бали 2026 🫙</div>
            <div className="ch-sub">4 участника, <b>4 online</b></div>
          </div>
          <div className="ch-icons">⋮</div>
        </div>

        {/* pinned message — jar status */}
        <div className="pin">
          <div className="pin-bar" />
          <div className="pin-body">
            <div className="pin-l">Закреплено · банка</div>
            <div className="pin-t">🫙 <b>{amt.toLocaleString("ru-RU")} ₽</b> из 200 000 ₽</div>
            <div className="pin-prog"><div className="pin-prog-fill" style={{ width: `${pct}%` }} /></div>
            <div className="pin-num"><span className="pin-pct">{pct.toFixed(1)}%</span> · до цели 152 188 ₽ · APY 7.04%</div>
          </div>
        </div>

        {/* feed */}
        <div className="feed">
          {FEED.map((m, i) => {
            if (m.kind === "day") return <div key={i} className="day">{m.t}</div>;
            if (m.kind === "drop") return (
              <div key={i} className="drop">
                <div className="drop-r"><span className="drop-coin">{m.coin}</span> {m.who} <b>{m.amount}</b></div>
                {m.msg && <div className="drop-msg">«{m.msg}»</div>}
              </div>
            );
            const cls = `msg ${m.out ? "out" : ""} ${m.same ? "same" : ""}`;
            const cNum = m.av.slice(1);
            if (m.kind === "card") return (
              <div key={i} className={cls}>
                {!m.out && <div className={`av ${m.av}`}>{m.who[0].toUpperCase()}</div>}
                <div className="bub">
                  {!m.same && !m.out && <div className={`nm c${cNum}`}>{m.who}</div>}
                  {m.pre && <div>{m.pre}</div>}
                  <div className="card">
                    <div className="card-t">{m.cardTitle}</div>
                    <div className="card-d">{m.cardDesc}</div>
                    <div className="card-img">
                      <div>
                        <div className="card-img-meta">{m.cardLabel}</div>
                        <div className="card-img-num">{m.cardNum}</div>
                      </div>
                    </div>
                    <div className="card-url">{m.cardUrl}</div>
                  </div>
                  <span className="tm">{m.time}</span>
                </div>
              </div>
            );
            return (
              <div key={i} className={cls}>
                {!m.out && <div className={`av ${m.av}`}>{m.who[0].toUpperCase()}</div>}
                <div className="bub">
                  {!m.same && !m.out && <div className={`nm c${cNum}`}>{m.who}</div>}
                  <span>{m.text}</span>
                  <span className="tm">{m.time}</span>
                  {m.reacts && (
                    <div style={{ marginTop: 4 }}>
                      {m.reacts.map((r, j) => (
                        <span key={j} className="react">{r.e} <b>{r.n}</b></span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA — composer-shaped */}
        <div className="cta-wrap">
          <div className="cta-line">
            <b>сделай такую же.</b><br />
            кидай ссылку в чат — друзья закинут карты, банка сама копится.
          </div>
          <form className="cta-form" action="/create">
            <input placeholder="на что копим? напр. бали 2026" name="title" />
            <button type="submit">создать →</button>
          </form>
          <div className="cta-foot">
            <span>🍎 apple pay</span>
            <span>💳 visa / mc</span>
            <span>📈 7% APY</span>
            <span>🔓 без кошельков</span>
          </div>
        </div>
      </div>
      <Link href="/preview" className="switcher">← варианты</Link>
    </main>
  );
}
