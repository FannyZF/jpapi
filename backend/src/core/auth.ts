import { Request, Response, NextFunction } from "express";
import { config } from "./config";
import {
  getUserByApiKey,
  hasPermission,
  setUserLastUsed,
} from "../services/userStore";

const ROUTE_PERMISSIONS: Record<string, string> = {
  "POST /cleanse/address": "address",
  "POST /cleanse/name": "name",
  "POST /cleanse/item": "item",
  "GET /cache": "cache",
  "GET /cache/": "cache",
  "PUT /cache/": "cache",
  "DELETE /cache/": "cache",
  "GET /users": "admin",
  "GET /users/": "admin",
  "POST /users": "admin",
  "PUT /users/": "admin",
  "POST /users/": "admin",
  "DELETE /users/": "admin",
  "GET /settings": "admin",
  "PUT /settings": "admin",
  "GET /statistics": "admin",
  "GET /billing": "admin",
  "GET /billing/": "admin",
  "POST /compliance": "compliance",
  "POST /compliance/": "compliance",
  "POST /classify": "classify",
  "POST /classify/": "classify",
};

function getRequiredPermission(method: string, path: string): string | null {
  const base = path.replace("/api/v1", "");

  for (const [pattern, perm] of Object.entries(ROUTE_PERMISSIONS)) {
    const [pm, pp] = pattern.split(" ");
    if (pm === method && base.startsWith(pp)) {
      return perm;
    }
  }

  return null;
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (config.AUTH_BYPASS_LOCALHOST === "true") {
    const ip = req.ip || req.socket.remoteAddress || "";
    if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
      // Still set user if API key provided (needed for webhook detection)
      const apiKey = req.headers["x-api-key"] as string | undefined;
      if (apiKey) {
        const user = getUserByApiKey(apiKey);
        if (user) {
          setUserLastUsed(apiKey);
          (req as Request & { user?: typeof user; rawApiKey?: string }).user = user;
          (req as any).rawApiKey = apiKey;
        }
      }
      next();
      return;
    }
  }

  const path = req.path;
  const method = req.method.toUpperCase();

  const requiredPerm = getRequiredPermission(method, path);
  if (!requiredPerm) {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      status: "error",
      message: "Missing X-API-Key header",
    });
    return;
  }

  const user = getUserByApiKey(apiKey);

  if (!user) {
    res.status(403).json({
      status: "error",
      message: "Invalid or inactive API key",
    });
    return;
  }

  if (!hasPermission(user, requiredPerm)) {
    res.status(403).json({
      status: "error",
      message: `User does not have permission: ${requiredPerm}`,
    });
    return;
  }

  setUserLastUsed(apiKey);

  (req as any).rawApiKey = apiKey;
  (req as Request & { user?: typeof user }).user = user;

  next();
}
