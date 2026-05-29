import { getHistoryDb } from "./historyStore";
import PDFDocument from "pdfkit";
import crypto from "crypto";

export interface ApiCallLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  method: string;
  api_path: string;
  operation_type: string | null;
  status_code: number;
  processing_time_ms: number;
  ip_address: string;
  order_id: string | null;
  request_body: string | null;
  response_body: string | null;
  deepseek_tokens: number;
  qwen_tokens: number;
  webhook_status: string | null;
  request_signature: string | null;
  request_hash: string | null;
  response_hash: string | null;
  created_at: string;
}

export interface BillingSummaryQuery {
  period: "daily" | "monthly";
  start_date?: string;
  end_date?: string;
  user_id?: string;
}

export interface BillingSummaryRow {
  user_id: string | null;
  user_name: string | null;
  period: string;
  total_calls: number;
  avg_processing_time_ms: number;
  by_operation: Record<string, number>;
}

export interface BillingLogsQuery {
  user_id?: string;
  start_date?: string;
  end_date?: string;
  operation_type?: string;
  page: number;
  limit: number;
}

export interface BillingLogsResult {
  records: ApiCallLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BillingExportQuery {
  user_id?: string;
  start_date?: string;
  end_date?: string;
  operation_type?: string;
}

export const BILLABLE_OPERATION_TYPES = ["address", "name", "item", "classify", "compliance"] as const;

function addBillableFilter(conditions: string[], values: string[]): void {
  conditions.push(
    `operation_type IN (${BILLABLE_OPERATION_TYPES.map(() => "?").join(",")})`
  );
  values.push(...(BILLABLE_OPERATION_TYPES as unknown as string[]));
}

export function ensureApiCallLogsTable(): void {
  const db = getHistoryDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_call_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      method TEXT NOT NULL,
      api_path TEXT NOT NULL,
      operation_type TEXT,
      status_code INTEGER NOT NULL,
      processing_time_ms INTEGER NOT NULL,
      ip_address TEXT,
      order_id TEXT,
      request_body TEXT,
      response_body TEXT,
      deepseek_tokens INTEGER DEFAULT 0,
      qwen_tokens INTEGER DEFAULT 0,
      webhook_status TEXT DEFAULT NULL,
      created_at TEXT NOT NULL
    )
  `);
  try { db.exec("ALTER TABLE api_call_logs ADD COLUMN order_id TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE api_call_logs ADD COLUMN request_body TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE api_call_logs ADD COLUMN response_body TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE api_call_logs ADD COLUMN deepseek_tokens INTEGER DEFAULT 0"); } catch (_e) {}
  try { db.exec("ALTER TABLE api_call_logs ADD COLUMN qwen_tokens INTEGER DEFAULT 0"); } catch (_e) {}
  try { db.exec("ALTER TABLE api_call_logs ADD COLUMN webhook_status TEXT DEFAULT NULL"); } catch (_e) {}
  try { db.exec("ALTER TABLE api_call_logs ADD COLUMN request_signature TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE api_call_logs ADD COLUMN request_hash TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE api_call_logs ADD COLUMN response_hash TEXT"); } catch (_e) {}
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_call_logs_user_id
    ON api_call_logs(user_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at
    ON api_call_logs(created_at)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_call_logs_operation_type
    ON api_call_logs(operation_type)
  `);
}

