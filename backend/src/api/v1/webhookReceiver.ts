import { Router, Request, Response } from "express";

const router = Router();

// In-memory store for webhook results (keyed by token)
const results = new Map<string, any>();

// TTL cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of results) {
    if (now - val._ts > 30 * 60 * 1000) results.delete(key);
  }
}, 60000);

// Receive webhook POST from our own server
router.post("/webhook/in/:userId/:token", (req: Request, res: Response) => {
  const key = `${req.params.userId}:${req.params.token}`;
  results.set(key, { ...req.body, _ts: Date.now() });
  res.json({ status: "ok" });
});

// GET the stored webhook result
router.get("/webhook/result/:token", (req: Request, res: Response) => {
  // Search all keys for matching token
  for (const [key, val] of results) {
    if (key.endsWith(":" + req.params.token)) {
      return res.json({ status: "ready", data: val });
    }
  }
  res.json({ status: "pending" });
});

export default router;
