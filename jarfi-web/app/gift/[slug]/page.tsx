import { use } from "react";
import GiftClient from "./GiftClient";

export const runtime = "edge";

export default function GiftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <GiftClient slug={slug} />;
}
