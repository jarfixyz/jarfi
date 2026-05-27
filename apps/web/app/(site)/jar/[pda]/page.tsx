import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchJarByPda } from "@/lib/jar-fetch";
import { JarView } from "@/components/jar/jar-view";
import { JarFinalizing } from "@/components/jar/jar-finalizing";

export const revalidate = 30;

type Params = { pda: string };
type Search = { created?: string };

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
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { pda } = await params;
  const { created } = await searchParams;
  const jar = await fetchJarByPda(pda);
  if (!jar) {
    if (created === "1") return <JarFinalizing pda={pda} />;
    notFound();
  }
  return <JarView jar={jar} shortId={jar.shortId} />;
}
