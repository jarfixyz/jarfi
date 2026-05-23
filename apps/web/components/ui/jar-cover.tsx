import Image from "next/image";

interface JarCoverProps {
  coverUrl?: string | null;
  emoji?: string;
  height: number;
  className?: string;
}

export function JarCover({
  coverUrl,
  emoji,
  height,
  className = "",
}: JarCoverProps) {
  const emojiFromUrl = coverUrl?.startsWith("emoji:")
    ? coverUrl.slice("emoji:".length)
    : null;
  const resolvedEmoji = emojiFromUrl ?? emoji;
  const imageUrl = coverUrl && !emojiFromUrl ? coverUrl : null;

  if (imageUrl) {
    return (
      <div
        className={`w-full overflow-hidden rounded-[20px] bg-bg-alt ${className}`}
        style={{ height }}
      >
        <Image
          src={imageUrl}
          alt="cover"
          width={1200}
          height={height}
          sizes="(max-width: 768px) 100vw, 600px"
          className="h-full w-full object-cover object-top"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={`flex w-full items-center justify-center overflow-hidden rounded-[20px] bg-coral-soft ${className}`}
      style={{ height }}
    >
      <span style={{ fontSize: height * 0.36 }}>{resolvedEmoji ?? "🫙"}</span>
    </div>
  );
}
