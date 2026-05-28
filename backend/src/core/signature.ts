import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "./config";
import { logger } from "./logger";

const SKIP_PATHS = ["/health", "/webhook/in", "/billing/", "/users", "/settings", "/statistics", "/cache", "/permissions"];
const BUSINESS_PATHS = ["/classify", "/cleanse", "/compliance"];

function isBusinessEndpoint(path: string): boolean {
  return BUSINESS_PATHS.some((p) => path.includes(p));
}

function isSkipPath(path: string): boolean {
  return SKIP_PATHS.some((p) => path.includes(p));
}

export function signatureMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === "GET" || isSkipPath(req.path)) {
    next();
    return;
  }

  if (!isBusinessEndpoint(req.path)) {
    next();
    return;
  }

  const rawApiKey = (req as any).rawApiKey as string | undefined;

  // Compute request hash regardless (for audit)
  const bodyJson = JSON.stringify(req.body);
  const requestHash = crypto.createHash("sha256").update(bodyJson).digest("hex");
  (req as any).requestHash = requestHash;

  // Signature verification
  const clientSignature = req.headers["x-signature"] as string | undefined;

  if (!clientSignature) {
    if (config.SIGNATURE_REQUIRED === "true") {
      res.status(400).json({
        status: "error",
        message: "X-Signature header is required. Generate with HMAC-SHA256(request_body, api_key).",
        request_hash: requestHash,
      });
      return;
    }
    logger.warn({ path: req.path }, "Missing X-Signature header (bypass mode)");
    next();
    return;
  }

  if (!rawApiKey) {
    res.status(401).json({
      status: "error",
      message: "Authentication required for signature verification",
      request_hash: requestHash,
    });
    return;
  }

  const expectedSig = crypto
    .createHmac("sha256", rawApiKey)
    .update(bodyJson)
    .digest("hex");

  if (clientSignature !== expectedSig) {
    res.status(400).json({
      status: "error",
      message: "Signature verification failed. Request body may have been tampered with.",
      expected: expectedSig.substring(0, 16) + "...",
      received: clientSignature.substring(0, 16) + "...",
      request_hash: requestHash,
    });
    return;
  }

  (req as any).requestSignature = clientSignature;
  logger.info({ path: req.path, requestHash: requestHash.substring(0, 16) }, "Signature verified");
  next();
}
