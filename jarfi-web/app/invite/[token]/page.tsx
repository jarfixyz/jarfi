"use client";

export const runtime = "edge";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { fetchCosignerByToken, acceptCosignerInvite } from "@/lib/api";
import Link from "next/link";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { publicKey } = useWallet();

  const [info, setInfo] = useState<{ jar_pubkey: string; status: string; name: string; emoji: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchCosignerByToken(token).then(d => {
      setInfo(d);
      setLoading(false);
      if (d?.status === "active") setAccepted(true);
    }).catch(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!publicKey || !info) return;
    setWorking(true);
    setError(null);
    try {
      const res = await acceptCosignerInvite(token, publicKey.toBase58());
      if (res.ok) setAccepted(true);
      else setError("Could not accept invite — it may have already been used.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F2", fontFamily: "var(--font)" }}>
        <div style={{ fontSize: 14, color: "#999" }}>Loading…</div>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F2", fontFamily: "var(--font)", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Invalid or expired invite</div>
          <div style={{ fontSize: 14, color: "#999", marginTop: 6 }}>This link may have already been used.</div>
          <Link href="/" style={{ display: "inline-block", marginTop: 20, fontSize: 14, color: "#059669", textDecoration: "none" }}>← Back to Jarfi</Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F2", fontFamily: "var(--font)", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px", marginBottom: 8 }}>You&apos;re a co-signer!</div>
          <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 24 }}>
            You&apos;ve been added as a family approver for <strong>{info.emoji} {info.name}</strong>.
            <br /><span style={{ fontSize: 12, color: "#999" }}>Soft approval · on-chain enforcement coming soon</span>
          </div>
          <Link href="/" style={{ display: "inline-block", padding: "12px 28px", background: "#111", color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            Open Jarfi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F2", fontFamily: "var(--font)", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", border: "1px solid #E2E2DC", borderRadius: 20, padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{info.emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px", marginBottom: 6 }}>{info.name}</div>
        <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 24 }}>
          You&apos;ve been invited to become a <strong>family approver</strong> for this jar.
          As a co-signer, you approve withdrawals — you can&apos;t edit jar settings.
          <br /><span style={{ fontSize: 12, color: "#999", marginTop: 6, display: "block" }}>Soft approval · on-chain enforcement coming soon</span>
        </div>

        {!publicKey ? (
          <>
            <div style={{ fontSize: 13, color: "#999", marginBottom: 14 }}>Connect your wallet to accept</div>
            <WalletButton />
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 16, padding: "10px 14px", background: "#F0F0EC", borderRadius: 9 }}>
              Connected: <strong>{publicKey.toBase58().slice(0, 6)}…{publicKey.toBase58().slice(-4)}</strong>
            </div>
            {error && <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{error}</div>}
            <button
              onClick={handleAccept}
              disabled={working}
              style={{ width: "100%", padding: "13px 0", background: "#111", color: "#fff", borderRadius: 10, fontSize: 15, fontWeight: 600, border: "none", cursor: working ? "not-allowed" : "pointer", fontFamily: "var(--font)", opacity: working ? 0.6 : 1 }}
            >
              {working ? "Accepting…" : "Accept as co-signer"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
