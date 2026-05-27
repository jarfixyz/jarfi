interface SummaryRowsProps {
  title: string;
  description: string;
  emoji: string | null;
  hasPhoto: boolean;
  asset: "sol" | "usdc";
  jarType: "flexible" | "timeLocked";
  uiType: "goal" | "timeLocked" | "group";
  goalAmount: string;
  goalEnabled: boolean;
  unlockDate: Date | null;
}

function uiTypeLabel(t: SummaryRowsProps["uiType"]): string {
  if (t === "goal") return "Goal jar";
  if (t === "timeLocked") return "Time-locked";
  return "Group jar";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start justify-between gap-4 py-3.5"
      style={{ borderBottom: "0.5px solid var(--h-line)" }}
    >
      <span
        className="text-[11px] font-medium uppercase tracking-[0.08em]"
        style={{ color: "var(--h-ink-3)" }}
      >
        {label}
      </span>
      <span
        className="text-right text-[14px]"
        style={{ color: "var(--h-ink)", fontWeight: 500 }}
      >
        {children}
      </span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px]"
      style={{
        background: "var(--h-accent-glow)",
        color: "var(--h-ink)",
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

export function SummaryRows(props: SummaryRowsProps) {
  return (
    <div>
      <Row label="Title">
        {props.emoji && <span className="mr-1.5">{props.emoji}</span>}
        {props.title}
      </Row>

      {props.description && <Row label="Description">{props.description}</Row>}

      <Row label="Asset">
        <span className="flex items-center justify-end gap-2">
          {props.asset.toUpperCase()}
          {props.asset === "sol" && <Chip>Staking yield</Chip>}
        </span>
      </Row>

      <Row label="Type">
        <span className="flex items-center justify-end gap-2">
          {uiTypeLabel(props.uiType)}
          {props.jarType === "timeLocked" && props.unlockDate && (
            <Chip>
              {props.unlockDate.toLocaleDateString("en", {
                month: "short",
                year: "numeric",
              })}
            </Chip>
          )}
        </span>
      </Row>

      <Row label="Goal">
        {props.goalEnabled && props.goalAmount ? (
          <span className="flex items-center justify-end gap-2">
            <Chip>{`${props.goalAmount} ${props.asset.toUpperCase()}`}</Chip>
          </span>
        ) : (
          <span style={{ color: "var(--h-ink-3)", fontWeight: 400 }}>
            No goal
          </span>
        )}
      </Row>
    </div>
  );
}
