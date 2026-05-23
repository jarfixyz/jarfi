import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchJarByPda } from "@/lib/jar-fetch";
import { JarView } from "@/components/jar/jar-view";

export const revalidate = 30;

type Params = { pda: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pda } = await params;
  const jar = await fetchJarByPda(pda);
  if (!jar) return { title: "Jar not found — jarfi" };
  return {
    title: `${jar.metadata.title} — jarfi`,
    description: jar.metadata.description.slice(0, 200),
  };
}

export default async function ArchivalJarPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { pda } = await params;
  const jar = await fetchJarByPda(pda);
  if (!jar) notFound();
  return <JarView jar={jar} shortId={jar.shortId} />;
}
