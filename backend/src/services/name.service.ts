import { fetchYahooFurigana } from "./yahooFurigana";
import {
  convertToKatakanaLocal,
  convertNameToRomaji,
  toKatakanaWrapper,
} from "./localNlp";
import { isPureEnglish } from "../utils/textCleaner";
import { cacheGet, cacheSet } from "./cache";
import { getCredential } from "./cache";
import axios from "axios";
import type { NameCleanseResponse } from "../schemas/name";

type Source = "live" | "cache" | "fallback";
type NameServiceResult = NameCleanseResponse["data"] & { source: Source };

const KANJI_CACHE_PREFIX = "name:kanji:";

async function convertRomajiToKanji(romaji: string): Promise<string | null> {
  const cacheKey = KANJI_CACHE_PREFIX + romaji.toLowerCase().trim();
  const cached = await cacheGet<string>(cacheKey);
  if (cached) return cached;

  const key = await getCredential("DEEPSEEK_API_KEY");
  if (!key || key.startsWith("sk-your") || key.length < 20) return null;

  try {
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a Japanese name converter. Convert the given Romaji name to the most common Japanese Kanji name. Output ONLY the Kanji name with spaces between family and given name, nothing else. No explanation, no markdown." },
          { role: "user", content: romaji },
        ],
        temperature: 0,
        max_tokens: 50,
      },
      {
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        timeout: 6000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content?.trim();
    if (!content || content.length > 50 || /[a-zA-Z]{3,}/.test(content)) return null;

    await cacheSet(cacheKey, content);
    return content;
  } catch {
    return null;
  }
}

export async function cleanseName(
  orderId: string,
  rawName: string
): Promise<NameServiceResult> {
  let katakana: string;
  let kanji: string | null = null;
  let source: Source = "live";

  if (isPureEnglish(rawName)) {
    katakana = toKatakanaWrapper(rawName);
    kanji = await convertRomajiToKanji(rawName);
    source = "fallback";
  } else {
    const yahooRes = await fetchYahooFurigana(rawName);

    if (yahooRes) {
      katakana = yahooRes.katakana;
      source = yahooRes.source;
    } else {
      katakana = await convertToKatakanaLocal(rawName);
      source = "fallback";
    }
  }

  const englishRomaji = await convertNameToRomaji(katakana);

  return {
    name: {
      original: rawName,
      japanese_katakana: katakana,
      japanese_kanji: kanji,
      english_romaji: englishRomaji,
    },
    source,
  };
}
