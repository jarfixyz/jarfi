export type JarImageKey = "baby" | "travel" | "house" | "bike" | "graduation" | "ring" | "gift" | "car";

export const JAR_IMAGE_LABELS: Record<JarImageKey, string> = {
  baby:       "Baby",
  travel:     "Travel",
  house:      "House",
  bike:       "Bike",
  graduation: "Education",
  ring:       "Wedding",
  gift:       "Gift",
  car:        "Car",
};

// Tint per image: { bg, illo } colors
export const JAR_IMAGE_TINTS: Record<JarImageKey, { bg: string; illo: string }> = {
  baby:       { bg: "#E5F0E8", illo: "#1F8A5B" },
  travel:     { bg: "#E2EBF7", illo: "#3B5BA5" },
  house:      { bg: "#FBF1D6", illo: "#A87A1F" },
  bike:       { bg: "#FCE8DC", illo: "#B5582A" },
  graduation: { bg: "#DDEFE8", illo: "#1F7F60" },
  ring:       { bg: "#EFE7F4", illo: "#6B4585" },
  gift:       { bg: "#F8E4E4", illo: "#A04050" },
  car:        { bg: "#ECEAE5", illo: "#5E5950" },
};

export const JAR_IMAGE_ORDER: JarImageKey[] = [
  "baby", "travel", "house", "bike", "graduation", "ring", "gift", "car",
];

// Raw SVG strings — use currentColor for tint, render via dangerouslySetInnerHTML
export const JAR_SVGS: Record<JarImageKey, string> = {
  travel: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="60" r="44" fill="#fff" opacity="0.55"/><path d="M58 78 L132 50 C140 47 148 50 150 56 L152 60 L74 88 Z" fill="currentColor"/><path d="M88 70 L100 48 L108 46 L102 68 Z" fill="currentColor"/><path d="M118 60 L132 38 L140 36 L132 58 Z" fill="currentColor"/><circle cx="60" cy="86" r="3" fill="currentColor"/><path d="M50 92 L70 90" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  car: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="60" r="44" fill="#fff" opacity="0.55"/><path d="M50 72 L60 56 C62 53 65 51 69 51 L131 51 C135 51 138 53 140 56 L150 72 L150 84 C150 86 148 88 146 88 L54 88 C52 88 50 86 50 84 Z" fill="currentColor"/><rect x="68" y="56" width="28" height="14" rx="2" fill="#fff" opacity="0.4"/><rect x="104" y="56" width="28" height="14" rx="2" fill="#fff" opacity="0.4"/><circle cx="68" cy="88" r="8" fill="#0a0a0a"/><circle cx="68" cy="88" r="3" fill="#fff"/><circle cx="132" cy="88" r="8" fill="#0a0a0a"/><circle cx="132" cy="88" r="3" fill="#fff"/></svg>`,
  house: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="60" r="44" fill="#fff" opacity="0.55"/><path d="M60 88 L60 64 L100 38 L140 64 L140 88 Z" fill="currentColor"/><path d="M55 66 L100 36 L145 66" stroke="currentColor" stroke-width="3" fill="none" stroke-linejoin="round"/><rect x="92" y="68" width="16" height="20" fill="#fff" opacity="0.6"/><rect x="70" y="70" width="14" height="10" fill="#fff" opacity="0.4"/><rect x="116" y="70" width="14" height="10" fill="#fff" opacity="0.4"/></svg>`,
  gift: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="60" r="44" fill="#fff" opacity="0.55"/><rect x="62" y="58" width="76" height="34" rx="3" fill="currentColor"/><rect x="62" y="50" width="76" height="12" rx="2" fill="currentColor"/><rect x="94" y="50" width="12" height="42" fill="#fff" opacity="0.6"/><path d="M100 50 C92 42 80 42 80 50 C80 54 88 54 100 50 Z" fill="currentColor"/><path d="M100 50 C108 42 120 42 120 50 C120 54 112 54 100 50 Z" fill="currentColor"/></svg>`,
  baby: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="60" r="44" fill="#fff" opacity="0.55"/><circle cx="100" cy="60" r="24" fill="currentColor"/><circle cx="92" cy="58" r="2.5" fill="#fff"/><circle cx="108" cy="58" r="2.5" fill="#fff"/><path d="M92 68 Q100 74 108 68" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="80" cy="48" r="6" fill="currentColor" opacity="0.6"/><circle cx="120" cy="48" r="6" fill="currentColor" opacity="0.6"/></svg>`,
  bike: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="60" r="44" fill="#fff" opacity="0.55"/><circle cx="70" cy="78" r="14" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="130" cy="78" r="14" fill="none" stroke="currentColor" stroke-width="3"/><path d="M70 78 L92 50 L120 50 L130 78" stroke="currentColor" stroke-width="3" fill="none" stroke-linejoin="round"/><path d="M92 50 L106 78" stroke="currentColor" stroke-width="3"/><circle cx="100" cy="78" r="3" fill="currentColor"/></svg>`,
  ring: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="60" r="44" fill="#fff" opacity="0.55"/><circle cx="100" cy="74" r="20" fill="none" stroke="currentColor" stroke-width="5"/><path d="M88 50 L100 36 L112 50 L106 56 L94 56 Z" fill="currentColor"/><path d="M94 56 L100 64 L106 56" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  graduation: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="60" r="44" fill="#fff" opacity="0.55"/><path d="M60 58 L100 42 L140 58 L100 74 Z" fill="currentColor"/><path d="M76 64 L76 80 C76 84 88 88 100 88 C112 88 124 84 124 80 L124 64" fill="currentColor"/><path d="M140 58 L140 76" stroke="currentColor" stroke-width="2"/><circle cx="140" cy="78" r="3" fill="currentColor"/></svg>`,
};
