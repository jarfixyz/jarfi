"use client";

import { useEffect, useRef, useState } from "react";

type FeedItem = {
  id: number;
  av: string;
  name: string;
  msg: string;
  time: string;
  amt: number;
  stake?: boolean;
  fresh?: boolean;
};

const INITIAL_FEED: FeedItem[] = [
  { id: 1, av: "JM", name: "Jake", msg: '"Go get that bike, bro"', time: "3d ago", amt: 150 },
  { id: 2, av: "AS", name: "Ashley", msg: '"Happy birthday!"', time: "1w ago", amt: 50 },
  { id: 3, av: "ST", name: "Staking payout", msg: "Auto APY", time: "1w ago", amt: 18, stake: true },
];

const MOCK_CONTRIB = [
  { name: "Mom", av: "MO", msg: '"Ride safe, honey"', amt: 200 },
  { name: "Dad", av: "DA", msg: '"Helmet\'s on me"', amt: 150 },
  { name: "Mike", av: "MI", msg: '"For that Honda"', amt: 80 },
  { name: "Tyler", av: "TY", msg: '"Two wheels, let\'s go"', amt: 40 },
  { name: "Brandon", av: "BR", msg: '"Gas for day one"', amt: 30 },
  { name: "Sarah", av: "SA", msg: '"Finally doing it!"', amt: 60 },
  { name: "Kevin", av: "KE", msg: '"First ride\'s on me"', amt: 50 },
  { name: "Emily", av: "EM", msg: '"Twist that throttle"', amt: 35 },
  { name: "Ryan", av: "RY", msg: '"Stop stalling, buy it"', amt: 100 },
  { name: "Megan", av: "ME", msg: '"Can\'t wait to see it"', amt: 25 },
  { name: "Josh", av: "JO", msg: '"CB500 fund"', amt: 75 },
  { name: "Hannah", av: "HA", msg: '"Ride on, friend"', amt: 45 },
  { name: "Nick", av: "NI", msg: '"Tank top-up"', amt: 40 },
  { name: "Chris", av: "CH", msg: '"Belated birthday"', amt: 120 },
  { name: "Zach", av: "ZA", msg: '"Send it"', amt: 20 },
  { name: "Rachel", av: "RA", msg: '"For the open road"', amt: 55 },
  { name: "Matt", av: "MA", msg: '"New leather jacket?"', amt: 90 },
  { name: "Jessica", av: "JE", msg: '"You earned it"', amt: 65 },
];

export function ContribMock() {
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED);
  const [collected, setCollected] = useState(3100);
  const rootRef = useRef<HTMLDivElement>(null);
  const goal = 5000;
  const pct = Math.min(100, (collected / goal) * 100);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        const pick = MOCK_CONTRIB[Math.floor(Math.random() * MOCK_CONTRIB.length)];
        const entry: FeedItem = {
          id: Date.now(),
          ...pick,
          time: "just now",
          fresh: true,
        };
        setFeed((prev) => [entry, ...prev.slice(0, 3)]);
        setCollected((c) => Math.min(goal, c + pick.amt));
      }, 5200);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) start();
          else stop();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      stop();
    };
  }, []);

  return (
    <div className="contrib-mock" ref={rootRef}>
      <div className="cm-head">
        <div>
          <div className="cm-title">Honda CB500 Fund</div>
          <div className="cm-sub">Goal $5,000 · Marinade 6.2% APY</div>
        </div>
        <div className="cm-url">jarfi.xyz/cb500</div>
      </div>
      <div className="cm-prog">
        <div className="prog-bar">
          <div className="prog-fill" style={{ width: pct + "%" }} />
        </div>
        <div className="prog-nums">
          <span>
            <b>${collected.toLocaleString()}</b> collected
          </span>
          <span>${goal.toLocaleString()} goal</span>
        </div>
        <span className="yield-chip">◈ +$18 staking this month</span>
      </div>
      <div className="cm-feed">
        {feed.map((it) => (
          <div className={"fi " + (it.fresh ? "new" : "")} key={it.id}>
            <div className={"fi-av " + (it.stake ? "s" : "")}>{it.av}</div>
            <div>
              <div className="fi-name">{it.name}</div>
              <div className="fi-msg">{it.msg}</div>
              <div className="fi-time">{it.time}</div>
            </div>
            <div className="fi-amt">+${it.amt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
