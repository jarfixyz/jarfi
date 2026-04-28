"use client";

export const runtime = "edge";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { fetchGroup, joinGroupApi, type GroupInfo } from "@/lib/api";
import { Copy, X, Users, Calendar, Target, Loader2 } from "lucide-react";

export default function TripPage({ params }: { params: Promise<{ jar: string }> }) {
  const { jar: jarPubkey } = use(params);
  const { publicKey } = useWallet();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [nickname, setNickname] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroup(jarPubkey)
      .then(setGroup)
      .catch(() => setError("Не вдалося завантажити інформацію про поїздку"))
      .finally(() => setLoading(false));
  }, [jarPubkey]);

  const isMember = group?.members.some(m => m.pubkey === publicKey?.toBase58());

  const daysLeft = group ? Math.max(0, Math.ceil((group.trip_date * 1000 - Date.now()) / 86_400_000)) : 0;
  const tripDateLabel = group
    ? new Date(group.trip_date * 1000).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })
    : "";

  async function handleJoin() {
    if (!publicKey || !group) return;
    setJoining(true);
    const updated = await joinGroupApi(jarPubkey, {
      owner_pubkey: publicKey.toBase58(),
      nickname: nickname.trim() || publicKey.toBase58().slice(0, 6),
    });
    if (updated) setGroup(updated);
    setJoining(false);
    setJoinModal(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/trip/${jarPubkey}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <Loader2 className="h-8 w-8 animate-spin text-sol-purple" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAFAF8] text-center">
        <div className="text-5xl">🏺</div>
        <div className="font-display text-xl font-semibold">Поїздку не знайдено</div>
        <Link href="/" className="text-sm text-sol-purple underline">На головну</Link>
      </div>
    );
  }

  const totalGoal = (group.budget_per_person_cents / 100) * group.members.length;
  const totalSaved = group.members.reduce((s, m) => s + m.contributed_cents / 100, 0);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-bold">🏺 JAR</Link>
        <WalletButton />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Trip hero */}
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-surface-lavender via-white to-surface-mint p-8 text-center shadow-sm">
          <div className="mb-2 text-6xl">{group.destination_emoji}</div>
          <h1 className="font-display text-3xl font-bold">{group.trip_name}</h1>
          <div className="mt-3 flex justify-center gap-6 text-sm text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> {tripDateLabel}
              {daysLeft > 0 && <span className="ml-1 rounded-full bg-sol-purple/10 px-2 py-0.5 text-[11px] font-semibold text-sol-purple">{daysLeft} днів</span>}
            </span>
            <span className="flex items-center gap-1.5">
              <Target className="h-4 w-4" /> ${(group.budget_per_person_cents / 100).toLocaleString()} / особу
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {group.members.length} учасників
            </span>
          </div>
        </div>

        {/* Total progress */}
        <div className="mb-6 rounded-2xl bg-white border border-black/5 p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-lg font-semibold">Загальний прогрес</span>
            <span className="text-sm font-semibold text-sol-purple">{group.total_progress_pct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sol-purple to-sol-blue transition-all"
              style={{ width: `${group.total_progress_pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink-muted">
            <span>${totalSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} зібрано</span>
            <span>Ціль ${totalGoal.toLocaleString()}</span>
          </div>
        </div>

        {/* Members */}
        <div className="mb-6 rounded-2xl bg-white border border-black/5 p-6">
          <h2 className="mb-4 font-display text-base font-semibold">Учасники ({group.members.length})</h2>
          <div className="space-y-4">
            {group.members.map((m, i) => {
              const gradients = [
                "from-sol-purple to-sol-blue",
                "from-sol-green to-sol-blue",
                "from-orange-400 to-yellow-400",
                "from-red-400 to-orange-400",
                "from-pink-400 to-purple-400",
              ];
              const grad = gradients[i % gradients.length];
              const saved = m.contributed_cents / 100;
              const goal = group.budget_per_person_cents / 100;
              const done = m.progress_pct >= 100;
              return (
                <div key={m.pubkey}>
                  <div className="mb-1.5 flex items-center gap-3">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${grad} text-sm font-bold text-white`}>
                      {m.nickname[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{m.nickname}</span>
                        <span className={`text-xs font-semibold ${done ? "text-sol-green" : "text-ink-muted"}`}>
                          {done ? "✅ Готово" : `$${saved.toFixed(0)} / $${goal.toLocaleString()}`}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all`}
                          style={{ width: `${m.progress_pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!publicKey ? (
            <div className="flex-1">
              <WalletButton />
            </div>
          ) : isMember ? (
            <div className="flex-1 rounded-2xl border border-black/5 bg-white px-4 py-3 text-center text-sm font-medium text-sol-green">
              ✅ Ти вже в групі
            </div>
          ) : (
            <button
              onClick={() => setJoinModal(true)}
              className="flex-1 rounded-full bg-ink py-3.5 text-sm font-medium text-white hover:bg-ink/90"
            >
              Приєднатись до поїздки
            </button>
          )}
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium hover:bg-black/5"
          >
            <Copy className="h-4 w-4" /> {copied ? "Скопійовано!" : "Поділитись"}
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-ink-muted">
          Внески через банківську картку — не потрібен крипто-гаманець
        </p>
      </div>

      {/* Join modal */}
      {joinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setJoinModal(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="font-display text-xl font-semibold">Приєднатись</div>
                <div className="mt-0.5 text-sm text-ink-muted">Введи своє ім&apos;я у групі</div>
              </div>
              <button onClick={() => setJoinModal(false)} className="rounded-full p-2 hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              placeholder="Твоє ім'я (напр. Аня)"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-[#FAFAF8] px-4 py-3 text-sm outline-none focus:border-sol-purple"
              onKeyDown={e => e.key === "Enter" && handleJoin()}
            />
            <button
              onClick={handleJoin}
              disabled={joining}
              className="mt-4 w-full rounded-full bg-ink py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {joining ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Приєднатись ✈️"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
