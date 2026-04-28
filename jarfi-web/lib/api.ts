// Backend API client — talks to jarfi-backend

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export type JarApiResponse = {
  ok: boolean;
  jar: {
    pubkey: string;
    owner: string;
    mode: number;
    unlockDate: number;
    goalAmount: number;
    balance: number;
    stakingShares: number;
    createdAt: number;
    unlocked: boolean;
    childWallet: string;
    childSpendableBalance: number;
  };
  contributions: {
    pubkey: string;
    contributor: string;
    amount: number;
    comment: string;
    createdAt: number;
  }[];
};

export async function fetchJarFromApi(
  jarPubkey: string
): Promise<JarApiResponse> {
  const res = await fetch(`${API_URL}/jar/${jarPubkey}`);
  if (!res.ok) throw new Error(`Failed to fetch jar: ${res.statusText}`);
  return res.json();
}

export type ApyResponse = {
  ok: boolean;
  usdc_kamino: number;
  sol_marinade: number;
};

export async function fetchApy(): Promise<ApyResponse> {
  try {
    const res = await fetch(`${API_URL}/apy`);
    if (!res.ok) throw new Error();
    return res.json();
  } catch {
    return { ok: true, usdc_kamino: 8.2, sol_marinade: 6.85 };
  }
}

export async function createJarViaApi(params: {
  mode: number;
  unlockDate: number;
  goalAmount: number;
  childWallet: string;
}): Promise<{ ok: boolean; jarPubkey: string; txSignature: string }> {
  const res = await fetch(`${API_URL}/jar/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create jar: ${res.statusText}`);
  return res.json();
}
