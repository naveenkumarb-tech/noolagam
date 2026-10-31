import { useState } from "react";

const PLACEHOLDER_COLORS = ["#7C2D12", "#1E3A8A", "#334155", "#065F46", "#581C87", "#115E59", "#9F1239"];

function colorFor(title: string): string {
  let hash = 0;
  for (const character of title) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 2147483647;
  }
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length];
}

type CoverProps = {
  title: string;
  coverUrl: string | null;
  /** Width and height, for example "w-[72px] h-[108px]". */
  sizeClass: string;
  showTitle?: boolean;
};

/** Uploaded photos are served by the API, which in the Android app isn't at the page's own address. */
function imageSource(coverUrl: string): string {
  return coverUrl.startsWith("/") ? `${import.meta.env.VITE_API_URL ?? ""}${coverUrl}` : coverUrl;
}

export function Cover({ title, coverUrl, sizeClass, showTitle = true }: CoverProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  // The image sits on top of the placeholder, which shows while it loads and if it fails.
  return (
    <div
      style={{ backgroundColor: colorFor(title) }}
      className={`relative flex flex-none items-end overflow-hidden rounded-md p-2 text-[11px] leading-[1.2] font-bold text-white ${sizeClass}`}
    >
      {showTitle && (
        <span aria-hidden="true" className="line-clamp-4 min-w-0 wrap-anywhere">
          {title}
        </span>
      )}
      {coverUrl && coverUrl !== failedUrl && (
        <img
          src={imageSource(coverUrl)}
          alt=""
          onError={() => setFailedUrl(coverUrl)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
