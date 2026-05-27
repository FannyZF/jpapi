import kuromoji, { Tokenizer, IpadicFeatures } from "kuromoji";
import { toKatakana, toRomaji } from "wanakana";
import path from "path";
import { config } from "../core/config";
import { isPureEnglish } from "../utils/textCleaner";

let tokenizer: Tokenizer<IpadicFeatures> | null = null;

function getDictPath(): string {
  const dictPath = config.KUROMOJI_DICT_PATH;
  if (path.isAbsolute(dictPath)) return dictPath;
  return path.resolve(dictPath);
}

export async function initKuromoji(): Promise<Tokenizer<IpadicFeatures>> {
  if (tokenizer) return tokenizer;

  const dictPath = getDictPath();

  return new Promise((resolve, reject) => {
    const builder = kuromoji.builder({ dicPath: dictPath });
    builder.build((err, tok) => {
      if (err) {
        reject(err);
        return;
      }
      tokenizer = tok;
      resolve(tok);
    });
  });
}

export async function convertToKatakanaLocal(rawName: string): Promise<string> {
  try {
    const tok = await initKuromoji();
    const tokens = tok.tokenize(rawName);
    const readings = tokens
      .map((t) => t.reading || t.surface_form)
      .filter((r) => r !== "*");
    return readings.length > 0 ? readings.join(" ") : toKatakana(rawName);
  } catch {
    return toKatakana(rawName);
  }
}

export async function convertNameToRomaji(katakana: string): Promise<string> {
  if (isPureEnglish(katakana)) {
    return katakana;
  }

  const result = toRomaji(katakana);
  if (!result) return katakana;
  return result
    .split(" ")
    .filter((w) => w.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function toKatakanaWrapper(input: string): string {
  return toKatakana(input);
}
