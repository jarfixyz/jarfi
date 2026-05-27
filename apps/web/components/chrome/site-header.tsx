import Link from "next/link";
import { ConnectButton } from "@/lib/wallet/connect-button";

export function SiteHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "saturate(140%) blur(10px)",
        WebkitBackdropFilter: "saturate(140%) blur(10px)",
        borderBottom: "0.5px solid rgba(20,21,26,0.08)",
        fontFamily: "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <nav
        className="flex items-center justify-between gap-4"
        style={{ padding: "16px 32px" }}
      >
        <Link
          href="/"
          style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "#14151A",
          }}
        >
          jarfi
        </Link>

        <div
          className="hidden md:flex items-center gap-7"
          style={{ color: "#4A4D57", fontSize: 13.5 }}
        >
          <Link href="/#how" className="hover:text-[#14151A]">
            How it works
          </Link>
          <Link href="/#cases" className="hover:text-[#14151A]">
            Use cases
          </Link>
          <Link href="/dashboard" className="hover:text-[#14151A]">
            Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          <ConnectButton />
          <Link
            href="/create"
            className="hidden sm:inline-flex items-center rounded-[8px] transition-colors"
            style={{
              background: "#2B3038",
              color: "#E8E7E2",
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Create a jar
          </Link>
        </div>
      </nav>
    </header>
  );
}
