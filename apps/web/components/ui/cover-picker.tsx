"use client";

import { useEffect, useRef, useState } from "react";
import { CoverCropperModal } from "@/components/ui/cover-cropper-modal";
import { Bub } from "@/components/ui/bub";
import type { ProcessedCover } from "@/lib/cover";
import { cn } from "@/lib/cn";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;

interface CoverPickerProps {
  value: ProcessedCover | null;
  initialUrl?: string | null;
  onChange: (next: ProcessedCover | null) => void;
  className?: string;
}

export function CoverPicker({ value, initialUrl, onChange, className }: CoverPickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value.blob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [value]);

  const openPicker = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Unsupported file type");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("File too large (max 20 MB)");
      return;
    }
    setPendingFile(file);
    setCropperOpen(true);
  };

  const renderBody = () => {
    if (previewUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Cover preview" className="h-full w-full object-cover" />
      );
    }
    if (initialUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={initialUrl} alt="Current cover" className="h-full w-full object-cover" />
      );
    }
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-mute">
        <Bub size={72} />
        <span className="text-xs">Upload a cover</span>
      </div>
    );
  };

  const hasSomething = value !== null || Boolean(initialUrl);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <button
        type="button"
        onClick={openPicker}
        className="flex aspect-video w-80 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-line bg-cream transition hover:border-coral"
      >
        {renderBody()}
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={openPicker}
          className="rounded-full border-2 border-line bg-paper px-4 py-1.5 text-xs font-semibold text-ink transition hover:border-coral hover:bg-coral-soft"
        >
          {hasSomething ? "Change" : "Upload"}
        </button>
        {hasSomething && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              onChange(null);
            }}
            className="rounded-full border-2 border-line bg-paper px-4 py-1.5 text-xs font-semibold text-ink transition hover:border-coral hover:bg-coral-soft"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-xs font-semibold text-coral-deep">{error}</p>}
      <input
        ref={fileInputRef}
        data-testid="cover-file-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <CoverCropperModal
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        file={pendingFile}
        onDone={(result) => {
          onChange(result);
          setPendingFile(null);
        }}
      />
    </div>
  );
}
