import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/cache", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(true),
  getCredential: vi.fn().mockImplementation((key: string) => {
    if (key === "GOOGLE_MAPS_API_KEY") return Promise.resolve("test-api-key");
    return Promise.resolve("");
  }),
}));

vi.mock("axios");

import axios from "axios";
import { fetchGoogleMaps } from "../../src/services/googleMaps";

const mockedAxios = vi.mocked(axios);

describe("googleMaps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const geocodeResponse = {
    data: {
      status: "OK",
      results: [
        {
          formatted_address: "1-chome-1 Roppongi, Minato City, Tokyo",
          address_components: [
            {
              long_name: "106-0032",
              short_name: "106-0032",
              types: ["postal_code"],
            },
            {
              long_name: "Tokyo",
              short_name: "Tokyo",
              types: ["locality"],
            },
          ],
        },
      ],
    },
  };

  const validationResponse = {
    data: {
      result: {
        verdict: {
          validationGranularity: "PREMISE",
          inputGranularity: "SUB_PREMISE",
        },
      },
    },
  };

  it("returns combined result on successful APIs", async () => {
    mockedAxios.get.mockResolvedValueOnce(geocodeResponse); // ja
    mockedAxios.get.mockResolvedValueOnce(geocodeResponse); // en
    mockedAxios.post.mockResolvedValueOnce(validationResponse);

    const result = await fetchGoogleMaps("roppongi 1-1 tokyo", "106-0032");
    expect(result).not.toBeNull();
    expect(result!.address.is_valid).toBe(true);
    expect(result!.address.validation_level).toBe("PREMISE");
    expect(result!.address.japanese_address).toBe("1-chome-1 Roppongi, Minato City, Tokyo");
    expect(result!.address.english_address).toBe("1-chome-1 Roppongi, Minato City, Tokyo");
  });

  it("returns null on geocoding failure", async () => {
    mockedAxios.get.mockRejectedValue(new Error("API error"));
    mockedAxios.post.mockRejectedValue(new Error("API error"));

    const result = await fetchGoogleMaps("invalid", "000-0000");
    expect(result).toBeNull();
  });

  it("flags address as invalid for low validation granularity", async () => {
    mockedAxios.get.mockResolvedValueOnce(geocodeResponse);
    mockedAxios.get.mockResolvedValueOnce(geocodeResponse);
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        result: {
          verdict: {
            validationGranularity: "UNKNOWN",
          },
        },
      },
    });

    const result = await fetchGoogleMaps("roppongi 1-1 tokyo", "000-0000");
    expect(result).not.toBeNull();
    expect(result!.address.is_valid).toBe(false);
  });
});
