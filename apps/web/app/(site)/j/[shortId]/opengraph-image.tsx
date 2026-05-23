import { ImageResponse } from "next/og";
import { fetchJarByShortId } from "@/lib/jar-fetch";

export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "jarfi";

function decimalsFor(asset: "sol" | "usdc"): number {
  return asset === "sol" ? 1_000_000_000 : 1_000_000;
}

export default async function OgImage({
  params,
}: {
  params: { shortId: string };
}) {
  const jar = await fetchJarByShortId(params.shortId);

  if (!jar) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FAFAF7",
            color: "#0A0A0A",
            fontSize: 96,
            fontFamily: "monospace",
          }}
        >
          jarfi
        </div>
      ),
      size,
    );
  }

  const total = Number(jar.totalContributed);
  const goal = Number(jar.goalAmount);
  const div = decimalsFor(jar.asset);
  const places = jar.asset === "sol" ? 2 : 2;
  const totalFmt = (total / div).toFixed(places);
  const goalFmt = goal > 0 ? (goal / div).toFixed(places) : null;
  const pct = goal > 0 ? Math.min(100, (total / goal) * 100) : null;
  const assetLabel = jar.asset.toUpperCase();
  const typeLabel = jar.jarType === "flexible" ? "Flexible" : "Time-locked";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FAFAF7",
          padding: 80,
          color: "#0A0A0A",
          fontFamily: "monospace",
        }}
      >
        <div style={{ fontSize: 28, color: "#78350F", letterSpacing: 2 }}>
          {typeLabel.toUpperCase()} · {assetLabel}
        </div>
        <div
          style={{
            fontSize: 96,
            marginTop: 40,
            lineHeight: 1.1,
            letterSpacing: -2,
            display: "flex",
          }}
        >
          {jar.metadata.title.slice(0, 48)}
        </div>
        <div
          style={{
            marginTop: "auto",
            fontSize: 54,
            color: "#0A0A0A",
            display: "flex",
            alignItems: "baseline",
            gap: 24,
          }}
        >
          <span>
            {totalFmt}
            {goalFmt ? ` / ${goalFmt}` : ""} {assetLabel}
          </span>
          {pct != null && (
            <span style={{ fontSize: 36, color: "#78350F" }}>
              {pct.toFixed(0)}%
            </span>
          )}
        </div>
        <div style={{ marginTop: 24, fontSize: 28, color: "#57534E" }}>
          jarfi
        </div>
      </div>
    ),
    size,
  );
}
