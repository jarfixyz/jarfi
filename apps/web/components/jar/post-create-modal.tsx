"use client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onPayCard: () => void;
  onPayWallet: () => void;
};

export function PostCreateModal({ open, onClose, onPayCard, onPayWallet }: Props) {
  if (!open) return null;

  async function setReminder() {
    try {
      if (typeof Notification === "undefined") {
        toast.error("Notifications not supported in this browser");
        return;
      }
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Reminder requires notification permission");
        return;
      }
      const when = new Date();
      when.setDate(when.getDate() + 1);
      when.setHours(10, 0, 0, 0);
      const ms = Math.max(60_000, when.getTime() - Date.now());
      window.setTimeout(() => {
        new Notification("jarfi · time to top up your jar 🍯");
      }, ms);
      toast.success("Reminder set ✓");
      onClose();
    } catch {
      toast.error("Could not set reminder");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(20,21,26,0.5)" }}>
      <div className="relative rounded-[14px] p-7" style={{ background: "var(--h-card)", border: "0.5px solid var(--h-line)", width: "92%", maxWidth: 420 }}>
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 text-[18px]" style={{ color: "var(--h-ink-3)" }}>×</button>
        <div className="text-[18px] font-medium mb-1">Fund your jar 🎉</div>
        <div className="text-[13px] mb-5" style={{ color: "var(--h-ink-3)" }}>Your jar is live. Give it a starting push.</div>
        <div className="flex flex-col gap-2">
          <FundBtn icon="💳" label="Pay with card" onClick={onPayCard} />
          <FundBtn icon="👛" label="Pay from wallet" onClick={onPayWallet} />
          <FundBtn icon="🔔" label="Remind me later" onClick={setReminder} />
        </div>
        <button onClick={onClose} className="mt-4 text-[12.5px]" style={{ color: "var(--h-ink-3)" }}>Skip for now</button>
      </div>
    </div>
  );
}

function FundBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-[10px] px-4 py-3 text-left transition-colors"
      style={{ background: "var(--h-bg)", border: "0.5px solid var(--h-line-2)" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--h-bg-2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--h-bg)"; }}
    >
      <span className="text-[18px]">{icon}</span>
      <span className="text-[14px] font-medium">{label}</span>
    </button>
  );
}
