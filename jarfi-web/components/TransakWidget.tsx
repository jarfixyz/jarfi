"use client";

import { useEffect } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://jarfi.up.railway.app";

interface TransakWidgetProps {
  vaultAddress: string;
  fiatAmount?: number;
  contributorMessage: string;
  onSuccess: (orderId: string) => void;
  onClose: () => void;
}

export default function TransakWidget({
  vaultAddress,
  fiatAmount,
  contributorMessage,
  onSuccess,
  onClose,
}: TransakWidgetProps) {
  useEffect(() => {
    let partnerOrderId = `${vaultAddress}__${Date.now()}__${contributorMessage}`;

    const openWithUrl = (widgetUrl: string) => {
      import("@transak/transak-sdk").then(({ Transak }) => {
        try {
          const transak = new Transak({
            widgetUrl,
            referrer: window.location.origin,
          });
          transak.init();
          Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (raw) => {
            const data = raw as { id?: string };
            onSuccess(data?.id ?? partnerOrderId);
            try { transak.close(); } catch { /* ignore */ }
          });
          Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => onClose());
        } catch {
          window.open(widgetUrl, "_blank", "noopener noreferrer");
          onClose();
        }
      }).catch(() => {
        window.open(widgetUrl, "_blank", "noopener noreferrer");
        onClose();
      });
    };

    // Get secure widgetUrl from backend (Transak requires server-side session creation)
    fetch(`${BACKEND}/transak/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultAddress, fiatAmount, message: contributorMessage }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.widgetUrl) {
          if (data.partnerOrderId) partnerOrderId = data.partnerOrderId;
          openWithUrl(data.widgetUrl);
        } else {
          throw new Error(data.error ?? "no widgetUrl");
        }
      })
      .catch(err => {
        console.error("[TransakWidget]", err);
        // Fallback: open Transak directly (will show error on staging but at least opens)
        const params = new URLSearchParams({
          apiKey: process.env.NEXT_PUBLIC_TRANSAK_API_KEY ?? "",
          network: "solana",
          cryptoCurrencyCode: "USDC",
          walletAddress: vaultAddress,
          disableWalletAddressForm: "true",
          hideMenu: "true",
          partnerOrderId,
        });
        if (fiatAmount && fiatAmount > 0) params.set("fiatAmount", String(fiatAmount));
        const base = process.env.NEXT_PUBLIC_ENV === "production"
          ? "https://global.transak.com"
          : "https://global-stg.transak.com";
        window.open(`${base}?${params}`, "_blank", "noopener noreferrer");
        onClose();
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
