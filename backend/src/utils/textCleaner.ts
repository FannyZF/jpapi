const KANJI_RE = /[\u4E00-\u9FFF]/;
const HIRAGANA_RE = /[\u3040-\u309F]/;
const KATAKANA_RE = /[\u30A0-\u30FF]/;
const PURE_EN_RE = /^[a-zA-Z0-9\s.,\-/()]+$/;

export function isKanji(str: string): boolean {
  return KANJI_RE.test(str);
}

export function isHiragana(str: string): boolean {
  return HIRAGANA_RE.test(str);
}

export function isKatakana(str: string): boolean {
  return KATAKANA_RE.test(str);
}

export function isPureEnglish(str: string): boolean {
  return PURE_EN_RE.test(str) && !KANJI_RE.test(str) && !KATAKANA_RE.test(str);
}

export function hasJapaneseChars(str: string): boolean {
  return KANJI_RE.test(str) || HIRAGANA_RE.test(str) || KATAKANA_RE.test(str);
}

export function cleanZipcode(zip: string): string {
  return zip.replace(/[\s\-]/g, "");
}

export function formatZipcode(zip: string): string {
  const cleaned = cleanZipcode(zip);
  if (cleaned.length === 7) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  return cleaned;
}

export function sanitize(str: string): string {
  return str.trim().replace(/\s+/g, " ");
}

export function normalizeAddress(raw: string): string {
  return sanitize(raw.toLowerCase());
}
