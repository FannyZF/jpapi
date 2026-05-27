import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import { globalErrorHandler } from "../../src/core/exceptions";
import { initHistoryStore } from "../../src/services/historyStore";
import { ensureUsersTable } from "../../src/services/userStore";

vi.mock("../../src/services/cache", () => ({
  getRedisClient: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(["0", []]),
    mget: vi.fn().mockResolvedValue([]),
    quit: vi.fn().mockResolvedValue("OK"),
  }),
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(true),
  cacheDelete: vi.fn().mockResolvedValue(true),
  cacheIncr: vi.fn().mockResolvedValue(1),
  cacheScan: vi.fn().mockResolvedValue([]),
  cacheMultiGet: vi.fn().mockResolvedValue(new Map()),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
  getCredential: vi.fn().mockImplementation((key: string) => {
    const defaults: Record<string, string> = {
      GOOGLE_MAPS_API_KEY: "test-google-key",
      YAHOO_CLIENT_ID: "test-yahoo-id",
      REDIS_URL: "redis://localhost:6379",
    };
    return Promise.resolve(defaults[key] || "");
  }),
  clearCredentialCache: vi.fn(),
}));

vi.mock("../../src/services/zipcloud", () => ({
  fetchZipCloud: vi.fn().mockResolvedValue({
    prefecture: "東京都",
    city: "港区",
    full_address: "六本木",
  }),
}));

vi.mock("../../src/services/googleMaps", () => ({
  fetchGoogleMaps: vi.fn().mockResolvedValue({
    address: {
      is_valid: true,
      validation_level: "PREMISE",
      japanese_address: "東京都港区六本木1丁目1",
      english_address: "1-chome-1 Roppongi, Minato City, Tokyo",
    },
    postalCode: "1060032",
  }),
}));

vi.mock("../../src/services/yahooFurigana", () => ({
  fetchYahooFurigana: vi.fn().mockResolvedValue({ katakana: "ヤマダタロウ", source: "live" }),
}));

let app: express.Express;

beforeAll(async () => {
  process.env.SQLITE_PATH = ":memory:";
  await initHistoryStore();
  ensureUsersTable();
  const { ensureHsCodeTable } = await import("../../src/services/hsCode.service");
  ensureHsCodeTable();

  app = express();
  app.use(cors());
  app.use(express.json());

  const { default: addressCleanseRouter } = await import("../../src/api/v1/address.cleanse");
  const { default: nameCleanseRouter } = await import("../../src/api/v1/name.cleanse");
  const { default: itemCleanseRouter } = await import("../../src/api/v1/item.cleanse");
  const { default: statisticsRouter } = await import("../../src/api/v1/statistics");
  const { default: cacheRouter } = await import("../../src/api/v1/cache");
  const { default: settingsRouter } = await import("../../src/api/v1/settings");
  const { default: adminRouter } = await import("../../src/api/v1/admin");

  app.use("/api/v1/cleanse", addressCleanseRouter);
  app.use("/api/v1/cleanse", nameCleanseRouter);
  app.use("/api/v1/cleanse", itemCleanseRouter);
  app.use("/api/v1", statisticsRouter);
  app.use("/api/v1", cacheRouter);
  app.use("/api/v1", settingsRouter);
  app.use("/api/v1", adminRouter);

  app.use(globalErrorHandler);
});

