import { Router, Request, Response } from "express";
import { ZodError } from "zod";
import {
  getBillingSummary,
  queryBillingLogs,
  queryAllLogsForExport,
  getExportSummary,
  generateInvoice,
  getInvoice,
  listInvoices,
  payInvoice,
  getUnpaidTotal,
  getInvoiceDetailLogs,
  generateInvoicePdf,
  findExistingInvoice,
  deleteInvoice,
  DEFAULT_PRICING,
  DEFAULT_COMPANY,
} from "../../services/billingStore";
import { cacheGet } from "../../services/cache";
import { getUserById } from "../../services/userStore";
import { paginationSchema } from "../../schemas/common";
import { z } from "zod";

const COMPANY_KEY = "settings:company";
const PRICING_KEY = "settings:pricing";

const router = Router();

const billingSummarySchema = z.object({
  period: z.enum(["daily", "monthly"]).default("monthly"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  user_id: z.string().optional(),
});

const billingLogsSchema = z.object({
  user_id: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  operation_type: z.string().optional(),
});

router.get("/billing/summary", (req: Request, res: Response) => {
  try {
    const params = billingSummarySchema.parse(req.query);
    const summary = getBillingSummary(params);

    res.json({
      status: "success",
      period: params.period,
      summary,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
      return;
    }
    res.status(500).json({
      status: "error",
      message: "Failed to get billing summary",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/billing/logs", (req: Request, res: Response) => {
  try {
    const filters = billingLogsSchema.parse(req.query);
    const pagination = paginationSchema.parse(req.query);

    const result = queryBillingLogs({
      ...filters,
      page: pagination.page,
      limit: pagination.limit,
    });

    res.json({
      status: "success",
      ...result,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
      return;
    }
    res.status(500).json({
      status: "error",
      message: "Failed to query billing logs",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/billing/export", (req: Request, res: Response) => {
  try {
    const filters = billingLogsSchema.parse(req.query);

    const summary = getExportSummary(filters);
    const totalCalls = Object.values(summary).reduce((a, b) => a + b, 0);
    const logRecords = queryAllLogsForExport(filters);

    const startDate = filters.start_date || "beginning";
    const endDate = filters.end_date || new Date().toISOString().slice(0, 10);

    const summaryLine = Object.entries(summary)
      .sort(([, a], [, b]) => b - a)
      .map(([op, cnt]) => `${op}:${cnt}`)
      .join(" | ");

    const rows: string[] = [];

    rows.push("用户名,调用时间,调用端口,订单号,是否成功,响应时间(ms)");

    for (const log of logRecords) {
      const success = log.status_code >= 200 && log.status_code < 300 ? "成功" : "失败";
      const orderId = log.order_id || "-";
      const userName = log.user_name || "Anonymous";
      const time = new Date(log.created_at).toLocaleString("zh-CN", { hour12: false });
      const csvRow = [
        userName,
        time,
        log.api_path,
        orderId,
        success,
        log.processing_time_ms,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");

      rows.push(csvRow);
    }

    const bom = "\uFEFF";
    const csv = bom + rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("X-Billing-Period", `${startDate} ~ ${endDate}`);
    res.setHeader("X-Billing-Total-Calls", totalCalls.toString());
    res.setHeader("X-Billing-Summary", summaryLine);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="billing_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
      return;
    }
    res.status(500).json({
      status: "error",
      message: "Failed to export billing data",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// === Invoice Generation ===

const generateInvoiceSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
  start_date: z.string().min(1, "start_date is required"),
  end_date: z.string().min(1, "end_date is required"),
});

router.get("/billing/invoices", (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string | undefined;
    const invoices = listInvoices(userId);
    const unpaidTotal = getUnpaidTotal(userId);
    res.json({ status: "success", invoices, unpaid_total: unpaidTotal });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to list invoices", details: String(err) });
  }
});

router.get("/billing/invoice/:id", (req: Request, res: Response) => {
  try {
    const invoice = getInvoice(req.params.id);
    if (!invoice) {
      res.status(404).json({ status: "error", message: "Invoice not found" });
      return;
    }
    res.json({ status: "success", invoice });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to get invoice", details: String(err) });
  }
});

router.get("/billing/invoice/:id/pdf", async (req: Request, res: Response) => {
  try {
    const invoice = getInvoice(req.params.id);
    if (!invoice) {
      res.status(404).json({ status: "error", message: "Invoice not found" });
      return;
    }
    const [company, pricing] = await Promise.all([
      cacheGet<Record<string, string>>(COMPANY_KEY),
      cacheGet<Record<string, number>>(PRICING_KEY),
    ]);
    const companyInfo = { ...DEFAULT_COMPANY, ...(company || {}) };
    const pricingInfo = { ...DEFAULT_PRICING, ...(pricing || {}) };

    const doc = generateInvoicePdf(invoice, companyInfo, pricingInfo);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.bill_number}.pdf"`
    );
    doc.pipe(res);
    doc.end();
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to generate PDF", details: String(err) });
  }
});

router.get("/billing/invoice/:id/csv", (req: Request, res: Response) => {
  try {
    const invoice = getInvoice(req.params.id);
    if (!invoice) {
      res.status(404).json({ status: "error", message: "Invoice not found" });
      return;
    }
    const logs = getInvoiceDetailLogs(req.params.id);
    const rows: string[] = [];
    const breakdown = JSON.parse(invoice.breakdown) as Record<string, { unit_price: number }>;

    // === Summary rows ===
    const endpointNames: Record<string, string> = {
      address: "地址清洗", name: "姓名清洗", item: "商品清洗",
      classify: "HS分类", compliance: "合规检查",
    };

    const successByOp: Record<string, number> = {};
    const failByOp: Record<string, number> = {};
    let totalAmount = 0;

    for (const log of logs) {
      const success = log.status_code >= 200 && log.status_code < 300;
      const opType = log.operation_type || "other";
      if (success) {
        successByOp[opType] = (successByOp[opType] || 0) + 1;
        totalAmount = Math.round((totalAmount + (breakdown[opType]?.unit_price || 0)) * 100) / 100;
      } else {
        failByOp[opType] = (failByOp[opType] || 0) + 1;
      }
    }

    // Header
    rows.push(`"账单号","${invoice.bill_number}"`);
    rows.push(`"客户","${invoice.company_name || invoice.user_name}"`);
    rows.push(`"账期","${invoice.period_start} ~ ${invoice.period_end}"`);
    rows.push("");

    // Success summary
    rows.push('"成功调用汇总"');
    rows.push('"接口","次数","金额(¥)"');
    for (const op of Object.keys(endpointNames)) {
      const cnt = successByOp[op] || 0;
      if (cnt === 0) continue;
      const amount = Math.round(cnt * (breakdown[op]?.unit_price || 0) * 100) / 100;
      rows.push(`"${endpointNames[op] || op}","${cnt}","${amount.toFixed(2)}"`);
    }
    const successTotal = Object.values(successByOp).reduce((a, b) => a + b, 0);
    rows.push(`"合计","${successTotal}","${totalAmount.toFixed(2)}"`);
    rows.push("");

    // Failure summary
    rows.push('"失败调用汇总"');
    rows.push('"接口","次数"');
    for (const op of Object.keys(endpointNames)) {
      const cnt = failByOp[op] || 0;
      if (cnt === 0) continue;
      rows.push(`"${endpointNames[op] || op}","${cnt}"`);
    }
    const failTotal = Object.values(failByOp).reduce((a, b) => a + b, 0);
    rows.push(`"合计","${failTotal}"`);
    rows.push("");

    // Detail
    rows.push('"明细"');
    rows.push("调用时间,调用接口,订单号,状态,费用(¥)");

    for (const log of logs) {
      const success = log.status_code >= 200 && log.status_code < 300 ? "成功" : "失败";
      const orderId = log.order_id || "-";
      const time = new Date(log.created_at).toLocaleString("zh-CN", { hour12: false });
      const opType = log.operation_type || "other";
      const price = success === "成功" ? (breakdown[opType]?.unit_price || 0) : 0;
      rows.push(`"${time}","${opType}","${orderId}","${success}","${price.toFixed(2)}"`);
    }

    const bom = "\uFEFF";
    const csv = bom + rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.bill_number}_detail.csv"`
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to export CSV", details: String(err) });
  }
});

router.put("/billing/invoice/:id/pay", (req: Request, res: Response) => {
  try {
    const invoice = payInvoice(req.params.id);
    if (!invoice) {
      res.status(404).json({ status: "error", message: "Invoice not found" });
      return;
    }
    res.json({ status: "success", invoice });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to mark as paid", details: String(err) });
  }
});

router.delete("/billing/invoice/:id/return", (req: Request, res: Response) => {
  try {
    const invoice = getInvoice(req.params.id);
    if (!invoice) {
      res.status(404).json({ status: "error", message: "Invoice not found" });
      return;
    }
    if (invoice.paid) {
      res.status(403).json({ status: "error", message: "已付款账单不可退回" });
      return;
    }
    deleteInvoice(req.params.id);
    res.json({ status: "success", message: "账单已退回，可重新生成" });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to return invoice", details: String(err) });
  }
});

router.post("/billing/generate", async (req: Request, res: Response) => {
  try {
    const parsed = generateInvoiceSchema.parse(req.body);
    const user = getUserById(parsed.user_id);
    if (!user) {
      res.status(404).json({ status: "error", message: "User not found" });
      return;
    }

    const [pricing] = await Promise.all([
      cacheGet<Record<string, number>>(PRICING_KEY),
    ]);
    const pricingInfo = { ...DEFAULT_PRICING, ...(pricing || {}) };

    // Check for duplicate invoice (same user + same period)
    const existing = findExistingInvoice(user.id, parsed.start_date, parsed.end_date);
    if (existing) {
      res.json({ status: "success", invoice: existing, duplicate: true });
      return;
    }

    const invoice = generateInvoice({
      user_id: user.id,
      user_name: user.name,
      company_name: user.company_name,
      contact_email: user.contact_email,
      contact_phone: user.contact_phone,
      start_date: parsed.start_date,
      end_date: parsed.end_date,
      pricing: pricingInfo,
    });

    res.json({ status: "success", invoice });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
      return;
    }
    res.status(500).json({ status: "error", message: "Failed to generate invoice", details: String(err) });
  }
});

export default router;
