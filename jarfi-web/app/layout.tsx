import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jarfi — Save together. Grow automatically.",
  description:
    "Create a savings jar, share a link, and let anyone contribute — even without crypto. Your funds grow onchain while you focus on what matters.",
  metadataBase: new URL("https://jarfi.xyz"),
  openGraph: {
    title: "Jarfi — Save together. Grow automatically.",
    description:
      "Create a savings jar, share a link, and let anyone contribute — even without crypto.",
    url: "https://jarfi.xyz",
    siteName: "Jarfi",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
