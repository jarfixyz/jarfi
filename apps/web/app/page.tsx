import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "jarfi — a jar for your goal",
  description:
    "Create a jar, set a goal, share a link. Family and friends chip in with a bank card. Staking compounds quietly and the jar unlocks automatically.",
};

export default function Page() {
  return <LandingPage />;
}
