import { describe, it, expect } from "vitest";
import { addressCleanseRequestSchema, addressCleanseResponseSchema } from "../../src/schemas/address";
import { nameCleanseRequestSchema, nameCleanseResponseSchema } from "../../src/schemas/name";
import { itemCleanseRequestSchema } from "../../src/schemas/item";

describe("Address Schema", () => {
  const validRequest = {
    order_id: "AWB001",
    raw_address: "tokyo minato-ku roppongi 1-1",
    provided_zipcode: "150-0002",
  };

  it("parses valid address request", () => {
    const result = addressCleanseRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("accepts missing order_id (optional)", () => {
    const result = addressCleanseRequestSchema.safeParse({
      raw_address: "tokyo",
      provided_zipcode: "150-0002",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty raw_address", () => {
    const result = addressCleanseRequestSchema.safeParse({
      raw_address: "",
      provided_zipcode: "150-0002",
    });
    expect(result.success).toBe(false);
  });

  it("parses valid response", () => {
    const result = addressCleanseResponseSchema.safeParse({
      status: "success",
      reference_id: "ref_20260518_a1b2c3d4",
      data: {
        address: {
          is_valid: true,
          validation_level: "PREMISE",
          japanese_address: "東京都港区六本木1丁目1",
          english_address: "1-chome-1 Roppongi, Minato City, Tokyo",
        },
        zipcode: {
          match: true,
          provided: "150-0002",
          suggested_correct: null,
        },
      },
      source: "live",
    });
    expect(result.success).toBe(true);
  });
});

describe("Name Schema", () => {
  it("parses valid name request", () => {
    const result = nameCleanseRequestSchema.safeParse({
      order_id: "AWB001",
      raw_name: "山田太郎",
    });
    expect(result.success).toBe(true);
  });

  it("parses valid name response", () => {
    const result = nameCleanseResponseSchema.safeParse({
      status: "success",
      reference_id: "ref_20260518_a1b2c3d4",
      data: {
        name: {
          original: "山田太郎",
          japanese_katakana: "ヤマダタロウ",
          english_romaji: "Yamada Taro",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty raw_name", () => {
    const result = nameCleanseRequestSchema.safeParse({
      order_id: "AWB001",
      raw_name: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("Item Schema", () => {
  it("parses valid item request", () => {
    const result = itemCleanseRequestSchema.safeParse({
      order_id: "AWB001",
      raw_description: "Computer Parts",
      hs_code: "8473.30",
      declared_value_jpy: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative value", () => {
    const result = itemCleanseRequestSchema.safeParse({
      order_id: "AWB001",
      raw_description: "Test",
      hs_code: "0000",
      declared_value_jpy: -1,
    });
    expect(result.success).toBe(false);
  });
});