describe("API Integration Tests", () => {
  describe("POST /api/v1/cleanse/address", () => {
    it("returns 200 with cleansed address and reference_id", async () => {
      const res = await request(app)
        .post("/api/v1/cleanse/address")
        .send({
          order_id: "AWB001",
          raw_address: "tokyo minato-ku roppongi 1-1",
          provided_zipcode: "106-0032",
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.reference_id).toBe("AWB001");
      expect(res.body.data.address.is_valid).toBe(true);
      expect(res.body.data.zipcode).toBeDefined();
    });

    it("auto-generates reference_id when order_id missing", async () => {
      const res = await request(app)
        .post("/api/v1/cleanse/address")
        .send({
          raw_address: "tokyo",
          provided_zipcode: "106-0032",
        });

      expect(res.status).toBe(200);
      expect(res.body.reference_id).toMatch(/^ref_/);
    });

    it("returns validation error on invalid body", async () => {
      const res = await request(app)
        .post("/api/v1/cleanse/address")
        .send({ invalid: true });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
    });

    it("rejects empty zipcode", async () => {
      const res = await request(app)
        .post("/api/v1/cleanse/address")
        .send({
          order_id: "AWB001",
          raw_address: "tokyo",
          provided_zipcode: "",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/cleanse/name", () => {
    it("returns 200 with cleansed name", async () => {
      const res = await request(app)
        .post("/api/v1/cleanse/name")
        .send({ order_id: "AWB001", raw_name: "山田太郎" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.name.original).toBe("山田太郎");
      expect(res.body.data.name.japanese_katakana).toBe("ヤマダタロウ");
    });

    it("auto-generates reference_id when order_id missing", async () => {
      const res = await request(app)
        .post("/api/v1/cleanse/name")
        .send({ raw_name: "山田太郎" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.reference_id).toMatch(/^ref_/);
    });
  });

  describe("POST /api/v1/cleanse/item", () => {
    it("returns 200 with item data and compliance", async () => {
      const res = await request(app)
        .post("/api/v1/cleanse/item")
        .send({
          order_id: "AWB001",
          raw_description: "Computer Parts",
          hs_code: "8473.30",
          declared_value_jpy: 5000,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.item.raw_description).toBe("Computer Parts");
      expect(res.body.data.item.hs_code_valid).toBeDefined();
      expect(res.body.data.compliance).toBeDefined();
    });
  });

  describe("GET /api/v1/statistics", () => {
    it("returns statistics data", async () => {
      const res = await request(app).get("/api/v1/statistics");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.total_requests).toBeDefined();
    });
  });

  describe("GET /api/v1/cache", () => {
    it("returns cache entries", async () => {
      const res = await request(app).get("/api/v1/cache");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.entries).toBeDefined();
    });
  });

  describe("GET /api/v1/settings", () => {
    it("returns credential status", async () => {
      const res = await request(app).get("/api/v1/settings");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.credentials).toBeDefined();
      expect(res.body.credentials).toHaveLength(5);
      expect(res.body.credentials[0].key).toBe("GOOGLE_MAPS_API_KEY");
    });
  });

  describe("PUT /api/v1/settings", () => {
    it("updates credentials", async () => {
      const res = await request(app)
        .put("/api/v1/settings")
        .send({ credentials: { GOOGLE_MAPS_API_KEY: "new-key" } });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.updated_keys).toContain("GOOGLE_MAPS_API_KEY");
    });

    it("rejects empty body", async () => {
      const res = await request(app).put("/api/v1/settings").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/users", () => {
    let createdUserId = "";

    it("creates a user with API key", async () => {
      const res = await request(app)
        .post("/api/v1/users")
        .send({ name: "Test Client", permissions: ["address", "name"] });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.user.name).toBe("Test Client");
      expect(res.body.user.api_key).toMatch(/^ch_/);
      expect(res.body.user.permissions).toEqual(["address", "name"]);
      createdUserId = res.body.user.id;
    });

    it("creates user with no permissions", async () => {
      const res = await request(app)
        .post("/api/v1/users")
        .send({ name: "NoPerms User" });
      expect(res.status).toBe(201);
      expect(res.body.user.permissions).toEqual([]);
    });

    it("rejects user without name", async () => {
      const res = await request(app)
        .post("/api/v1/users")
        .send({ permissions: ["address"] });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/users", () => {
    it("lists users", async () => {
      const res = await request(app).get("/api/v1/users");
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.users[0].name).toBeTruthy();
      expect(res.body.users[0].permissions).toBeInstanceOf(Array);
    });
  });

  describe("GET /api/v1/permissions", () => {
    it("returns available permissions", async () => {
      const res = await request(app).get("/api/v1/permissions");
      expect(res.status).toBe(200);
      expect(res.body.permissions).toContain("address");
      expect(res.body.permissions).toContain("name");
      expect(res.body.permissions).toContain("item");
    });
  });

  describe("Auth middleware", () => {
    let authApp: express.Express;
    beforeAll(async () => {
      const { authMiddleware } = await import("../../src/core/auth");
      const { ensureUsersTable } = await import("../../src/services/userStore");
      ensureUsersTable();

      authApp = express();
      authApp.set("trust proxy", true);
      authApp.use(cors());
      authApp.use(express.json());
      authApp.use(authMiddleware);
      authApp.use("/api/v1/cleanse", (await import("../../src/api/v1/address.cleanse")).default);
      authApp.use("/api/v1/cleanse", (await import("../../src/api/v1/name.cleanse")).default);
      authApp.use(globalErrorHandler);
    });

    it("rejects localhost requests without API key when bypass disabled", async () => {
      // Note: With AUTH_BYPASS_LOCALHOST=true (dev mode), localhost bypasses auth.
      // In production (AUTH_BYPASS_LOCALHOST=false), this would be 401.
      const res = await request(authApp)
        .post("/api/v1/cleanse/address")
        .send({ order_id: "T", raw_address: "tokyo", provided_zipcode: "106-0032" });
      expect(res.status).toBe(process.env.AUTH_BYPASS_LOCALHOST === "false" ? 401 : 200);
    });

    it("rejects external requests without API key", async () => {
      const res = await request(authApp)
        .post("/api/v1/cleanse/address")
        .set("X-Forwarded-For", "203.0.113.1")
        .send({ order_id: "T", raw_address: "tokyo", provided_zipcode: "106-0032" });
      expect(res.status).toBe(401);
    });

    it("rejects external requests with invalid API key", async () => {
      const res = await request(authApp)
        .post("/api/v1/cleanse/address")
        .set("X-Forwarded-For", "203.0.113.1")
        .set("X-API-Key", "invalid-key")
        .send({ order_id: "T", raw_address: "tokyo", provided_zipcode: "106-0032" });
      expect(res.status).toBe(403);
    });
  });
});
