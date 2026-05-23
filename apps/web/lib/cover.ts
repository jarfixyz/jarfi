export interface ProcessedCover {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  hash16: string;
  extension: "webp" | "jpg";
}

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;
const WEBP_QUALITY = 0.85;
const JPEG_QUALITY = 0.85;

export const COVER_ASPECT = 16 / 9;

export function buildCoverUrl(jarPda: string, c: ProcessedCover): string {
  return `/api/metadata/${jarPda}/cover/${c.hash16}.${c.extension}`;
}

export async function processCover(args: {
  source: CanvasImageSource & { width: number; height: number };
  crop: Crop;
}): Promise<ProcessedCover> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(
    args.source,
    args.crop.x,
    args.crop.y,
    args.crop.width,
    args.crop.height,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT,
  );

  const webp = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  if (webp) {
    return finalize(webp, "image/webp", "webp");
  }
  const jpeg = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (!jpeg) throw new Error("Failed to encode cover as webp or jpeg");
  return finalize(jpeg, "image/jpeg", "jpg");
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  return await new Response(blob).arrayBuffer();
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function finalize(
  blob: Blob,
  contentType: "image/webp" | "image/jpeg",
  extension: "webp" | "jpg",
): Promise<ProcessedCover> {
  const buf = await blobToArrayBuffer(blob);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { blob, contentType, hash16: hex.slice(0, 16), extension };
}
