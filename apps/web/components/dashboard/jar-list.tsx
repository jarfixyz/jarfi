"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { StatsStrip } from "@/components/dashboard/stats-strip";
import { FilterBar, type JarView } from "@/components/dashboard/filter-bar";
import { JarCard } from "@/components/dashboard/jar-card";
import { JarRow } from "@/components/dashboard/jar-row";

interface DashboardRow {
  pda: string;
  asset: "sol" | "usdc";
  totalContributed: string;
  goalAmount?: string;
  status: string;
  title: string | null;
  emoji?: string;
  coverUrl?: string | null;
  stakingEnabled?: boolean;
  unlockTimestamp?: number | null;
}

function parseAmount(raw: string, asset: string): number {
  const divisor = asset === "sol" ? 1_000_000_000 : 1_000_000;
  return Number(raw) / divisor;
}

export function DashboardClient() {
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58();

  const { data, error, isLoading } = useSWR<DashboardRow[]>(
    owner ? `/api/jars/by-owner/${owner}` : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`dashboard fetch failed: ${res.status}`);
      return res.json();
    },
    { refreshInterval: 20000, revalidateOnFocus: true, dedupingInterval: 5000 },
  );

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<JarView>("list");

  const jars = data ?? [];

  const counts = useMemo(() => {
    const active = jars.filter((j) => j.status === "active").length;
    const locked = jars.filter((j) => j.status === "locked").length;
    const completed = jars.filter((j) => j.status === "completed" || j.status === "withdrawn").length;
    return { all: jars.length, active, locked, completed };
  }, [jars]);

  const stats = useMemo(() => {
    const solJars = jars.filter((j) => j.asset === "sol");
    const usdcJars = jars.filter((j) => j.asset === "usdc");

    const solCollected = solJars.reduce(
      (s, j) => s + parseAmount(j.totalContributed, j.asset),
      0,
    );
    const usdcCollected = usdcJars.reduce(
      (s, j) => s + parseAmount(j.totalContributed, j.asset),
      0,
    );
    const solStaked = jars
      .filter((j) => j.asset === "sol" && j.stakingEnabled)
      .reduce((s, j) => s + parseAmount(j.totalContributed, j.asset), 0);
    const stakingJars = jars.filter((j) => j.stakingEnabled).length;
    const goalsReached = jars.filter(
      (j) => j.status === "completed" || j.status === "withdrawn",
    ).length;

    return [
      {
        label: "Total jars",
        value: jars.length,
        hint: `${counts.active} active · ${counts.locked} locked`,
      },
      {
        label: "SOL collected",
        value: solCollected.toFixed(2),
        suffix: "SOL",
        hint: `${solJars.length} jar${solJars.length === 1 ? "" : "s"}`,
      },
      {
        label: "USDC collected",
        value: usdcCollected.toFixed(2),
        suffix: "USDC",
        hint: `${usdcJars.length} jar${usdcJars.length === 1 ? "" : "s"}`,
      },
      {
        label: "SOL staked",
        value: solStaked.toFixed(2),
        suffix: "SOL",
        hint: `${stakingJars} jar${stakingJars === 1 ? "" : "s"} earning yield`,
      },
      {
        label: "Staking profit",
        value: "—",
        hint: "Not tracked yet",
      },
      {
        label: "Goals reached",
        value: goalsReached,
        hint: `of ${jars.length} jar${jars.length === 1 ? "" : "s"}`,
      },
    ];
  }, [jars, counts]);

  const filtered = useMemo(() => {
    let result = jars;
    if (filter === "active") result = result.filter((j) => j.status === "active");
    if (filter === "locked") result = result.filter((j) => j.status === "locked");
    if (filter === "completed") result = result.filter((j) => j.status === "completed" || j.status === "withdrawn");
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((j) => (j.title ?? "").toLowerCase().includes(q));
    }
    return result;
  }, [jars, filter, search]);

  const filterTabs = [
    { key: "all", label: `All (${counts.all})` },
    { key: "active", label: `Active (${counts.active})` },
    { key: "locked", label: `Locked (${counts.locked})` },
    { key: "completed", label: `Completed (${counts.completed})` },
  ];

  // No wallet
  if (!owner) {
    return (
      <div
        className="rounded-[12px] py-16 text-center"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
        }}
      >
        <h2
          className="mb-2"
          style={{
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: "-0.015em",
            color: "var(--h-ink)",
          }}
        >
          Connect your wallet
        </h2>
        <p style={{ color: "var(--h-ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Connect a Solana wallet to see your jars.
        </p>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div>
        <div
          className="mb-6 h-[132px] animate-pulse rounded-[22px]"
          style={{ background: "var(--h-bg-2)" }}
        />
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-[22px]"
              style={{ background: "var(--h-bg-2)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div
        className="rounded-[12px] py-16 text-center"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
        }}
      >
        <h2
          className="mb-2"
          style={{
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: "-0.015em",
            color: "var(--h-ink)",
          }}
        >
          Couldn&apos;t load your jars
        </h2>
        <p style={{ color: "var(--h-ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Something went wrong. Try refreshing.
        </p>
      </div>
    );
  }

  // No jars
  if (jars.length === 0) {
    return (
      <div
        className="flex flex-col items-center rounded-[12px] py-20"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
        }}
      >
        <h2
          className="mb-2"
          style={{
            fontSize: 28,
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "var(--h-ink)",
          }}
        >
          No jars yet
        </h2>
        <p
          className="mb-6 max-w-xs text-center"
          style={{ color: "var(--h-ink-2)", fontSize: 15, lineHeight: 1.6 }}
        >
          Create your first jar and start saving.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 rounded-[8px] px-6 py-3 transition-colors"
          style={{
            background: "var(--h-accent)",
            color: "#F1F0EC",
            fontSize: 14.5,
            fontWeight: 500,
          }}
        >
          Create a jar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <StatsStrip stats={stats} />
      </motion.div>

      <FilterBar
        tabs={filterTabs}
        activeTab={filter}
        onTabSelect={setFilter}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
      />

      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty-filter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-16 text-center text-[15px]"
            style={{ color: "var(--h-ink-3)" }}
          >
            No jars match this filter.
          </motion.div>
        ) : (
          <motion.div
            key={filter + search + view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={
              view === "grid"
                ? "grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1"
                : "flex flex-col gap-2"
            }
          >
            {view === "list" && (
              <div
                className="grid items-center gap-4 px-4 pb-1 text-[10px] uppercase tracking-[0.08em]"
                style={{
                  color: "var(--h-ink-3)",
                  gridTemplateColumns:
                    "48px minmax(0, 1fr) 220px 160px 96px 16px",
                }}
              >
                <span />
                <span>Jar</span>
                <span>Progress</span>
                <span className="text-right">Collected</span>
                <span>Status</span>
                <span />
              </div>
            )}
            {filtered.map((jar, i) =>
              view === "grid" ? (
                <JarCard
                  key={jar.pda}
                  pda={jar.pda}
                  title={jar.title?.trim() || "Untitled jar"}
                  emoji={jar.emoji}
                  coverUrl={jar.coverUrl}
                  asset={jar.asset}
                  totalContributed={parseAmount(jar.totalContributed, jar.asset)}
                  goalAmount={jar.goalAmount ? parseAmount(jar.goalAmount, jar.asset) : undefined}
                  status={jar.status}
                  stakingEnabled={jar.stakingEnabled}
                  unlockTimestamp={jar.unlockTimestamp}
                  index={i}
                />
              ) : (
                <JarRow
                  key={jar.pda}
                  pda={jar.pda}
                  title={jar.title?.trim() || "Untitled jar"}
                  emoji={jar.emoji}
                  coverUrl={jar.coverUrl}
                  asset={jar.asset}
                  totalContributed={parseAmount(jar.totalContributed, jar.asset)}
                  goalAmount={jar.goalAmount ? parseAmount(jar.goalAmount, jar.asset) : undefined}
                  status={jar.status}
                  stakingEnabled={jar.stakingEnabled}
                  unlockTimestamp={jar.unlockTimestamp}
                  index={i}
                />
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
