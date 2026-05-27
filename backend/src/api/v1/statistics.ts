import { Router, Request, Response } from "express";
import { getHistoryStats } from "../../services/historyStore";
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
