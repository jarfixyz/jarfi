import { NextResponse } from "next/server";

const BASE_APY = 5.4;
const SPREAD = 0.3;
const POOL_TVL_USDC = 4_280_000_000;
const POOL_UTILIZATION = 0.74;

export async function GET() {
  const drift = (Math.random() * 2 - 1) * SPREAD;
  const apy = Math.round((BASE_APY + drift) * 100) / 100;
  const supplyApy = Math.round((apy - 0.15) * 100) / 100;
  const borrowApy = Math.round((apy + 1.7) * 100) / 100;
  return NextResponse.json({
    market: "Main",
    asset: "USDC",
    apy,
    supplyApy,
    borrowApy,
    utilization: POOL_UTILIZATION,
    totalSupplyUsd: POOL_TVL_USDC,
    updatedAt: new Date().toISOString(),
    source: "simulated",
  });
}
