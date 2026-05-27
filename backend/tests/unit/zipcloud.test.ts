import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/cache", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(true),
  cacheIncr: vi.fn().mockResolvedValue(1),
}));

vi.mock("axios");

import axios from "axios";
import { fetchZipCloud } from "../../src/services/zipcloud";

const mockedAxios = vi.mocked(axios);

describe("zipcloud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data on successful API response", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        results: [
          {
            address1: "東京都",
            address2: "港区",
            address3: "六本木",
          },
        ],
      },
    });

    const result = await fetchZipCloud("106-0032");
    expect(result).not.toBeNull();
    expect(result!.prefecture).toBe("東京都");
    expect(result!.city).toBe("港区");
  });

  it("returns null on API error", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchZipCloud("000-0000");
    expect(result).toBeNull();
  });

  it("returns null when no results", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { results: [] },
    });

    const result = await fetchZipCloud("000-0000");
    expect(result).toBeNull();
  });

  it("returns null on timeout", async () => {
    mockedAxios.get.mockRejectedValueOnce({ code: "ECONNABORTED" });

    const result = await fetchZipCloud("106-0032");
    expect(result).toBeNull();
  });
});
