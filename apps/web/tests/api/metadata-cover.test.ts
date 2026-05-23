import { describe, it, expect } from "vitest";
import { parseCoverUrl } from "@/app/api/metadata/upload/cover-url";

describe("parseCoverUrl", () => {
  it("extracts pda + hash + ext from a webp URL", () => {
    const parsed = parseCoverUrl(
      "/api/metadata/JarPda111/cover/0123456789abcdef.webp",
    );
    expect(parsed).toEqual({
      jarPda: "JarPda111",
      hash16: "0123456789abcdef",
      ext: "webp",
    });
  });

  it("extracts pda + hash + ext from a jpg URL", () => {
    const parsed = parseCoverUrl(
      "/api/metadata/JarPda222/cover/fedcba9876543210.jpg",
    );
    expect(parsed).toEqual({
      jarPda: "JarPda222",
      hash16: "fedcba9876543210",
      ext: "jpg",
    });
  });

  it("rejects URLs that don't match the pattern", () => {
    expect(parseCoverUrl("/api/metadata/JarPda/cover/short.webp")).toBeNull();
    expect(parseCoverUrl("https://example.com/cover.webp")).toBeNull();
    expect(parseCoverUrl(null)).toBeNull();
    expect(parseCoverUrl(undefined)).toBeNull();
  });
});
