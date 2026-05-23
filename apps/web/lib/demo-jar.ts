import type { JarPayload } from "./jar-fetch";

export const DEMO_SHORT_ID = "gift";

// Valid base58 32-byte addresses (System Program / wSOL mint) used purely as
// placeholders — these accounts are not jars, so on-chain reads cleanly return
// null and the demo page renders from the mock payload below.
const DEMO_PDA = "11111111111111111111111111111111";
const DEMO_OWNER = "So11111111111111111111111111111111111111112";

export interface DemoContributor {
  donor: string;
  amount: string;
  firstAt: number;
  lastAt: number;
  refunded: boolean;
  donorName: string | null;
}

export function isDemoShortId(shortId: string): boolean {
  return shortId === DEMO_SHORT_ID;
}

export function buildDemoJar(): JarPayload {
  return {
    pda: DEMO_PDA,
    shortId: DEMO_SHORT_ID,
    owner: DEMO_OWNER,
    jarType: "flexible",
    asset: "sol",
    goalAmount: (5 * 1_000_000_000).toString(),
    unlockTimestamp: null,
    totalContributed: (2.4 * 1_000_000_000).toString(),
    totalContributors: 7,
    status: "active",
    metadata: {
      version: 1,
      title: "Birthday gift for Anna",
      description:
        "Anna turns 30 next month — let's chip in for the camera she's been eyeing. Any amount welcome.",
      coverUrl: "emoji:🎁",
      disableContributors: false,
    },
    metadataUri: "demo://gift",
    stakeProtocol: 0,
  };
}

export function buildDemoContributors(): DemoContributor[] {
  const now = Math.floor(Date.now() / 1000);
  const sol = (n: number) => Math.round(n * 1_000_000_000).toString();
  return [
    { donor: "9xQeWvG816bUx9EPjHmaT2sR1caBfk7g6sBfBV3X4Ksp", amount: sol(1.0), firstAt: now - 3600 * 26, lastAt: now - 3600 * 26, refunded: false, donorName: "Mark" },
    { donor: "5KJp7q3rt92mYxLpKqV8tH3vJN4cQwR8xZ1aPbE7fGdM", amount: sol(0.5), firstAt: now - 3600 * 22, lastAt: now - 3600 * 22, refunded: false, donorName: "Lena" },
    { donor: "3FzQ9aXkL2mNpR8vT4yU6wB1cD7eH5gJ9kM2nP4qR8sT", amount: sol(0.3), firstAt: now - 3600 * 18, lastAt: now - 3600 * 18, refunded: false, donorName: null },
    { donor: "7HmJ4kP2qR8sT3vW6xY9zA1bC5dE8fG2hI4jK7lM9nO3", amount: sol(0.25), firstAt: now - 3600 * 12, lastAt: now - 3600 * 12, refunded: false, donorName: "Sam" },
    { donor: "2GpL5nQ8rS3tU6vW9xZ1aB4cD7eF2gH5iJ8kM1nO4pR7", amount: sol(0.2), firstAt: now - 3600 * 8, lastAt: now - 3600 * 8, refunded: false, donorName: null },
    { donor: "8KqM3oP6rT9uV2wX5yZ8aC1bD4eF7gH3iJ6kL9nO2pQ5", amount: sol(0.1), firstAt: now - 3600 * 4, lastAt: now - 3600 * 4, refunded: false, donorName: "Yuri" },
    { donor: "4LrN6pS9tU3vW7xY1zA4bC8dE2fG5hI9jK3lM6nP1qR4", amount: sol(0.05), firstAt: now - 3600 * 1, lastAt: now - 3600 * 1, refunded: false, donorName: null },
  ];
}
