import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("config schema", () => {
  it("validates minimum required env vars", () => {
    const envSchema = z.object({
      GOOGLE_MAPS_API_KEY: z.string().min(1),
      YAHOO_CLIENT_ID: z.string().min(1),
      REDIS_URL: z.string().url(),
      SQLITE_PATH: z.string().default("./data/cleanse_history.db"),
      PORT: z.coerce.number().int().positive().default(3000),
      KUROMOJI_DICT_PATH: z.string().default("node_modules/kuromoji/dict"),
    });

    const result = envSchema.safeParse({
      GOOGLE_MAPS_API_KEY: "test-key",
      YAHOO_CLIENT_ID: "test-client",
      REDIS_URL: "redis://localhost:6379",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
      expect(result.data.SQLITE_PATH).toBe("./data/cleanse_history.db");
    }
  });

  it("fails when required vars are missing", () => {
    const envSchema = z.object({
      GOOGLE_MAPS_API_KEY: z.string().min(1),
      YAHOO_CLIENT_ID: z.string().min(1),
      REDIS_URL: z.string().url(),
    });

    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("fails on invalid REDIS_URL", () => {
    const envSchema = z.object({
      GOOGLE_MAPS_API_KEY: z.string().min(1),
      YAHOO_CLIENT_ID: z.string().min(1),
      REDIS_URL: z.string().url(),
    });

    const result = envSchema.safeParse({
      GOOGLE_MAPS_API_KEY: "k",
      YAHOO_CLIENT_ID: "c",
      REDIS_URL: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
