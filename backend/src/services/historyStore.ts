import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "../core/config";
import type { OperationType } from "../schemas/common";

let db: Database.Database | null = null;

export function initHistoryStore(): void {
  const dbPath = path.resolve(config.SQLITE_PATH);
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS cleanse_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      request_json TEXT NOT NULL,
      response_json TEXT NOT NULL,
      source TEXT NOT NULL,
      processing_time_ms INTEGER,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_history_order_id
    ON cleanse_history(order_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_history_created_at
    ON cleanse_history(created_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_history_operation_type
    ON cleanse_history(operation_type)
  `);
}

export function getHistoryDb(): Database.Database {
  if (!db) {
    throw new Error("History store not initialized. Call initHistoryStore() first.");
  }
  return db;
}

export interface HistoryRecord {
  id: string;
  order_id: string;
  operation_type: OperationType;
  request_json: string;
  response_json: string;
  source: string;
  processing_time_ms: number | null;
  created_at: string;
}

export interface HistoryQuery {
  operation_type?: OperationType;
  order_id?: string;
  start_date?: string;
  end_date?: string;
  page: number;
  limit: number;
}

export interface HistoryQueryResult {
  records: HistoryRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function insertHistory(record: HistoryRecord): void {
  const d = getHistoryDb();
  d.prepare(
    `INSERT INTO cleanse_history (id, order_id, operation_type, request_json, response_json, source, processing_time_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.order_id,
    record.operation_type,
    record.request_json,
    record.response_json,
    record.source,
    record.processing_time_ms,
    record.created_at
  );
}

export function queryHistory(params: HistoryQuery): HistoryQueryResult {
  const d = getHistoryDb();
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (params.operation_type) {
    conditions.push("operation_type = ?");
    values.push(params.operation_type);
  }
  if (params.order_id) {
    conditions.push("order_id = ?");
    values.push(params.order_id);
  }
  if (params.start_date) {
    conditions.push("created_at >= ?");
    values.push(params.start_date);
  }
  if (params.end_date) {
    conditions.push("created_at <= ?");
    values.push(params.end_date);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = d
    .prepare(`SELECT COUNT(*) as total FROM cleanse_history ${whereClause}`)
    .get(...values) as { total: number };
  const total = countRow.total;

  const offset = (params.page - 1) * params.limit;
  const records = d
    .prepare(
      `SELECT * FROM cleanse_history ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...values, params.limit, offset) as HistoryRecord[];

  return {
    records,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

export function getHistoryById(id: string): HistoryRecord | null {
  const d = getHistoryDb();
  const row = d
    .prepare("SELECT * FROM cleanse_history WHERE id = ?")
    .get(id) as HistoryRecord | undefined;
  return row ?? null;
}

export function getHistoryStats(): {
  total_requests: number;
  by_type: Record<string, number>;
  by_source: Record<string, number>;
} {
  const d = getHistoryDb();
  const totalRow = d
    .prepare("SELECT COUNT(*) as total FROM cleanse_history")
    .get() as { total: number };
  const totalRequests = totalRow.total;

  const typeRows = d
    .prepare(
      "SELECT operation_type, COUNT(*) as cnt FROM cleanse_history GROUP BY operation_type"
    )
    .all() as { operation_type: string; cnt: number }[];

  const byType: Record<string, number> = {};
  for (const row of typeRows) {
    byType[row.operation_type] = row.cnt;
  }

  const sourceRows = d
    .prepare(
      "SELECT source, COUNT(*) as cnt FROM cleanse_history GROUP BY source"
    )
    .all() as { source: string; cnt: number }[];

  const bySource: Record<string, number> = {};
  for (const row of sourceRows) {
    bySource[row.source] = row.cnt;
  }

  return { total_requests: totalRequests, by_type: byType, by_source: bySource };
}
