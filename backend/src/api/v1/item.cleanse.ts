import { Router, Request, Response } from "express";
import crypto from "crypto";
import { ZodError, z } from "zod";
import { itemCleanseRequestSchema } from "../../schemas/item";
import { cleanseItem } from "../../services/item.service";
import { insertHistory } from "../../services/historyStore";
import { cacheIncr } from "../../services/cache";
import { generateReferenceId } from "../../utils/reference";

const router = Router();

const batchItemSchema = z.object({
  items: z.array(itemCleanseRequestSchema).min(1).max(100),
});

router.post("/item", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const parsed = itemCleanseRequestSchema.parse(req.body);
    const referenceId = parsed.order_id || generateReferenceId();
    const result = await cleanseItem(referenceId, parsed.raw_description, parsed.hs_code, parsed.declared_value_jpy);
    const processingTime = Date.now() - startTime;
    await cacheIncr("stats:total_requests");
    insertHistory({ id: crypto.randomUUID(), order_id: referenceId, operation_type: "item", request_json: JSON.stringify(parsed), response_json: JSON.stringify(result), source: result.source, processing_time_ms: processingTime, created_at: new Date().toISOString() });
    res.json({ status: "success" as const, reference_id: referenceId, data: { item: result.item, compliance: result.compliance } });
  } catch (err) {
    handleError(err, res, "Item");
  }
});

router.post("/item/batch", async (req: Request, res: Response) => {
  try {
    const parsed = batchItemSchema.parse(req.body);
    const results = await Promise.all(parsed.items.map(async (item) => {
      const referenceId = item.order_id || generateReferenceId();
      const result = await cleanseItem(referenceId, item.raw_description, item.hs_code, item.declared_value_jpy);
      return { reference_id: referenceId, data: { item: result.item, compliance: result.compliance } };
    }));
    res.json({ status: "success", results });
  } catch (err) {
    handleError(err, res, "Item");
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
