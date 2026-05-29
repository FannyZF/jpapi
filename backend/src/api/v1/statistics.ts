import { Router, Request, Response } from "express";
import { getHistoryStats, getHistoryDb } from "../../services/historyStore";
import { cacheGet } from "../../services/cache";

const router = Router();

router.get("/statistics", async (_req: Request, res: Response) => {
  try {
    const dbStats = getHistoryStats();

    const dbTotal = dbStats.total_requests;
    const dbCacheHits = dbStats.by_source["cache"] || 0;
    const dbLiveHits = dbStats.by_source["live"] || 0;
    const dbFallbackHits = dbStats.by_source["fallback"] || 0;
    const cacheHitRate = dbTotal > 0 ? Math.round((dbCacheHits / dbTotal) * 10000) / 100 : 0;

    // Country breakdown from api_path
    let jpCount = 0, usCount = 0;
    try {
      const db = getHistoryDb();
      jpCount = (db.prepare(
        `SELECT COUNT(*) as cnt FROM api_call_logs WHERE operation_type IN ('address','name','item','classify','compliance') AND api_path NOT LIKE '/api/v1/us/%'`
      ).get() as any)?.cnt || 0;
      usCount = (db.prepare(
        `SELECT COUNT(*) as cnt FROM api_call_logs WHERE api_path LIKE '/api/v1/us/%'`
      ).get() as any)?.cnt || 0;
    } catch { /* table might not exist in test env */ }

    const sessionTotal =
      (await cacheGet<number>("stats:total_requests")) || 0;
    const sessionLive =
      (await cacheGet<number>("stats:source:live")) || 0;
    const sessionCache =
      (await cacheGet<number>("stats:source:cache")) || 0;
    const sessionFallback =
      (await cacheGet<number>("stats:source:fallback")) || 0;
    const sessionPartial =
      (await cacheGet<number>("stats:source:partial")) || 0;

    res.json({
      status: "success",
      data: {
        total_requests: dbTotal,
        cache_hit_rate: cacheHitRate,
        by_type: dbStats.by_type,
        by_source: dbStats.by_source,
        by_country: { jp: jpCount, us: usCount },
        session: {
          total: sessionTotal,
          live: sessionLive,
          cache: sessionCache,
          fallback: sessionFallback,
          partial: sessionPartial,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to get statistics",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
