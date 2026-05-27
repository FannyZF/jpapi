import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import {
  insertApiCallLog,
  extractOperationType,
} from "../services/billingStore";
import type { User } from "../services/userStore";
import { logger } from "./logger";

export function apiCallLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Capture request body immediately
  const reqBody = req.body;
  let reqBodyStr: string | null = null;
  try {
    reqBodyStr = reqBody && Object.keys(reqBody).length > 0
      ? JSON.stringify(reqBody).substring(0, 4096)
      : null;
  } catch { reqBodyStr = null; }

  // Intercept response methods to capture response body
  let responseBody: string | null = null;
  const origJson = res.json.bind(res);
  const origSend = res.send.bind(res);

  res.json = function (body: any): Response {
    try {
      responseBody = typeof body === "string" ? body : JSON.stringify(body);
      if (responseBody.length > 4096) responseBody = responseBody.substring(0, 4096) + "...";
    } catch { responseBody = null; }
    return origJson(body);
  };

  res.send = function (body: any): Response {
    try {
      if (typeof body === "string") responseBody = body.substring(0, 4096);
      else if (body) responseBody = JSON.stringify(body).substring(0, 4096);
    } catch { responseBody = null; }
    return origSend(body);
  };

  res.on("finish", () => {
    // Skip internal admin/health/billing endpoints
    const opType = extractOperationType(req.originalUrl);
    const isInternal = opType === "health" || opType === "settings" ||
      opType === "users" || opType === "statistics" || opType === "billing" ||
      opType === "permissions" || opType === "cache_internal";
    if (isInternal) return;
    // Also skip the billing/logs API that powers the ApiLogs page itself
    if (req.originalUrl.includes("/billing/")) return;
    const user = (req as Request & { user?: User }).user;

    const body = req.body as Record<string, unknown> | undefined;
    const processingTime = Date.now() - startTime;

    // Batch request: insert one log per item for per-item billing
    const isArray = Array.isArray(req.body);
    if (isArray) {
      const items = (req.body as any[]) || [];
      const logItems = items.slice(0, 100);
      for (const item of logItems) {
        const itemOrderId: string | null =
          typeof item?.order_id === "string" ? item.order_id : null;
        insertApiCallLog({
          id: crypto.randomUUID(),
          user_id: user?.id ?? null,
          user_name: user?.name ?? null,
          method: req.method.toUpperCase(),
          api_path: req.originalUrl,
          operation_type: opType,
          status_code: res.statusCode,
          processing_time_ms: processingTime,
          ip_address: req.ip || req.socket.remoteAddress || "",
          order_id: itemOrderId,
          request_body: reqBodyStr,
          response_body: responseBody,
          deepseek_tokens: 0,
          qwen_tokens: 0,
          webhook_status: null,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      let orderId: string | null =
        typeof body?.order_id === "string" ? body.order_id : null;

      // Fallback: extract reference_id from response body
      if (!orderId && responseBody) {
        try {
          const respJson = JSON.parse(responseBody);
          if (typeof respJson === "object" && respJson !== null) {
            const refId = (respJson as Record<string,unknown>).reference_id;
            if (typeof refId === "string") orderId = refId;
          }
        } catch { /* ignore parse errors */ }
      }

      insertApiCallLog({
        id: crypto.randomUUID(),
        user_id: user?.id ?? null,
        user_name: user?.name ?? null,
        method: req.method.toUpperCase(),
        api_path: req.originalUrl,
        operation_type: opType,
        status_code: res.statusCode,
        processing_time_ms: processingTime,
        ip_address: req.ip || req.socket.remoteAddress || "",
        order_id: orderId,
        request_body: reqBodyStr,
        response_body: responseBody,
        deepseek_tokens: 0,
        qwen_tokens: 0,
        webhook_status: null,
        created_at: new Date().toISOString(),
      });
    }

    logger.info(
      { method: req.method, path: req.originalUrl, status: res.statusCode, duration: Date.now() - startTime, user: user?.name || "anonymous" },
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startTime}ms`
    );
  });

  next();
}
