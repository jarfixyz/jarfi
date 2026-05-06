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
    let transakInstance: { close?: () => void } | null = null;
    let closed = false;

    const safeClose = () => {
      if (closed) return;
      closed = true;
      onClose();
    };

    // Primary close mechanism: postMessage from Transak iframe
    const handleMessage = (e: MessageEvent) => {
      const id = e.data?.event_id ?? e.data?.eventName;
      if (id === "TRANSAK_WIDGET_CLOSE" || id === "transak_widget_close") {
        safeClose();
      }
      if (id === "TRANSAK_ORDER_SUCCESSFUL" || id === "transak_order_successful") {
        onSuccess(e.data?.data?.id ?? partnerOrderId);
        try { transakInstance?.close?.(); } catch { /* ignore */ }
      }
    };
    window.addEventListener("message", handleMessage);

    const openWithUrl = (widgetUrl: string) => {
      import("@transak/transak-sdk").then(({ Transak }) => {
        try {
          const transak = new Transak({
            widgetUrl,
            referrer: window.location.origin,
          });
          transakInstance = transak;
          transak.init();

          // SDK events as secondary fallback
          Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (raw) => {
            const data = raw as { id?: string };
            onSuccess(data?.id ?? partnerOrderId);
            try { transak.close(); } catch { /* ignore */ }
          });
          Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => safeClose());
        } catch {
          window.open(widgetUrl, "_blank", "noopener noreferrer");
          safeClose();
        }
      }).catch(() => {
        window.open(widgetUrl, "_blank", "noopener noreferrer");
        safeClose();
      });
    };

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
        safeClose();
      });

    return () => {
      window.removeEventListener("message", handleMessage);
      try { transakInstance?.close?.(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
