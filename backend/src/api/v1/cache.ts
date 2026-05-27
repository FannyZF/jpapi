import { Router, Request, Response } from "express";
import { cacheGet, cacheSet, cacheDelete, cacheScan } from "../../services/cache";

const router = Router();

router.get("/cache", async (req: Request, res: Response) => {
  try {
    const pattern = (req.query.pattern as string) || "*";
    const keys = await cacheScan(pattern, 100);

    const entries = [];
    for (const key of keys.slice(0, 50)) {
      const value = await cacheGet<unknown>(key);
      entries.push({ key, value });
    }

    res.json({
      status: "success",
      total_keys: keys.length,
      entries,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to list cache entries",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/cache/:key", async (req: Request, res: Response) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const value = await cacheGet<unknown>(key);

    if (value === null) {
      res.status(404).json({ status: "error", message: "Cache entry not found" });
      return;
    }

    res.json({ status: "success", key, value });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to get cache entry",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.put("/cache/:key", async (req: Request, res: Response) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { value } = req.body;

    if (value === undefined) {
      res.status(400).json({ status: "error", message: "value is required" });
      return;
    }

    await cacheSet(key, value);
    res.json({ status: "success", key, value });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to update cache entry",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.delete("/cache/:key", async (req: Request, res: Response) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const deleted = await cacheDelete(key);
    res.json({ status: "success", key, deleted });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to delete cache entry",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
