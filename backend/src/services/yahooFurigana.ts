import axios from "axios";
import { cacheGet, cacheSet, getCredential } from "./cache";
import { nameCacheKey } from "../utils/hash";

const YAHOO_FURIGANA_BASE =
  "https://jlp.yahooapis.jp/FuriganaService/V2/furigana";

export async function fetchYahooFurigana(
  rawName: string
): Promise<{ katakana: string; source: "cache" | "live" } | null> {
  const cacheKey = nameCacheKey(rawName);
  const cached = await cacheGet<string>(cacheKey);
  if (cached) return { katakana: cached, source: "cache" };

  const clientId = await getCredential("YAHOO_CLIENT_ID");
  if (!clientId) return null;

  try {
    const response = await axios.get(YAHOO_FURIGANA_BASE, {
      params: {
        appid: clientId,
        sentence: rawName,
        grade: 1,
        output: "json",
      },
      timeout: 15000,
    });

    const data = response.data;
    if (!data || !data.ResultSet || !data.ResultSet.Result) {
      return null;
    }

    const wordList = data.ResultSet.Result.WordList;
    if (!wordList || !wordList.Word) {
      return null;
    }

    const words = Array.isArray(wordList.Word)
      ? wordList.Word
      : [wordList.Word];

    const katakana = words
      .map((w: { Furigana?: string; Surface?: string }) => w.Furigana || w.Surface || "")
      .join("");

    if (!katakana) return null;

    await cacheSet(cacheKey, katakana);
    return { katakana, source: "live" };
  } catch {
    return null;
  }
}
