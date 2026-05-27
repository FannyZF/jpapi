import { fetchYahooFurigana } from "./yahooFurigana";
import {
  convertToKatakanaLocal,
  convertNameToRomaji,
  toKatakanaWrapper,
} from "./localNlp";
import { isPureEnglish } from "../utils/textCleaner";
import type { NameCleanseResponse } from "../schemas/name";

type Source = "live" | "cache" | "fallback";
type NameServiceResult = NameCleanseResponse["data"] & { source: Source };

export async function cleanseName(
  orderId: string,
  rawName: string
): Promise<NameServiceResult> {
  let katakana: string;
  let source: Source = "live";

  if (isPureEnglish(rawName)) {
    katakana = toKatakanaWrapper(rawName);
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
      english_romaji: englishRomaji,
    },
    source,
  };
}
