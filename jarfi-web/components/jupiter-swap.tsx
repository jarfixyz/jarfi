"use client";
import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_MINT = "So11111111111111111111111111111111111111112";

let initialized = false;

export function JupiterSwapButton({ className }: { className?: string }) {
  const wallet = useWallet();

  useEffect(() => {
    if (!initialized) return;
    import("@jup-ag/terminal").then(({ syncProps }) => {
      syncProps({ passthroughWalletContextState: wallet });
    });
  }, [wallet]);

  const open = async () => {
    const Jupiter = await import("@jup-ag/terminal");
    if (initialized) {
      Jupiter.resume();
      return;
    }
    await Jupiter.init({
      displayMode: "modal",
      enableWalletPassthrough: true,
      passthroughWalletContextState: wallet,
      formProps: {
        initialInputMint: USDC_MINT,
        initialOutputMint: SOL_MINT,
      },
    });
    initialized = true;
  };

  return (
    <button onClick={open} className={className}>
      Swap
    </button>
  );
}
