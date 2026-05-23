"use client";

import { useRef, useState } from "react";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString();

function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  display,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
  display: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pct = ((value - min) / (max - min)) * 100;

  const handleMove = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const r = track.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const raw = min + p * (max - min);
    const v = Math.round(raw / step) * step;
    onChange(v);
  };

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    dragging.current = true;
    const startX =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    handleMove(startX);
    const onMv = (ev: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const x =
        "touches" in ev ? ev.touches[0]?.clientX : (ev as MouseEvent).clientX;
      if (typeof x === "number") handleMove(x);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMv);
      window.removeEventListener("touchmove", onMv);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMv);
    window.addEventListener("touchmove", onMv);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
  };

  return (
    <div className="sl-row">
      <span className="sl-lbl">{label}</span>
      <div
        className="sl-track"
        ref={trackRef}
        onMouseDown={onDown}
        onTouchStart={onDown}
      >
        <div className="sl-fill" style={{ width: pct + "%" }}>
          <div className="sl-thumb" />
        </div>
      </div>
      <span className="sl-val">{display}</span>
    </div>
  );
}

export function Calculator() {
  const [monthly, setMonthly] = useState(50);
  const [gifts, setGifts] = useState(200);
  const [years, setYears] = useState(18);

  const calc = (apy: number) => {
    const r = apy / 12;
    const n = years * 12;
    let bal = 0;
    for (let m = 1; m <= n; m++) {
      bal = bal * (1 + r) + monthly;
      if (m % 12 === 0) bal += gifts;
    }
    return bal;
  };
  const bank = calc(0.005);
  const jar = calc(0.062);
  const delta = jar - bank;
  const youTotal = monthly * 12 * years;
  const giftsTotal = gifts * years;

  return (
    <div className="col-calc">
      <div className="calc-head">
        <span className="calc-head-t">Compound calculator</span>
        <span className="calc-head-s">you + birthday gifts</span>
      </div>
      <Slider
        label="You / month"
        min={10}
        max={500}
        step={10}
        value={monthly}
        onChange={setMonthly}
        display={"$" + monthly}
      />
      <Slider
        label="Birthday gifts / yr"
        min={0}
        max={1000}
        step={25}
        value={gifts}
        onChange={setGifts}
        display={"$" + gifts}
      />
      <Slider
        label="Years"
        min={1}
        max={25}
        step={1}
        value={years}
        onChange={setYears}
        display={years + "y"}
      />
      <div className="calc-split">
        <span>You: <b>{fmt(youTotal)}</b></span>
        <span className="calc-split-dot">·</span>
        <span>Birthdays: <b>{fmt(giftsTotal)}</b></span>
      </div>
      <div className="res-row">
        <div className="res-box">
          <div className="res-lbl">Bank (0.5%)</div>
          <div className="res-num">{fmt(bank)}</div>
          <div className="res-sub">no staking</div>
        </div>
        <div className="res-box win">
          <div className="res-lbl">jarfi (6.2%)</div>
          <div className="res-num green">{fmt(jar)}</div>
          <div className="res-sub">with staking</div>
        </div>
      </div>
      <div className="delta">
        That&apos;s <b>+{fmt(delta)}</b> more with jarfi — same money, smarter jar.
      </div>
    </div>
  );
}
