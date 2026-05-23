import type { ReactNode } from "react";
import { SiteHeader } from "@/components/chrome/site-header";
import { WalletProvider } from "@/lib/wallet/provider";

export default function SiteLayout({ children }: { children: ReactNode }) {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  return (
    <WalletProvider rpcUrl={rpcUrl}>
    <div
      style={{
        background: "#FAFAF7",
        minHeight: "100vh",
        padding: 24,
        display: "flex",
        justifyContent: "center",
        fontFamily: "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1080,
          background: "#FFFFFF",
          borderRadius: 18,
          overflow: "hidden",
          border: "0.5px solid rgba(20,21,26,0.08)",
          boxShadow:
            "0 1px 2px rgba(20,21,26,0.03), 0 24px 60px -28px rgba(20,21,26,0.08)",
        }}
      >
        <SiteHeader />
        <main>{children}</main>
      </div>
    </div>
    </WalletProvider>
  );
}
