import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { initHistoryStore, insertHistory, queryHistory, getHistoryById, getHistoryStats, getHistoryDb } from "../../src/services/historyStore";

beforeAll(() => {
  process.env.SQLITE_PATH = ":memory:";
  initHistoryStore();
});

beforeEach(() => {
  const db = getHistoryDb();
  db.prepare("DELETE FROM cleanse_history").run();
});

describe("historyStore", () => {
  function makeRecord(id: string, orderId: string, type: "address" | "name" | "item" | "recipient" = "address") {
    return {
      id,
      order_id: orderId,
      operation_type: type,
      request_json: '{"raw_address":"tokyo"}',
      response_json: '{"status":"success"}',
      source: "live",
      processing_time_ms: 150,
      created_at: new Date().toISOString(),
    };
  }

  it("inserts and retrieves a record", () => {
    insertHistory(makeRecord("id-1", "ORDER001"));
    const result = getHistoryById("id-1");
    expect(result).not.toBeNull();
    expect(result!.order_id).toBe("ORDER001");
  });

  it("returns null for nonexistent id", () => {
    const result = getHistoryById("nonexistent");
    expect(result).toBeNull();
  });

  it("queries history with pagination", () => {
    insertHistory(makeRecord("id-1", "ORDER001"));
    const result = queryHistory({ page: 1, limit: 10 });
    expect(result.records.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.page).toBe(1);
  });

  it("filters by operation_type", () => {
    insertHistory(makeRecord("id-1", "ORDER001", "address"));
    const result = queryHistory({ page: 1, limit: 10, operation_type: "address" });
    expect(result.records.every((r) => r.operation_type === "address")).toBe(true);
  });

  it("filters by order_id", () => {
    insertHistory(makeRecord("id-1", "ORDER001"));
    const result = queryHistory({ page: 1, limit: 10, order_id: "ORDER001" });
    expect(result.records.every((r) => r.order_id === "ORDER001")).toBe(true);
  });

  it("returns empty for non-matching filter", () => {
    insertHistory(makeRecord("id-1", "ORDER001", "address"));
    const result = queryHistory({ page: 1, limit: 10, operation_type: "recipient" });
    expect(result.records.length).toBe(0);
  });

  it("gets statistics", () => {
    insertHistory(makeRecord("id-1", "ORDER001"));
    const stats = getHistoryStats();
    expect(stats.total_requests).toBeGreaterThanOrEqual(1);
    expect(stats.by_type).toHaveProperty("address");
  });

  it("handles pagination boundary", () => {
    insertHistory(makeRecord("id-1", "ORDER001"));
    insertHistory(makeRecord("id-2", "ORDER002"));

    const page1 = queryHistory({ page: 1, limit: 1 });
    expect(page1.records.length).toBe(1);
    expect(page1.totalPages).toBeGreaterThanOrEqual(2);

    const page2 = queryHistory({ page: 2, limit: 1 });
    expect(page2.records.length).toBe(1);
  });
});
