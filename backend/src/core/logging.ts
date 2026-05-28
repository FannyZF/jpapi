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

  const reqBody = req.body;
  let reqBodyStr: string | null = null;
  try {
    reqBodyStr = reqBody && Object.keys(reqBody).length > 0
      ? JSON.stringify(reqBody).substring(0, 4096)
      : null;
  } catch { reqBodyStr = null; }

  const requestHash = (req as any).requestHash as string | undefined;
  const requestSignature = (req as any).requestSignature as string | undefined;

  // Compute request hash if not already set by signature middleware
  const finalRequestHash = requestHash || (
    reqBody ? crypto.createHash("sha256").update(JSON.stringify(reqBody)).digest("hex") : null
  );

  // Intercept response to inject hashes and capture for audit
  const origJson = res.json.bind(res);
  const origSend = res.send.bind(res);
  let responseBody: string | null = null;

  res.json = function (body: any): Response {
    try {
      const originalJson = JSON.stringify(body);
      const responseHash = crypto.createHash("sha256").update(originalJson).digest("hex");

      // Inject hash fields if body is an object
      if (body && typeof body === "object" && !Array.isArray(body)) {
        if (finalRequestHash) body.request_hash = "sha256:" + finalRequestHash;
        body.response_hash = "sha256:" + responseHash;
        responseBody = JSON.stringify(body);
      } else {
        responseBody = originalJson;
      }
      // Store hashes on res for audit log
      (res as any).__responseHash = responseHash;
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
    const opType = extractOperationType(req.originalUrl);
    const isInternal = opType === "health" || opType === "settings" ||
      opType === "users" || opType === "statistics" || opType === "billing" ||
      opType === "permissions" || opType === "cache_internal";
    if (isInternal) return;
    if (req.originalUrl.includes("/billing/")) return;
    const user = (req as Request & { user?: User }).user;

    const body = req.body as Record<string, unknown> | undefined;
    const processingTime = Date.now() - startTime;
    const responseHash = (res as any).__responseHash as string | null;
    const sig = requestSignature || null;
    const rh = finalRequestHash || null;

    const makeLog = (orderId: string | null) => ({
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
      request_signature: sig,
      request_hash: rh,
      response_hash: responseHash,
      created_at: new Date().toISOString(),
    });

    const isArray = Array.isArray(req.body);
    if (isArray) {
      const items = (req.body as any[]) || [];
      const logItems = items.slice(0, 100);
      for (const item of logItems) {
        const itemOrderId: string | null =
          typeof item?.order_id === "string" ? item.order_id : null;
        insertApiCallLog(makeLog(itemOrderId));
      }
    } else {
      let orderId: string | null =
        typeof body?.order_id === "string" ? body.order_id : null;
      if (!orderId && responseBody) {
        try {
          const respJson = JSON.parse(responseBody);
          if (typeof respJson === "object" && respJson !== null) {
            const refId = (respJson as Record<string,unknown>).reference_id;
            if (typeof refId === "string") orderId = refId;
          }
        } catch {}
      }
      insertApiCallLog(makeLog(orderId));
    }

    logger.info(
      { method: req.method, path: req.originalUrl, status: res.statusCode, duration: processingTime, user: user?.name || "anonymous", sig: sig ? sig.substring(0, 16) + "..." : null },
      `${req.method} ${req.originalUrl} ${res.statusCode} ${processingTime}ms`
    );
  });

  next();
}
