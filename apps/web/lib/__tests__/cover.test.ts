import { describe, it, expect } from "vitest";
import { buildCoverUrl, processCover, type ProcessedCover } from "@/lib/cover";

describe("buildCoverUrl", () => {
  const webpCover: ProcessedCover = {
    blob: new Blob(["x"], { type: "image/webp" }),
    contentType: "image/webp",
    hash16: "0123456789abcdef",
    extension: "webp",
  };

  it("returns the content-addressed path for a webp cover", () => {
    const url = buildCoverUrl("JarPda111111111111111111111111111111111111", webpCover);
    expect(url).toBe(
      "/api/metadata/JarPda111111111111111111111111111111111111/cover/0123456789abcdef.webp",
    );
  });

  it("uses the .jpg extension for jpeg fallback covers", () => {
    const jpeg: ProcessedCover = { ...webpCover, contentType: "image/jpeg", extension: "jpg" };
    const url = buildCoverUrl("JarPda222222222222222222222222222222222222", jpeg);
    expect(url).toBe(
      "/api/metadata/JarPda222222222222222222222222222222222222/cover/0123456789abcdef.jpg",
    );
  });
});

describe("processCover", () => {
  const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

  function installCanvasStubs(blobBytes: Uint8Array, blobType: string) {
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (type: string) => CanvasRenderingContext2D;
      toBlob: (cb: (b: Blob | null) => void, type?: string, quality?: number) => void;
    };
    proto.getContext = () => ({ drawImage: () => {} }) as unknown as CanvasRenderingContext2D;
    proto.toBlob = (cb, type) => cb(new Blob([blobBytes as BlobPart], { type: type ?? blobType }));
  }

  it("produces a webp blob with a 16-char sha256 prefix", async () => {
    installCanvasStubs(webpBytes, "image/webp");
    const fakeImg = { width: 800, height: 600 } as HTMLImageElement;
    const result = await processCover({
      source: fakeImg,
      crop: { x: 0, y: 0, width: 600, height: 600 },
    });
    expect(result.contentType).toBe("image/webp");
    expect(result.extension).toBe("webp");
    expect(result.hash16).toMatch(/^[0-9a-f]{16}$/);
    expect(result.blob.type).toBe("image/webp");
  });

  it("falls back to jpeg when webp encoding returns null", async () => {
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (type: string) => CanvasRenderingContext2D;
      toBlob: (cb: (b: Blob | null) => void, type?: string) => void;
    };
    proto.getContext = () => ({ drawImage: () => {} }) as unknown as CanvasRenderingContext2D;
    let call = 0;
    proto.toBlob = (cb, type) => {
      call += 1;
      if (call === 1 && type === "image/webp") return cb(null);
      cb(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }));
    };
    const fakeImg = { width: 400, height: 400 } as HTMLImageElement;
    const result = await processCover({
      source: fakeImg,
      crop: { x: 0, y: 0, width: 400, height: 400 },
    });
    expect(result.contentType).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
    expect(result.hash16).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces a stable hash for identical input", async () => {
    installCanvasStubs(webpBytes, "image/webp");
    const fakeImg = { width: 1000, height: 1000 } as HTMLImageElement;
    const crop = { x: 10, y: 10, width: 500, height: 500 };
    const a = await processCover({ source: fakeImg, crop });
    const b = await processCover({ source: fakeImg, crop });
    expect(a.hash16).toBe(b.hash16);
  });
});
