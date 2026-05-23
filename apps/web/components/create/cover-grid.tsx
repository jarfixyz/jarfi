"use client";

import { useRef, useState } from "react";
import { CoverCropperModal } from "@/components/ui/cover-cropper-modal";
import type { ProcessedCover } from "@/lib/cover";

const EMOJIS = ["🎂", "🎁", "✈️", "🏠", "🎓", "🍕", "💍", "🚗", "💰", "🎮", "🐶", "☀️", "🎵", "⚽", "🧸"];

interface CoverGridProps {
  selectedEmoji: string | null;
  uploadedPhoto: ProcessedCover | null;
  onSelectEmoji: (emoji: string) => void;
  onUploadPhoto: (photo: ProcessedCover) => void;
}

export function CoverGrid({
  selectedEmoji,
  uploadedPhoto,
  onSelectEmoji,
  onUploadPhoto,
}: CoverGridProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    setCropOpen(true);
    e.target.value = "";
  }

  const photoSelected = uploadedPhoto && !selectedEmoji;

  return (
    <>
      <div className="grid grid-cols-8 gap-2 max-md:grid-cols-6">
        {/* Photo upload button — first slot */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[8px] transition-colors"
          style={{
            background: photoSelected ? "var(--h-bg-2)" : "var(--h-bg)",
            border: photoSelected
              ? "0.5px solid var(--h-ink)"
              : "0.5px dashed var(--h-line-2)",
            overflow: "hidden",
          }}
        >
          {photoSelected ? (
            <img
              src={URL.createObjectURL(uploadedPhoto.blob)}
              alt="Cover"
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <span className="text-sm" style={{ color: "var(--h-ink-3)" }}>
                ↑
              </span>
              <span
                className="text-[9px] font-medium uppercase tracking-[0.05em]"
                style={{ color: "var(--h-ink-3)" }}
              >
                Photo
              </span>
            </>
          )}
        </button>
        {EMOJIS.map((emoji) => {
          const isSelected = selectedEmoji === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelectEmoji(emoji)}
              className="flex aspect-square items-center justify-center rounded-[8px] text-[22px] transition-colors"
              style={{
                background: isSelected
                  ? "var(--h-bg-2)"
                  : "var(--h-bg)",
                border: isSelected
                  ? "0.5px solid var(--h-ink)"
                  : "0.5px solid var(--h-line)",
              }}
              onMouseEnter={(e) => {
                if (!isSelected)
                  e.currentTarget.style.borderColor = "var(--h-line-2)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected)
                  e.currentTarget.style.borderColor = "var(--h-line)";
              }}
            >
              {emoji}
            </button>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <CoverCropperModal
        open={cropOpen}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) setCropFile(null);
        }}
        file={cropFile}
        onDone={(processed) => {
          onUploadPhoto(processed);
          setCropOpen(false);
          setCropFile(null);
        }}
      />
    </>
  );
}
