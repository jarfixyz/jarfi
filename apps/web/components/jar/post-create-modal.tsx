"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  onPayCard: () => void;
  onPayWallet: () => void;
  onRemind: () => void;
};

export function PostCreateModal({ open, onClose, onPayCard, onPayWallet, onRemind }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(20,21,26,0.5)" }}>
      <div className="relative rounded-[14px] p-7" style={{ background: "var(--h-card)", border: "0.5px solid var(--h-line)", width: "92%", maxWidth: 420 }}>
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 text-[18px]" style={{ color: "var(--h-ink-3)" }}>×</button>
        <div className="text-[18px] font-medium mb-1">Fund your jar 🎉</div>
        <div className="text-[13px] mb-5" style={{ color: "var(--h-ink-3)" }}>Your jar is live. Give it a starting push.</div>
        <div className="flex flex-col gap-2">
          <FundBtn icon="💳" label="Pay with card" onClick={onPayCard} />
          <FundBtn icon="👛" label="Pay from wallet" onClick={onPayWallet} />
          <FundBtn icon="🔔" label="Remind me later" onClick={onRemind} />
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
