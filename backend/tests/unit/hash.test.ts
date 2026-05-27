import { describe, it, expect } from "vitest";
import {
  hashKey,
  addressCacheKey,
  nameCacheKey,
  zipCacheKey,
  itemCacheKey,
} from "../../src/utils/hash";

describe("hash", () => {
  describe("hashKey", () => {
    it("produces consistent output for same input", () => {
      const a = hashKey("hello");
      const b = hashKey("hello");
      expect(a).toBe(b);
    });

    it("produces different output for different input", () => {
      const a = hashKey("hello");
      const b = hashKey("world");
      expect(a).not.toBe(b);
    });

    it("returns 16 character hex string", () => {
      const result = hashKey("test");
      expect(result).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(result)).toBe(true);
    });
  });

  describe("addressCacheKey", () => {
    it("generates deterministic key", () => {
      const k1 = addressCacheKey("tokyo", "150-0002");
      const k2 = addressCacheKey("tokyo", "150-0002");
      expect(k1).toBe(k2);
      expect(k1).toMatch(/^addr:v1:/);
    });

    it("normalizes input", () => {
      const k1 = addressCacheKey("  Tokyo  ", "150-0002");
      const k2 = addressCacheKey("tokyo", "150-0002");
      expect(k1).toBe(k2);
    });
  });

  describe("nameCacheKey", () => {
    it("generates key with name prefix", () => {
      expect(nameCacheKey("山田太郎")).toMatch(/^name:v1:/);
    });
  });

  describe("zipCacheKey", () => {
    it("generates key and cleans zipcode", () => {
      const key = zipCacheKey("150-0002");
      expect(key).toMatch(/^zip:v1:/);
      expect(key).toContain("1500002");
    });
  });

  describe("itemCacheKey", () => {
    it("generates key with item prefix", () => {
      expect(itemCacheKey("laptop", "8471.30")).toMatch(/^item:v1:/);
    });
  });
});
