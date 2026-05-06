"use client";

import { useEffect } from "react";

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
    const partnerOrderId = `${vaultAddress}__${Date.now()}__${contributorMessage}`;
    const isProduction = process.env.NEXT_PUBLIC_ENV === "production";
    const baseUrl = isProduction ? "https://global.transak.com" : "https://global-stg.transak.com";

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
    const widgetUrl = `${baseUrl}?${params.toString()}`;

    import("@transak/transak-sdk").then(({ Transak }) => {
      try {
        const transak = new Transak({ widgetUrl, referrer: window.location.hostname, themeColor: "059669" });
        transak.init();
        Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (raw) => {
          const data = raw as { id?: string };
          onSuccess(data?.id ?? partnerOrderId);
          try { transak.close(); } catch { /* ignore */ }
        });
        Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => { onClose(); });
      } catch {
        window.open(widgetUrl, "_blank", "noopener,noreferrer");
        onClose();
      }
    }).catch(() => {
      window.open(widgetUrl, "_blank", "noopener,noreferrer");
      onClose();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
