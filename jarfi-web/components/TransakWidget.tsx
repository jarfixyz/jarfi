"use client";

import { useEffect, useRef } from "react";

interface TransakWidgetProps {
  vaultAddress: string;
  fiatAmount: number;
  contributorMessage: string;
  onSuccess: (orderId: string) => void;
  onClose: () => void;
}

const STAGING_URL = "https://global-stg.transak.com";
const PROD_URL = "https://global.transak.com";

export default function TransakWidget({
  vaultAddress,
  fiatAmount,
  contributorMessage,
  onSuccess,
  onClose,
}: TransakWidgetProps) {
  const transakRef = useRef<InstanceType<
    (typeof import("@transak/transak-sdk"))["Transak"]
  > | null>(null);

  useEffect(() => {
    const isProduction = process.env.NEXT_PUBLIC_ENV === "production";
    const baseUrl = isProduction ? PROD_URL : STAGING_URL;
    const partnerOrderId = `${vaultAddress}__${Date.now()}__${encodeURIComponent(contributorMessage)}`;

    const params = new URLSearchParams({
      apiKey: process.env.NEXT_PUBLIC_TRANSAK_API_KEY ?? "",
      network: "solana",
      cryptoCurrencyCode: "USDC",
      walletAddress: vaultAddress,
      disableWalletAddressForm: "true",
      fiatAmount: String(fiatAmount),
      hideMenu: "true",
      partnerOrderId,
    });

    const widgetUrl = `${baseUrl}?${params.toString()}`;

    import("@transak/transak-sdk").then(({ Transak }) => {
      const transak = new Transak({
        widgetUrl,
        referrer: window.location.hostname,
        themeColor: "9945FF",
      });

      transakRef.current = transak;
      transak.init();

      Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (raw) => {
        const data = raw as { id?: string };
        onSuccess(data?.id ?? partnerOrderId);
        transak.close();
      });

      Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => {
        onClose();
      });
    });

    return () => {
      transakRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
