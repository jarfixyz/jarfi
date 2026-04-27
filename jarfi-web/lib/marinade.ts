const MARINADE_APY_URL = "https://api.marinade.finance/msol/apy/1y";
export const FALLBACK_APY = 6.85;

export async function getMarinadeAPY(): Promise<number> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(MARINADE_APY_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return FALLBACK_APY;
    const data = await res.json() as { value?: number };
    const pct = (data.value ?? 0) * 100;
    return pct > 0 ? Math.round(pct * 10) / 10 : FALLBACK_APY;
  } catch {
    return FALLBACK_APY;
  }
}