export function insertApiCallLog(log: ApiCallLog): void {
  const db = getHistoryDb();
  db.prepare(
    `INSERT INTO api_call_logs (id, user_id, user_name, method, api_path, operation_type, status_code, processing_time_ms, ip_address, order_id, request_body, response_body, request_signature, request_hash, response_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    log.id, log.user_id, log.user_name, log.method, log.api_path,
    log.operation_type, log.status_code, log.processing_time_ms,
    log.ip_address, log.order_id, log.request_body, log.response_body,
    log.request_signature, log.request_hash, log.response_hash,
    log.created_at
  );
}

function extractOperationType(apiPath: string): string | null {
  const base = apiPath.replace("/api/v1/", "").replace("/api/v1", "");
  if (base.startsWith("cleanse/address")) return "address";
  if (base.startsWith("cleanse/name")) return "name";
  if (base.startsWith("cleanse/item")) return "item";
  if (base.startsWith("history")) return "history";
  if (base.startsWith("cache")) return "cache";
  if (base.startsWith("export")) return "export";
  if (base.startsWith("statistics")) return "statistics";
  if (base.startsWith("settings")) return "settings";
  if (base.startsWith("users")) return "users";
  if (base.startsWith("health")) return "health";
  if (base.startsWith("billing")) return "billing";
  if (base.startsWith("classify")) return "classify";
  if (base.startsWith("compliance")) return "compliance";
  return null;
}

export { extractOperationType };

function buildWhereClause(
  params: {
    user_id?: string;
    start_date?: string;
    end_date?: string;
    operation_type?: string;
  }
): { whereClause: string; values: string[] } {
  const conditions: string[] = [];
  const values: string[] = [];

  if (params.user_id) {
    conditions.push("user_id = ?");
    values.push(params.user_id);
  }
  if (params.start_date) {
    conditions.push("created_at >= ?");
    values.push(params.start_date);
  }
  if (params.end_date) {
    conditions.push("created_at <= ?");
    values.push(params.end_date);
  }
  if (params.operation_type) {
    conditions.push("operation_type = ?");
    values.push(params.operation_type);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { whereClause, values };
}

function rowToLogRecord(row: Record<string, unknown>): ApiCallLog {
  return {
    id: row.id as string,
    user_id: (row.user_id as string) || null,
    user_name: (row.user_name as string) || null,
    method: row.method as string,
    api_path: row.api_path as string,
    operation_type: (row.operation_type as string) || null,
    status_code: row.status_code as number,
    processing_time_ms: row.processing_time_ms as number,
    ip_address: row.ip_address as string,
    order_id: (row.order_id as string) || null,
    request_body: (row.request_body as string) || null,
    response_body: (row.response_body as string) || null,
    deepseek_tokens: (row.deepseek_tokens as number) || 0,
    qwen_tokens: (row.qwen_tokens as number) || 0,
    webhook_status: (row.webhook_status as string) || null,
    request_signature: (row.request_signature as string) || null,
    request_hash: (row.request_hash as string) || null,
    response_hash: (row.response_hash as string) || null,
    created_at: row.created_at as string,
  };
}

export function updateApiCallTokens(
  id: string,
  deepseekTokens: number,
  qwenTokens: number
): void {
  const db = getHistoryDb();
  db.prepare(
    "UPDATE api_call_logs SET deepseek_tokens = ?, qwen_tokens = ? WHERE id = ?"
  ).run(deepseekTokens, qwenTokens, id);
}

export function getBillingSummary(
  params: BillingSummaryQuery
): BillingSummaryRow[] {
  const db = getHistoryDb();
  const conditions: string[] = [];
  const values: string[] = [];

  addBillableFilter(conditions, values);

  if (params.user_id) {
    conditions.push("user_id = ?");
    values.push(params.user_id);
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

  const periodExpr =
    params.period === "daily"
      ? "date(created_at)"
      : "strftime('%Y-%m', created_at)";

  const rows = db
    .prepare(
      `SELECT
        user_id,
        MAX(user_name) as user_name,
        ${periodExpr} as period,
        COUNT(*) as total_calls,
        AVG(processing_time_ms) as avg_processing_time_ms,
        operation_type
      FROM api_call_logs
      ${whereClause}
      GROUP BY user_id, ${periodExpr}, operation_type
      ORDER BY period DESC, user_name ASC, operation_type ASC`
    )
    .all(...values) as Record<string, unknown>[];

  const rowMap = new Map<string, BillingSummaryRow>();
  for (const row of rows) {
    const uid = (row.user_id as string) || "__anon__";
    const periodVal = row.period as string;
    const key = `${uid}::${periodVal}`;

    if (!rowMap.has(key)) {
      rowMap.set(key, {
        user_id: (row.user_id as string) || null,
        user_name: (row.user_name as string) || null,
        period: periodVal,
        total_calls: 0,
        avg_processing_time_ms: 0,
        by_operation: {},
      });
    }

    const summary = rowMap.get(key)!;
    const opType = (row.operation_type as string) || "other";
    const calls = row.total_calls as number;
    const avgTime = row.avg_processing_time_ms as number;

    summary.total_calls += calls;
    summary.by_operation[opType] =
      (summary.by_operation[opType] || 0) + calls;

    const prevTotal = summary.total_calls - calls;
    if (prevTotal === 0) {
      summary.avg_processing_time_ms = avgTime;
    } else {
      summary.avg_processing_time_ms =
        (summary.avg_processing_time_ms * prevTotal + avgTime * calls) /
        summary.total_calls;
    }
  }

  return Array.from(rowMap.values()).sort((a, b) => {
    if (a.period !== b.period) return b.period.localeCompare(a.period);
    return (a.user_name || "").localeCompare(b.user_name || "");
  });
}

export function queryBillingLogs(
  params: BillingLogsQuery
): BillingLogsResult {
  const db = getHistoryDb();
  const { whereClause, values } = buildWhereClause({
    user_id: params.user_id,
    start_date: params.start_date,
    end_date: params.end_date,
    operation_type: params.operation_type,
  });

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM api_call_logs ${whereClause}`)
    .get(...values) as { total: number };
  const total = countRow.total;

  const offset = (params.page - 1) * params.limit;
  const queryValues = [...values, params.limit, offset];

  const rows = db
    .prepare(
      `SELECT * FROM api_call_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...queryValues) as Record<string, unknown>[];

  return {
    records: rows.map(rowToLogRecord),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

export function queryAllLogsForExport(
  params: BillingExportQuery
): ApiCallLog[] {
  const db = getHistoryDb();
  const { whereClause, values } = buildWhereClause(params);

  const billablePlaceholders = BILLABLE_OPERATION_TYPES.map(() => "?").join(
    ","
  );
  const billableFilter = `operation_type IN (${billablePlaceholders})`;
  const baseWhere = whereClause
    ? `${whereClause} AND ${billableFilter}`
    : `WHERE ${billableFilter}`;
  const billableValues = [
    ...values,
    ...(BILLABLE_OPERATION_TYPES as unknown as string[]),
  ];

  const rows = db
    .prepare(`SELECT * FROM api_call_logs ${baseWhere} ORDER BY created_at ASC`)
    .all(...billableValues) as Record<string, unknown>[];

  return rows.map(rowToLogRecord);
}

export function getExportSummary(
  params: BillingExportQuery
): Record<string, number> {
  const db = getHistoryDb();
  const { whereClause, values } = buildWhereClause(params);

  const billablePlaceholders = BILLABLE_OPERATION_TYPES.map(() => "?").join(
    ","
  );
  const billableFilter = `operation_type IN (${billablePlaceholders})`;
  const baseWhere = whereClause
    ? `${whereClause} AND ${billableFilter}`
    : `WHERE ${billableFilter}`;
  const billableValues = [
    ...values,
    ...(BILLABLE_OPERATION_TYPES as unknown as string[]),
  ];

  const rows = db
    .prepare(
      `SELECT operation_type, COUNT(*) as cnt FROM api_call_logs ${baseWhere} GROUP BY operation_type`
    )
    .all(...billableValues) as { operation_type: string; cnt: number }[];

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.operation_type || "other"] = row.cnt;
  }
  return result;
}

// === INVOICES ===

export interface InvoiceRecord {
  id: string;
  bill_number: string;
  user_id: string;
  user_name: string;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  period_start: string;
  period_end: string;
  generated_at: string;
  total_amount: number;
  paid: number;
  country: string;
  breakdown: string;
  detail_call_ids: string;
}

export interface InvoiceBreakdownItem {
  endpoint: string;
  calls: number;
  unit_price: number;
  subtotal: number;
}

export interface InvoiceBreakdown {
  [endpoint: string]: InvoiceBreakdownItem;
}

export const DEFAULT_PRICING: Record<string, number> = {
  address: 0.10,
  name: 0.10,
  item: 0.20,
  classify: 0.30,
  compliance: 0.20,
  us_classify: 0.30,
  us_address: 0.15,
  us_compliance: 0.25,
};

export const DEFAULT_COMPANY = {
  company_name: "",
  address: "",
  phone: "",
  email: "",
  tax_id: "",
};

export function ensureInvoicesTable(): void {
  const db = getHistoryDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      bill_number TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      company_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid INTEGER DEFAULT 0,
      country TEXT DEFAULT 'JP',
      breakdown TEXT NOT NULL,
      detail_call_ids TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_invoices_generated_at ON invoices(generated_at)
  `);
  try { db.exec("ALTER TABLE invoices ADD COLUMN paid INTEGER DEFAULT 0"); } catch (_e) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN country TEXT DEFAULT 'JP'"); } catch (_e) {}
}

