import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/cache", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(true),
  getCredential: vi.fn().mockImplementation((key: string) => {
    if (key === "YAHOO_CLIENT_ID") return Promise.resolve("test-client-id");
    return Promise.resolve("");
  }),
}));

vi.mock("axios");

import axios from "axios";
import { fetchYahooFurigana } from "../../src/services/yahooFurigana";

const mockedAxios = vi.mocked(axios);

describe("yahooFurigana", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts katakana from API response", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        ResultSet: {
          Result: {
            WordList: {
              Word: [
                { Furigana: "ヤマダ", Surface: "山田" },
                { Furigana: "タロウ", Surface: "太郎" },
              ],
            },
          },
        },
      },
    });

    const result = await fetchYahooFurigana("山田太郎");
    expect(result).toEqual({ katakana: "ヤマダタロウ", source: "live" });
  });

  it("returns null on API error", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchYahooFurigana("山田太郎");
    expect(result).toBeNull();
  });

  it("returns null on empty response", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { ResultSet: {} } });

    const result = await fetchYahooFurigana("山田太郎");
    expect(result).toBeNull();
  });
});
