"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import type { Area, default as CropperType } from "react-easy-crop";
import { Modal } from "./modal";

const Cropper = dynamicImport(() => import("react-easy-crop"), {
  ssr: false,
  loading: () => null,
}) as unknown as typeof CropperType;
import { Button } from "./button";
import { COVER_ASPECT, processCover, type ProcessedCover } from "@/lib/cover";

interface CoverCropperModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onDone: (result: ProcessedCover) => void;
}

export function CoverCropperModal({
  open,
  onOpenChange,
  file,
  onDone,
}: CoverCropperModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setPixelCrop(null);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setPixelCrop(areaPixels);
  }, []);

  const handleDone = async () => {
    if (!imageUrl || !pixelCrop) return;
    setRunning(true);
    setError(null);
    try {
      const source = await loadImage(imageUrl);
      imgRef.current = source;
      const result = await processCover({
        source,
        crop: {
          x: pixelCrop.x,
          y: pixelCrop.y,
          width: pixelCrop.width,
          height: pixelCrop.height,
        },
      });
      onDone(result);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process image");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Crop cover">
      <div className="flex flex-col gap-4">
        <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-cream">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={COVER_ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <label className="flex items-center gap-3 text-sm text-mute">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
          />
        </label>
        {error && <p className="text-sm text-coral-deep">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDone} disabled={running || !pixelCrop}>
            {running ? "Processing…" : "Done"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}
