import { Router, Request, Response } from "express";
import crypto from "crypto";
import { ZodError, z } from "zod";
import { nameCleanseRequestSchema } from "../../schemas/name";
import { cleanseName } from "../../services/name.service";
import { insertHistory } from "../../services/historyStore";
import { cacheIncr } from "../../services/cache";
import { generateReferenceId } from "../../utils/reference";

const router = Router();

const batchNameSchema = z.object({
  items: z.array(nameCleanseRequestSchema).min(1).max(100),
});

router.post("/name", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const parsed = nameCleanseRequestSchema.parse(req.body);
    const referenceId = parsed.order_id || generateReferenceId();
    const result = await cleanseName(referenceId, parsed.raw_name);
    const processingTime = Date.now() - startTime;
    await cacheIncr("stats:total_requests");
    await cacheIncr(`stats:source:${result.source}`);
    insertHistory({ id: crypto.randomUUID(), order_id: referenceId, operation_type: "name", request_json: JSON.stringify(parsed), response_json: JSON.stringify(result), source: result.source, processing_time_ms: processingTime, created_at: new Date().toISOString() });
    res.json({ status: "success" as const, reference_id: referenceId, data: { name: result.name } });
  } catch (err) {
    handleError(err, res, "Name");
  }
});

router.post("/name/batch", async (req: Request, res: Response) => {
  try {
    const parsed = batchNameSchema.parse(req.body);
    const results = await Promise.all(parsed.items.map(async (item) => {
      const referenceId = item.order_id || generateReferenceId();
      const result = await cleanseName(referenceId, item.raw_name);
      return { reference_id: referenceId, data: { name: result.name } };
    }));
    res.json({ status: "success", results });
  } catch (err) {
    handleError(err, res, "Name");
  }
});

function handleError(err: unknown, res: Response, name: string): void {
  if (err instanceof ZodError) {
    res.status(400).json({ status: "error", message: "Validation failed", details: err.errors.map(e => ({ path: e.path.join("."), message: e.message })) });
    return;
  }
  res.status(500).json({ status: "error", message: `${name} cleansing failed`, details: err instanceof Error ? err.message : String(err) });
}

export default router;
