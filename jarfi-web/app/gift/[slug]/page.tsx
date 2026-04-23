import GiftClient from "./GiftClient";

export const runtime = "edge";

export default async function GiftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <GiftClient slug={slug} />;
}
