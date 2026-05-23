"use client";

import dynamic from "next/dynamic";

const MarkdownImpl = dynamic(() => import("./markdown-impl"), {
  ssr: false,
  loading: () => null,
});

export function Markdown({ source }: { source: string }) {
  return <MarkdownImpl source={source} />;
}
