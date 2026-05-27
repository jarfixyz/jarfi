import { customAlphabet } from "nanoid";

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const LENGTH = 7;

export const generateShortId = customAlphabet(ALPHABET, LENGTH);
export const randomSuffix = customAlphabet("0123456789", 3);

const SLUG_MAX = 48;
const SLUG_MIN = 2;
const RESERVED = new Set([
  "api",
  "create",
  "dashboard",
  "jar",
  "j",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  і: "i", ї: "yi", є: "ye", ґ: "g",
};

function transliterate(input: string): string {
  let out = "";
  for (const ch of input.toLowerCase()) {
    out += CYRILLIC[ch] ?? ch;
  }
  return out;
}

export function slugifyTitle(title: string): string {
  let s = transliterate(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
  if (!s || s.length < SLUG_MIN || RESERVED.has(s)) s = "jar";
  return s;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}
