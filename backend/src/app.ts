import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { config } from "./core/config";
import { globalErrorHandler } from "./core/exceptions";
import { initHistoryStore } from "./services/historyStore";
import { ensureUsersTable, createUser, listUsers } from "./services/userStore";
import { ensureApiCallLogsTable, ensureInvoicesTable } from "./services/billingStore";
import { ensureHsCodeTable } from "./services/hsCode.service";
import { getRedisClient } from "./services/cache";
import { authMiddleware } from "./core/auth";
import { signatureMiddleware } from "./core/signature";
import { apiCallLoggingMiddleware } from "./core/logging";
import { createRateLimiter } from "./core/rateLimiter";
import { logger } from "./core/logger";

import addressCleanseRouter from "./api/v1/address.cleanse";
import addressUploadRouter from "./api/v1/address.upload";
import nameCleanseRouter from "./api/v1/name.cleanse";
import itemCleanseRouter from "./api/v1/item.cleanse";
import statisticsRouter from "./api/v1/statistics";
import cacheRouter from "./api/v1/cache";
import settingsRouter from "./api/v1/settings";
import adminRouter from "./api/v1/admin";
import billingRouter from "./api/v1/billing";
import complianceRouter from "./api/v1/compliance";
import classifyRouter from "./api/v1/classify";
import webhookReceiverRouter from "./api/v1/webhookReceiver";
import healthRouter from "./api/v1/health";
import usRouter from "./api/v1/us";

export let redisAvailable = false;

const app = express();

app.use(
  cors({
    origin: config.CORS_ORIGINS.split(",").map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json());

// Global rate limiter
app.use(
  createRateLimiter(
    config.RATE_LIMIT_WINDOW_MS,
    config.RATE_LIMIT_MAX,
    "Too many requests, please try again later."
  )
);

app.use(apiCallLoggingMiddleware);

app.use("/api/v1", healthRouter);
app.use("/api/v1", webhookReceiverRouter);

app.use(authMiddleware);

app.use(signatureMiddleware);

app.use("/api/v1", settingsRouter);
app.use("/api/v1", adminRouter);
app.use("/api/v1", statisticsRouter);
app.use("/api/v1", billingRouter);

// JP routes (legacy + new prefix)
app.use("/api/v1", complianceRouter);
app.use("/api/v1", classifyRouter);
app.use("/api/v1/cleanse", addressCleanseRouter);
app.use("/api/v1/cleanse", nameCleanseRouter);
app.use("/api/v1/cleanse", itemCleanseRouter);
app.use("/api/v1", addressUploadRouter);
app.use("/api/v1/jp", complianceRouter);
app.use("/api/v1/jp", classifyRouter);
app.use("/api/v1/jp/cleanse", addressCleanseRouter);
app.use("/api/v1/jp/cleanse", nameCleanseRouter);
app.use("/api/v1/jp/cleanse", itemCleanseRouter);

// US routes
app.use("/api/v1", usRouter);

app.use("/api/v1", cacheRouter);

app.use(globalErrorHandler);

// Production: serve frontend static files
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export async function start(): Promise<void> {
  const logsDir = path.resolve(__dirname, "../../logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  initHistoryStore();
  ensureUsersTable();
  ensureApiCallLogsTable();
  ensureInvoicesTable();
  ensureHsCodeTable();
  logger.info(`SQLite initialized at ${config.SQLITE_PATH}`);

  const users = listUsers();
  const hasAdmin = users.some((u) => u.permissions.includes("admin"));
  if (!hasAdmin) {
    const result = createUser("admin", ["admin"]);
    logger.warn("============================================================");
    logger.warn("  ADMIN API KEY — 仅显示一次，请立即保存！");
    logger.warn(`  ${result.apiKey}`);
    logger.warn("");
    logger.warn("  登录: http://localhost:" + config.PORT + "/?key=" + result.apiKey);
    logger.warn("  丢失后可用 regenerate-key 生成新 Key");
    logger.warn("============================================================");
  }

  try {
    const redis = getRedisClient();
    await redis.connect();
    redisAvailable = true;
    logger.info("Redis connected");
  } catch (err) {
    logger.warn("Redis unavailable, running without cache");
    logger.warn(`Redis error: ${(err as Error).message}`);
  }

  app.listen(config.PORT, () => {
    logger.info(`Server running on http://localhost:${config.PORT}`);
    if (!redisAvailable) {
      logger.warn("Caching disabled, all requests will be live");
    }
  });
}

if (require.main === module || process.argv[1]?.endsWith("app.ts")) {
  start();
}

export { app };
