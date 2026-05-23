"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Modal } from "@/components/ui/modal";
import { WithdrawModal } from "@/components/owner/withdraw-modal";
import { CancelModal } from "@/components/owner/cancel-modal";
import { EditMetadataModal } from "@/components/owner/edit-metadata-modal";
import { RefundAllModal } from "@/components/owner/refund-all-modal";
import type { JarPayload } from "@/lib/jar-fetch";
import { Contributors } from "./contributors";

export function OwnerControls({
  jar,
  shortId,
}: {
  jar: JarPayload;
  shortId: string | null;
}) {
  const { publicKey } = useWallet();
  const [withdraw, setWithdraw] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [edit, setEdit] = useState(false);
  const [refundAll, setRefundAll] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);

  const isOwner = !!publicKey && publicKey.toBase58() === jar.owner;
  const showContributors = !jar.metadata.disableContributors;

  const now = Date.now() / 1000;
  const canWithdraw =
    jar.status === "active" &&
    (jar.jarType === "flexible" ||
      (jar.unlockTimestamp != null && now >= jar.unlockTimestamp));
  const canCancel = jar.status === "active" && jar.jarType === "timeLocked";
  const showRefundAll = jar.status === "cancelled";

  if (!showContributors && !isOwner) return null;

  const btnGhost: React.CSSProperties = {
    background: "transparent",
    color: "var(--h-ink)",
    border: "0.5px solid var(--h-line-2)",
    padding: "9px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
  };
  const btnDisabled: React.CSSProperties = {
    ...btnGhost,
    opacity: 0.45,
    cursor: "not-allowed",
  };
  const btnDanger: React.CSSProperties = {
    ...btnGhost,
    color: "#8A3A32",
    border: "0.5px solid rgba(138,58,50,0.35)",
  };

  return (
    <>
      <div
        className="rounded-[12px]"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
          padding: 18,
        }}
      >
        {isOwner && (
          <div className="mb-3">
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--h-ink)",
              }}
            >
              Manage your jar
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--h-ink-3)",
                marginTop: 2,
              }}
            >
              Only you can see these.
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {showContributors && (
            <button
              type="button"
              onClick={() => setContribOpen(true)}
              style={btnGhost}
            >
              Contributors ({jar.totalContributors})
            </button>
          )}
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setEdit(true)}
                style={btnGhost}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => canWithdraw && setWithdraw(true)}
                disabled={!canWithdraw}
                style={canWithdraw ? btnGhost : btnDisabled}
              >
                Withdraw
              </button>
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setCancel(true)}
                  style={btnDanger}
                >
                  Cancel jar
                </button>
              )}
              {showRefundAll && (
                <button
                  type="button"
                  onClick={() => setRefundAll(true)}
                  style={btnDanger}
                >
                  Refund everyone
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        open={contribOpen}
        onOpenChange={setContribOpen}
        title="Contributors"
      >
        <div
          style={{
            fontFamily:
              "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
          }}
        >
          <Contributors lookupId={shortId ?? jar.pda} asset={jar.asset} />
        </div>
      </Modal>

      <WithdrawModal open={withdraw} onOpenChange={setWithdraw} jar={jar} />
      <CancelModal open={cancel} onOpenChange={setCancel} jar={jar} />
      <EditMetadataModal open={edit} onOpenChange={setEdit} jar={jar} />
      <RefundAllModal
        open={refundAll}
        onOpenChange={setRefundAll}
        jar={jar}
        shortId={shortId}
      />
    </>
  );
}