function generateBillNumber(userName: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeName = (userName || "unknown").replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "").substring(0, 20);
  const randomHex = Math.random().toString(16).substring(2, 10);
  return `INV-${dateStr}-${safeName}-${randomHex}`;
}

export function generateInvoice(params: {
  user_id: string;
  user_name: string;
  company_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  start_date: string;
  end_date: string;
  country: string;
  pricing: Record<string, number>;
}): InvoiceRecord {
  const db = getHistoryDb();

  const conditions: string[] = ["user_id = ?"];
  const values: string[] = [params.user_id];
  conditions.push("created_at >= ?");
  values.push(params.start_date);
  conditions.push("created_at <= ?");
  values.push(params.end_date);
  const billablePlaceholders = BILLABLE_OPERATION_TYPES.map(() => "?").join(",");
  conditions.push(`operation_type IN (${billablePlaceholders})`);
  values.push(...(BILLABLE_OPERATION_TYPES as unknown as string[]));

  const baseWhere = `WHERE ${conditions.join(" AND ")}`;

  // Billing: count only successful calls
  const opCounts = db.prepare(
    `SELECT operation_type, COUNT(*) as cnt FROM api_call_logs ${baseWhere} AND status_code >= 200 AND status_code < 300 GROUP BY operation_type`
  ).all(...values) as { operation_type: string; cnt: number }[];

  // Detail: include ALL calls (success + failure) for CSV traceability
  const logIds = db.prepare(
    `SELECT id FROM api_call_logs ${baseWhere} ORDER BY created_at ASC`
  ).all(...values) as { id: string }[];

  const breakdown: InvoiceBreakdown = {};
  let totalAmount = 0;

  for (const op of opCounts) {
    const endpoint = op.operation_type;
    const calls = op.cnt;
    const unitPrice = params.pricing[endpoint] || 0;
    const subtotal = Math.round(calls * unitPrice * 100) / 100;
    totalAmount += subtotal;
    breakdown[endpoint] = { endpoint, calls, unit_price: unitPrice, subtotal };
  }

  totalAmount = Math.round(totalAmount * 100) / 100;

  const billNumber = generateBillNumber(params.user_name);
  const invoiceId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO invoices (id, bill_number, user_id, user_name, company_name, contact_email, contact_phone, period_start, period_end, generated_at, total_amount, paid, country, breakdown, detail_call_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceId, billNumber, params.user_id, params.user_name,
    params.company_name || null, params.contact_email || null,
    params.contact_phone || null, params.start_date, params.end_date,
    generatedAt, totalAmount, 0, params.country,
    JSON.stringify(breakdown), JSON.stringify(logIds.map((r) => r.id))
  );

  return getInvoice(invoiceId)!;
}

