import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchJarByShortId } from "@/lib/jar-fetch";
import { JarView } from "@/components/jar/jar-view";

export const revalidate = 30;

type Params = { shortId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { shortId } = await params;
  const jar = await fetchJarByShortId(shortId);
  if (!jar) return { title: "Jar not found — jarfi" };
  return {
    title: `${jar.metadata.title} — jarfi`,
    description: jar.metadata.description.slice(0, 200),
    openGraph: {
      title: jar.metadata.title,
      description: jar.metadata.description.slice(0, 200),
      images: [`/j/${shortId}/opengraph-image`],
      type: "website",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function JarPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { shortId } = await params;
  const jar = await fetchJarByShortId(shortId);
  if (!jar) notFound();
  return <JarView jar={jar} shortId={shortId} />;
}
