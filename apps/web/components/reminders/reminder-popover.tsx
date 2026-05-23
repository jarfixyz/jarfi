"use client";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  jarName: string;
};

export function ReminderPopover({ open, onClose, jarName }: Props) {
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("10:00");
  const [browser, setBrowser] = useState(true);

  if (!open) return null;

  async function save() {
    if (!browser) {
      toast.error("Pick at least one channel");
      return;
    }
    if (typeof Notification === "undefined") {
      toast.error("Browser notifications not supported");
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast.error("Permission denied");
      return;
    }
    const at = new Date(`${date}T${time}:00`).getTime();
    const ms = Math.max(15_000, at - Date.now());
    window.setTimeout(() => { new Notification(`jarfi · ${jarName}`, { body: "Time to top up." }); }, ms);
    toast.success("Reminder scheduled ✓");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(20,21,26,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-[14px] p-6" style={{ background: "var(--h-card)", border: "0.5px solid var(--h-line)", width: "92%", maxWidth: 380 }}>
        <div className="text-[16px] font-medium mb-1">Set a reminder</div>
        <div className="text-[12.5px] mb-4" style={{ color: "var(--h-ink-3)" }}>We&apos;ll nudge you when it&apos;s time.</div>
        <label className="block text-[11px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--h-ink-3)" }}>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mb-3 rounded-[8px] px-3 py-2 text-[14px]" style={{ background: "var(--h-bg)", border: "0.5px solid var(--h-line-2)" }} />
        <label className="block text-[11px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--h-ink-3)" }}>Time</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full mb-4 rounded-[8px] px-3 py-2 text-[14px]" style={{ background: "var(--h-bg)", border: "0.5px solid var(--h-line-2)" }} />
        <div className="flex items-center justify-between mb-2 text-[13px]">
          <span>Browser push (Chrome)</span>
          <input type="checkbox" checked={browser} onChange={(e) => setBrowser(e.target.checked)} />
        </div>
        <div className="flex items-center justify-between mb-5 text-[13px]" style={{ color: "var(--h-ink-3)" }}>
          <span>Telegram <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--h-bg-2)" }}>Soon</span></span>
          <input type="checkbox" disabled />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-[8px] py-2.5 text-[13.5px]" style={{ background: "var(--h-bg-2)", color: "var(--h-ink-2)" }}>Cancel</button>
          <button onClick={save} className="flex-1 rounded-[8px] py-2.5 text-[13.5px]" style={{ background: "var(--h-accent)", color: "#F1F0EC" }}>Set reminder</button>
        </div>
      </div>
    </div>
  );
}
