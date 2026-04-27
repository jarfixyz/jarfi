import GiftClient from "./GiftClient";
import { getMarinadeAPY } from "@/lib/marinade";
import type { DisplayJar } from "./GiftClient";

export const runtime = "edge";

const IS_SOLANA_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

async function fetchJarFromBackend(slug: string): Promise<DisplayJar | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/jar/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json() as {
      ok: boolean;
      jar?: {
        mode: number;
        unlockDate: number;
        goalAmount: number;
        balance: number;
      };
      contributions?: Array<{ amount: number }>;
    };
    if (!data.ok || !data.jar) return null;
    const jar = data.jar;
    const date = jar.unlockDate
      ? new Date(jar.unlockDate * 1000).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
        })
      : null;
    const goalUsd = (jar.goalAmount / 100).toLocaleString();
    let unlockLabel = "";
    if (jar.mode === 0) unlockLabel = date ? `Opens ${date}` : "Locked";
    else if (jar.mode === 1) unlockLabel = `Opens when $${goalUsd} collected`;
    else unlockLabel = `Opens at $${goalUsd}${date ? ` or on ${date}` : ""}`;

    return {
      name: "Savings Jar",
      emoji: "🏺",
      amountCents: jar.balance,
      goalCents: jar.goalAmount,
      unlockLabel,
      contributors: data.contributions?.length ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function GiftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [apy, jarData] = await Promise.all([
    getMarinadeAPY(),
    IS_SOLANA_PUBKEY.test(slug) ? fetchJarFromBackend(slug) : Promise.resolve(null),
  ]);
  return <GiftClient slug={slug} apy={apy} jarData={jarData} />;
}
