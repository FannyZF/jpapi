import { describe, it, expect } from "vitest";
import {
  isKanji,
  isHiragana,
  isPureEnglish,
  hasJapaneseChars,
  cleanZipcode,
  formatZipcode,
  sanitize,
} from "../../src/utils/textCleaner";

describe("textCleaner", () => {
  describe("isKanji", () => {
    it("returns true for Kanji string", () => {
      expect(isKanji("山田太郎")).toBe(true);
    });

    it("returns false for pure English", () => {
      expect(isKanji("John Smith")).toBe(false);
    });

    it("returns false for Hiragana only", () => {
      expect(isKanji("たなか")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isKanji("")).toBe(false);
    });
  });

  describe("isHiragana", () => {
    it("returns true for Hiragana", () => {
      expect(isHiragana("たなかはなこ")).toBe(true);
    });

    it("returns false for Kanji", () => {
      expect(isHiragana("山田")).toBe(false);
    });
  });

  describe("isPureEnglish", () => {
    it("returns true for English-only name", () => {
      expect(isPureEnglish("John Smith")).toBe(true);
    });

    it("returns false for Japanese name", () => {
      expect(isPureEnglish("山田太郎")).toBe(false);
    });

    it("returns false for mixed content", () => {
      expect(isPureEnglish("John 山田")).toBe(false);
    });
  });

  describe("hasJapaneseChars", () => {
    it("returns true for Kanji", () => {
      expect(hasJapaneseChars("山田太郎")).toBe(true);
    });

    it("returns true for Hiragana", () => {
      expect(hasJapaneseChars("たなか")).toBe(true);
    });

    it("returns false for pure English", () => {
      expect(hasJapaneseChars("John")).toBe(false);
    });
  });

  describe("cleanZipcode", () => {
    it("removes hyphens", () => {
      expect(cleanZipcode("150-0002")).toBe("1500002");
    });

    it("removes spaces", () => {
      expect(cleanZipcode("106 0032")).toBe("1060032");
    });

    it("returns unchanged for clean input", () => {
      expect(cleanZipcode("5300001")).toBe("5300001");
    });
  });

  describe("formatZipcode", () => {
    it("formats 7-digit zipcode", () => {
      expect(formatZipcode("1500002")).toBe("150-0002");
    });

    it("cleans and formats", () => {
      expect(formatZipcode("106 0032")).toBe("106-0032");
    });

    it("returns unchanged for short codes", () => {
      expect(formatZipcode("123")).toBe("123");
    });
  });

  describe("sanitize", () => {
    it("trims whitespace", () => {
      expect(sanitize("  hello  ")).toBe("hello");
    });

    it("collapses multiple spaces", () => {
      expect(sanitize("hello   world")).toBe("hello world");
    });
  });
});
