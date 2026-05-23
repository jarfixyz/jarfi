// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  buildJarMetadata,
  canonicalize,
  hashMetadata,
} from "@/lib/metadata";

describe("metadata", () => {
  it("builds metadata with version 1 and passthrough fields", () => {
    const meta = buildJarMetadata({
      title: "Rent jar",
      description: "Save up",
      coverUrl: null,
      disableContributors: false,
    });
    expect(meta.version).toBe(1);
    expect(meta.title).toBe("Rent jar");
  });

  it("canonicalizes to deterministic JSON", () => {
    const a = canonicalize(
      buildJarMetadata({
        title: "A",
        description: "d",
        coverUrl: null,
        disableContributors: false,
      }),
    );
    const b = canonicalize(
      buildJarMetadata({
        title: "A",
        description: "d",
        coverUrl: null,
        disableContributors: false,
      }),
    );
    expect(a).toBe(b);
  });

  it("hashes to a 32-byte Uint8Array", async () => {
    const meta = buildJarMetadata({
      title: "Goal",
      description: "",
      coverUrl: null,
      disableContributors: false,
    });
    const h = await hashMetadata(meta);
    expect(h).toBeInstanceOf(Uint8Array);
    expect(h.byteLength).toBe(32);
  });
});
