import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  timeout: 30000,
});

const storedKey = localStorage.getItem("admin_api_key");
if (storedKey) {
  api.defaults.headers.common["X-API-Key"] = storedKey;
}

export interface HistoryRecord {
  id: string;
  order_id: string;
  operation_type: string;
  request_json: string;
  response_json: string;
  source: string;
  processing_time_ms: number | null;
  created_at: string;
}

export interface HistoryQueryResult {
  status: string;
  records: HistoryRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StatisticsData {
  total_requests: number;
  cache_hit_rate: number;
  by_type: Record<string, number>;
  by_source: Record<string, number>;
  session: {
    total: number;
    live: number;
    cache: number;
    fallback: number;
    partial: number;
  };
}

export interface CacheEntry {
  key: string;
  value: unknown;
}

export interface CacheListResult {
  status: string;
  total_keys: number;
  entries: CacheEntry[];
}

export function fetchHistory(params: Record<string, string | number>) {
  return api.get<HistoryQueryResult>("/history", { params });
}

export function fetchHistoryDetail(id: string) {
  return api.get<{ status: string; record: HistoryRecord }>(`/history/${id}`);
}

export function fetchStatistics() {
  return api.get<{ status: string; data: StatisticsData }>("/statistics");
}

export function fetchCache(pattern?: string) {
  return api.get<CacheListResult>("/cache", {
    params: { pattern: pattern || "*" },
  });
}

export function getCacheEntry(key: string) {
  return api.get<{ status: string; key: string; value: unknown }>(
    `/cache/${encodeURIComponent(key)}`
  );
}

export function updateCacheEntry(key: string, value: unknown) {
  return api.put(`/cache/${encodeURIComponent(key)}`, { value });
}

export function deleteCacheEntry(key: string) {
  return api.delete(`/cache/${encodeURIComponent(key)}`);
}

export function getExportUrl(params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params || {});
  return `/api/v1/export?${searchParams.toString()}`;
}

export interface BillingSummaryRow {
  user_id: string | null;
  user_name: string | null;
  period: string;
  total_calls: number;
  avg_processing_time_ms: number;
  by_operation: Record<string, number>;
}

export interface BillingSummaryResult {
  status: string;
  period: string;
  summary: BillingSummaryRow[];
}

export interface BillingLogRecord {
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
  created_at: string;
}

export interface BillingLogsResult {
  status: string;
  records: BillingLogRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function fetchBillingSummary(params: Record<string, string>) {
  return api.get<BillingSummaryResult>("/billing/summary", { params });
}

export function fetchBillingLogs(params: Record<string, string | number>) {
  return api.get<BillingLogsResult>("/billing/logs", { params });
}

export function getBillingExportUrl(params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params || {});
  return `/api/v1/billing/export?${searchParams.toString()}`;
}

export interface ComplianceWarning {
  level: "passed" | "warning" | "restricted" | "blocked";
  check: string;
  category?: string;
  source?: string;
  matched_keywords?: string[];
  message: string;
}

export interface ComplianceResult {
  passed: boolean;
  warnings: ComplianceWarning[];
}

export interface ComplianceCheckItem {
  raw_description: string;
  hs_code: string;
  declared_value_jpy: number;
  compliance: ComplianceResult;
}

export interface ComplianceCheckResponse {
  status: string;
  results: ComplianceCheckItem[];
}

export function fetchComplianceCheck(items: { raw_description: string; hs_code: string; declared_value_jpy: number }[]) {
  return api.post<ComplianceCheckResponse>("/compliance/check", { items });
}

export interface ClassifyCandidate {
  code: string;
  description: string;
  description_cn: string;
  confidence: number;
  matched_keywords: string[];
}

export interface StructuredAttributes {
  core_product_cn: string | null; core_product_en: string | null;
  material_cn: string | null;    material_en: string | null;
  function_cn: string | null;    function_en: string | null;
  composition_cn: string | null; composition_en: string | null;
  processing_cn: string | null;  processing_en: string | null;
  structure_cn: string | null;   structure_en: string | null;
  technical_cn: string | null;   technical_en: string | null;
}

export interface ClassifyResponse {
  status: string;
  structured_attributes: StructuredAttributes | null;
  suggested_name_cn: string;
  suggested_name_en: string;
  tokens_used: number;
  extracted_keywords: string[];
  candidates: ClassifyCandidate[];
  consensus?: {
    agreed: boolean;
    primary_model: string;
    both_available: boolean;
    deepseek_top_code: string | null;
    qwen_top_code: string | null;
  } | null;
  verification?: { matched: boolean; confidence: string; detail: string };
  best_guess?: { hs_code: string; description_en: string; description_cn: string; confidence: number; matched_keywords: string[] } | null;
  compliance?: { passed: boolean; warnings: ComplianceWarning[] };
}

export function fetchClassify(description: string, hsCode?: string) {
  return api.post<ClassifyResponse>("/classify", {
    raw_description: description,
    ...(hsCode ? { hs_code: hsCode } : {}),
  });
}

export function deleteUser(id: string) {
  return api.delete(`/users/${id}`);
}

// === Invoice ===

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
  breakdown: string;
  detail_call_ids: string;
}

export interface InvoiceBreakdownItem {
  endpoint: string;
  calls: number;
  unit_price: number;
  subtotal: number;
}

export interface CompanyInfo {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
}

export interface PricingInfo {
  address: number;
  name: number;
  item: number;
  classify: number;
  compliance: number;
}

export function fetchCompanyInfo() {
  return api.get<{ status: string; company: CompanyInfo }>("/settings/company");
}

export function updateCompanyInfo(company: Partial<CompanyInfo>) {
  return api.put("/settings/company", company);
}

export function fetchPricing() {
  return api.get<{ status: string; pricing: PricingInfo }>("/settings/pricing");
}

export function updatePricing(pricing: Partial<PricingInfo>) {
  return api.put("/settings/pricing", { pricing });
}

export function generateInvoice(userId: string, startDate: string, endDate: string) {
  return api.post<{ status: string; invoice: InvoiceRecord; duplicate?: boolean }>("/billing/generate", {
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
  });
}

export function fetchInvoices(userId?: string) {
  const params: Record<string, string> = {};
  if (userId) params.user_id = userId;
  return api.get<{ status: string; invoices: InvoiceRecord[]; unpaid_total: number }>("/billing/invoices", { params });
}

export function payInvoice(invoiceId: string) {
  return api.put<{ status: string; invoice: InvoiceRecord }>(`/billing/invoice/${invoiceId}/pay`);
}

export function getInvoicePdfUrl(invoiceId: string) {
  return `/api/v1/billing/invoice/${invoiceId}/pdf`;
}

export function getInvoiceCsvUrl(invoiceId: string) {
  return `/api/v1/billing/invoice/${invoiceId}/csv`;
}

export default api;
