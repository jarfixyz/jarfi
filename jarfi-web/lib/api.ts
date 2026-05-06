// Backend API client — talks to jarfi-backend

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://jarfi.up.railway.app";

export type JarApiResponse = {
  ok: boolean;
  jar: {
    pubkey: string;
    owner: string;
    mode: number;
    unlockDate: number;
    goalAmount: number;
    balance: number;
    usdcBalance: number;
    jarCurrency: number;
    stakingShares: number;
    createdAt: number;
    unlocked: boolean;
    childWallet: string;
    childSpendableBalance: number;
    name: string | null;
    emoji: string | null;
    jarType: string | null;
    image: string | null;
    vaultTokenBalance: { amount: string; decimals: number; uiAmount: number } | null;
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

// ---------------------------------------------------------------------------
// Schedule API
// ---------------------------------------------------------------------------

export type Schedule = {
  id: string;
  jar_pubkey: string;
  owner_pubkey: string;
  amount_usdc: number;  // cents
  frequency: "weekly" | "monthly";
  day: number;
  hour: number;
  minute: number;
  cron_expr: string;
  active: boolean;
  created_at: number;
  last_fired: number | null;
};

export async function createScheduleApi(params: {
  jar_pubkey: string;
  owner_pubkey: string;
  amount_usdc: number;
  frequency: "weekly" | "monthly";
  day: number;
  hour: number;
  minute: number;
}): Promise<{ ok: boolean; schedule: Schedule }> {
  const res = await fetch(`${API_URL}/schedule/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to create schedule");
  return res.json();
}

export async function fetchSchedules(ownerPubkey: string): Promise<Schedule[]> {
  try {
    const res = await fetch(`${API_URL}/schedule/${ownerPubkey}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.schedules ?? [];
  } catch {
    return [];
  }
}

export async function stopScheduleApi(id: string): Promise<void> {
  await fetch(`${API_URL}/schedule/${id}`, { method: "DELETE" });
}

export async function updateScheduleApi(id: string, params: {
  amount_usdc: number;
  frequency: "weekly" | "monthly";
  day: number;
  hour: number;
  minute: number;
}): Promise<void> {
  await fetch(`${API_URL}/schedule/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Cosigner API (Phase 5 — soft approval scaffold)
// ---------------------------------------------------------------------------

export type Cosigner = {
  jar_pubkey: string;
  invite_token: string;
  invitee_pubkey: string | null;
  status: "pending" | "active";
  created_at: number;
};

export async function createCosignerInvite(jar_pubkey: string): Promise<string> {
  const res = await fetch(`${API_URL}/cosigner/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jar_pubkey }),
  });
  const data = await res.json();
  return data.invite_token as string;
}

export async function fetchCosigners(jar_pubkey: string): Promise<Cosigner[]> {
  try {
    const res = await fetch(`${API_URL}/cosigner/list/${jar_pubkey}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.cosigners ?? [];
  } catch {
    return [];
  }
}

export async function fetchCosignerByToken(token: string): Promise<{ jar_pubkey: string; status: string; name: string; emoji: string } | null> {
  try {
    const res = await fetch(`${API_URL}/cosigner/by-token/${token}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function acceptCosignerInvite(token: string, invitee_pubkey: string): Promise<{ ok: boolean; jar_pubkey: string }> {
  const res = await fetch(`${API_URL}/cosigner/accept/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitee_pubkey }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Group Trip API
// ---------------------------------------------------------------------------

export type GroupMember = {
  pubkey: string;
  nickname: string;
  joined_at: number;
  contributed_cents: number;
  progress_pct: number;
};

export type GroupInfo = {
  jar_pubkey: string;
  trip_name: string;
  destination_emoji: string;
  trip_date: number;
  budget_per_person_cents: number;
  total_goal_cents: number;
  total_contributed: number;
  total_progress_pct: number;
  members: GroupMember[];
};

export async function createGroupApi(params: {
  jar_pubkey: string;
  trip_name: string;
  destination_emoji: string;
  trip_date: number;
  budget_per_person_cents: number;
  owner_pubkey: string;
  owner_nickname: string;
}): Promise<GroupInfo> {
  const res = await fetch(`${API_URL}/group/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to create group");
  const data = await res.json();
  return data.group;
}

export async function fetchGroup(jar_pubkey: string): Promise<GroupInfo | null> {
  try {
    const res = await fetch(`${API_URL}/group/${jar_pubkey}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.group ?? null;
  } catch {
    return null;
  }
}

export async function joinGroupApi(
  jar_pubkey: string,
  params: { owner_pubkey: string; nickname: string }
): Promise<GroupInfo | null> {
  try {
    const res = await fetch(`${API_URL}/group/${jar_pubkey}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.group ?? null;
  } catch {
    return null;
  }
}

export async function fetchGroupsByOwner(ownerPubkey: string): Promise<GroupInfo[]> {
  try {
    const res = await fetch(`${API_URL}/group/by-owner/${ownerPubkey}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.groups ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------

export type JarContribution = {
  pubkey: string;
  contributor: string;
  amount: number;
  comment: string;
  createdAt: number;
};

export async function fetchContributionsForJar(jarPubkey: string): Promise<JarContribution[]> {
  try {
    const data = await fetchJarFromApi(jarPubkey);
    return data.contributions ?? [];
  } catch {
    return [];
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