function rowToInvoice(row: Record<string, unknown>): InvoiceRecord {
  return {
    id: row.id as string,
    bill_number: row.bill_number as string,
    user_id: row.user_id as string,
    user_name: row.user_name as string,
    company_name: (row.company_name as string) || null,
    contact_email: (row.contact_email as string) || null,
    contact_phone: (row.contact_phone as string) || null,
    period_start: row.period_start as string,
    period_end: row.period_end as string,
    generated_at: row.generated_at as string,
    total_amount: row.total_amount as number,
    paid: (row.paid as number) || 0,
    country: (row.country as string) || "JP",
    breakdown: row.breakdown as string,
    detail_call_ids: row.detail_call_ids as string,
  };
}

export function getInvoice(id: string): InvoiceRecord | null {
  const db = getHistoryDb();
  const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToInvoice(row) : null;
}

export function listInvoices(userId?: string): InvoiceRecord[] {
  const db = getHistoryDb();
  let rows: Record<string, unknown>[];
  if (userId) {
    rows = db.prepare("SELECT * FROM invoices WHERE user_id = ? ORDER BY generated_at DESC").all(userId) as Record<string, unknown>[];
  } else {
    rows = db.prepare("SELECT * FROM invoices ORDER BY generated_at DESC").all() as Record<string, unknown>[];
  }
  return rows.map(rowToInvoice);
}

export function payInvoice(id: string): InvoiceRecord | null {
  const db = getHistoryDb();
  const invoice = getInvoice(id);
  if (!invoice) return null;
  db.prepare("UPDATE invoices SET paid = 1 WHERE id = ?").run(id);
  return getInvoice(id);
}

export function findExistingInvoice(userId: string, startDate: string, endDate: string): InvoiceRecord | null {
  const db = getHistoryDb();
  const row = db.prepare(
    "SELECT * FROM invoices WHERE user_id = ? AND period_start = ? AND period_end = ? ORDER BY generated_at DESC LIMIT 1"
  ).get(userId, startDate, endDate) as Record<string, unknown> | undefined;
  return row ? rowToInvoice(row) : null;
}

export function deleteInvoice(id: string): boolean {
  const invoice = getInvoice(id);
  if (!invoice || invoice.paid === 1) return false;
  const db = getHistoryDb();
  db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
  return true;
}

export function getUnpaidTotal(userId?: string): number {
  const db = getHistoryDb();
  let row: { total: number } | undefined;
  if (userId) {
    row = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE paid = 0 AND user_id = ?").get(userId) as { total: number } | undefined;
  } else {
    row = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE paid = 0").get() as { total: number } | undefined;
  }
  return row ? row.total : 0;
}

