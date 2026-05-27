import { Router, Request, Response } from "express";
import crypto from "crypto";
import { ZodError } from "zod";
import { itemCleanseRequestSchema } from "../../schemas/item";
import { cleanseItem } from "../../services/item.service";
import { insertHistory } from "../../services/historyStore";
import { cacheIncr } from "../../services/cache";
import { generateReferenceId } from "../../utils/reference";

const router = Router();

router.post("/item", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const parsed = itemCleanseRequestSchema.parse(req.body);
    const referenceId = parsed.order_id || generateReferenceId();

    const result = await cleanseItem(
      referenceId,
      parsed.raw_description,
      parsed.hs_code,
      parsed.declared_value_jpy
    );

    const processingTime = Date.now() - startTime;
    await cacheIncr("stats:total_requests");

    insertHistory({
      id: crypto.randomUUID(),
      order_id: referenceId,
      operation_type: "item",
      request_json: JSON.stringify(parsed),
      response_json: JSON.stringify(result),
      source: result.source,
      processing_time_ms: processingTime,
      created_at: new Date().toISOString(),
    });

    res.json({
      status: "success" as const,
      reference_id: referenceId,
      data: {
        item: result.item,
        compliance: result.compliance,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
      return;
    }
    res.status(500).json({
      status: "error",
      message: "Item cleansing failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
