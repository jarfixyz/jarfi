import GiftClient from "./GiftClient";
import { getMarinadeAPY } from "@/lib/marinade";

export const runtime = "edge";

export default async function GiftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const apy = await getMarinadeAPY();
  return <GiftClient slug={slug} apy={apy} />;
}
