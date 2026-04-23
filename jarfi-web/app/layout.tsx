import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAR — Save together. Lock it. Grow it.",
  description:
    "On-chain savings jars with auto-staking yield. Set a goal, a date, or both. Family contributes by card — no crypto needed.",
  metadataBase: new URL("https://jarfi.xyz"),
  openGraph: {
    title: "JAR — Save together. Lock it. Grow it.",
    description:
      "On-chain savings jars with auto-staking yield. Set a goal, a date, or both.",
    url: "https://jarfi.xyz",
    siteName: "JAR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
