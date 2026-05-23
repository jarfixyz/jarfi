"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        className:
          "!rounded-full !bg-paper !text-ink !border-2 !border-line !shadow-md !px-5 !py-3 !font-sans !font-semibold",
        duration: 3000,
      }}
      icons={{
        success: "🎉",
        error: "🙈",
        info: "💡",
      }}
    />
  );
}