export function getInvoiceDetailLogs(invoiceId: string): ApiCallLog[] {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return [];
  const ids: string[] = JSON.parse(invoice.detail_call_ids);
  if (!ids.length) return [];
  const db = getHistoryDb();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT * FROM api_call_logs WHERE id IN (${placeholders}) ORDER BY created_at ASC`
  ).all(...ids) as Record<string, unknown>[];
  return rows.map(rowToLogRecord);
}

export interface CompanyInfo {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
}

export function generateInvoicePdf(
  invoice: InvoiceRecord,
  company: CompanyInfo,
  pricing: Record<string, number>
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  // Register CJK font (SimHei) for Chinese text rendering
  const fontPath = "C:/Windows/Fonts/simhei.ttf";
  try {
    doc.registerFont("CJK", fontPath);
  } catch {
    // fallback: try SimSun
    try { doc.registerFont("CJK", "C:/Windows/Fonts/simsun.ttc"); } catch { /* no CJK font, will use Helvetica */ }
  }

  const font = "CJK";
  const fontBold = "CJK";
  const fallbackFont = "Helvetica";
  const useCjk = (text: string) => /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(text) ? font : fallbackFont;

  const breakdown = JSON.parse(invoice.breakdown) as InvoiceBreakdown;

  // Header - Company info
  doc.fontSize(20).font(fontBold).text(company.company_name || "API Hub Service Provider", { align: "left" });
  doc.fontSize(9).font(font);
  if (company.address) doc.text(company.address);
  if (company.phone) doc.text(`电话: ${company.phone}`);
  if (company.email) doc.text(`邮箱: ${company.email}`);
  if (company.tax_id) doc.text(`税号: ${company.tax_id}`);
  doc.moveDown(0.5);

  // Invoice info
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(14).font(fontBold).text(`账单 ${invoice.bill_number}`, { align: "right" });
  doc.fontSize(9).font(font);
  doc.text(`生成日期: ${new Date(invoice.generated_at).toLocaleDateString("zh-CN")}`, { align: "right" });
  doc.text(`账期: ${invoice.period_start} ~ ${invoice.period_end}`, { align: "right" });
  doc.moveDown();

  // Client info
  doc.fontSize(11).font(fontBold).text("客户信息");
  doc.fontSize(9).font(font);
  doc.text(`客户名称: ${invoice.company_name || invoice.user_name}`);
  if (invoice.contact_email) doc.text(`联系邮箱: ${invoice.contact_email}`);
  if (invoice.contact_phone) doc.text(`联系电话: ${invoice.contact_phone}`);
  doc.moveDown();

  // Table header
  const tableTop = doc.y + 5;
  const colX = [50, 250, 330, 400, 480];
  doc.fontSize(10).font(fontBold);
  doc.text("接口", colX[0], tableTop);
  doc.text("成功调用次数", colX[1], tableTop);
  doc.text("单价 (¥)", colX[2], tableTop);
  doc.text("费用 (¥)", colX[4], tableTop);
  doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
  doc.moveDown(0.3);

  // Table rows
  let rowY = doc.y;
  doc.fontSize(9).font(font);
  const endpointNames: Record<string, string> = {
    address: "JP-地址清洗",
    name: "JP-姓名清洗",
    item: "JP-商品清洗",
    classify: "JP-HS分类",
    compliance: "JP-合规检查",
    us_classify: "US-HS分类",
    us_address: "US-地址清洗",
    us_compliance: "US-合规检查",
  };

  for (const [key, item] of Object.entries(breakdown)) {
    if (item.calls === 0) continue;
    doc.text(endpointNames[key] || key, colX[0], rowY);
    doc.text(String(item.calls), colX[1], rowY);
    doc.text(item.unit_price.toFixed(2), colX[2], rowY);
    doc.text(item.subtotal.toFixed(2), colX[4], rowY);
    rowY += 18;
  }

  // Total line
  doc.moveTo(50, rowY).lineTo(545, rowY).stroke();
  rowY += 8;
  doc.fontSize(11).font(fontBold);
  doc.text("合计", colX[0], rowY);
  doc.text(`¥${invoice.total_amount.toFixed(2)}`, colX[4], rowY);
  rowY += 30;

  // Footer
  doc.fontSize(8).font(font).fillColor("#888");
  doc.text(`账单编号: ${invoice.bill_number}`, 50, rowY);
  doc.text("此账单由 API Hub 系统自动生成", 50, rowY + 12);

  return doc;
}
