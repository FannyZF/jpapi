import { describe, it, expect } from "vitest";
import { toKatakanaWrapper } from "../../src/services/localNlp";
import { convertNameToRomaji } from "../../src/services/localNlp";

describe("localNlp", () => {
  describe("toKatakanaWrapper", () => {
    it("converts English to Katakana", () => {
      const result = toKatakanaWrapper("Smith");
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it("converts romaji to Katakana", () => {
      const result = toKatakanaWrapper("tesuto");
      expect(result).toBe("テスト");
    });
  });

  describe("convertNameToRomaji", () => {
    it("converts Katakana to Romaji with capitalization", async () => {
      const result = await convertNameToRomaji("ヤマダ タロウ");
      expect(result).toBe("Yamada Tarou");
    });

    it("handles single word", async () => {
      const result = await convertNameToRomaji("タロウ");
      expect(result).toBe("Tarou");
    });
  });
});
