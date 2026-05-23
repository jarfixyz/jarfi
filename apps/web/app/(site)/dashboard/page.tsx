import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/jar-list";

export const metadata: Metadata = { title: "Dashboard — jarfi" };

export default function DashboardPage() {
  return (
    <section
      className="theme-editorial"
      style={{
        fontFamily:
          "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
        color: "var(--h-ink)",
        padding: "56px 48px 72px",
      }}
    >
      <div>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1
              style={{
                fontSize: "clamp(34px, 5vw, 52px)",
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: "-0.025em",
                color: "var(--h-ink)",
              }}
            >
              Your jars
            </h1>
            <p
              className="mt-3 max-w-[520px]"
              style={{ color: "var(--h-ink-2)", fontSize: 15, lineHeight: 1.6 }}
            >
              Manage jars owned by your connected wallet.
            </p>
          </div>
        </div>

        <DashboardClient />
      </div>
    </section>
  );
}
