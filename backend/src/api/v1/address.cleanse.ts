import { Router, Request, Response } from "express";
import crypto from "crypto";
import { ZodError, z } from "zod";
import { addressCleanseRequestSchema } from "../../schemas/address";
import { cleanseAddress } from "../../services/address.service";
import { insertHistory } from "../../services/historyStore";
import { cacheIncr } from "../../services/cache";
import { generateReferenceId } from "../../utils/reference";

const router = Router();

const batchAddressSchema = z.object({
  items: z.array(addressCleanseRequestSchema).min(1).max(100),
});

router.post("/address", async (req: Request, res: Response) => {
  // Auto-batch if body is an array
  if (Array.isArray(req.body)) {
    try {
      const safeItems = req.body.slice(0, 100);
      const results = await Promise.all(safeItems.map(async (item: any) => {
        const parsed = addressCleanseRequestSchema.parse(item);
        const referenceId = parsed.order_id || generateReferenceId();
        const result = await cleanseAddress(referenceId, parsed.raw_address, parsed.provided_zipcode);
        return { reference_id: referenceId, data: { address: result.address, zipcode: result.zipcode } };
      }));
      return res.json({ status: "success", results });
    } catch (err) {
      return handleError(err, res, "Address");
    }
  }

  // Single item
  const startTime = Date.now();
  try {
    const parsed = addressCleanseRequestSchema.parse(req.body);
    const referenceId = parsed.order_id || generateReferenceId();

    const result = await cleanseAddress(referenceId, parsed.raw_address, parsed.provided_zipcode);

    const processingTime = Date.now() - startTime;
    await cacheIncr("stats:total_requests");
    await cacheIncr(`stats:source:${result.source}`);

    insertHistory({
      id: crypto.randomUUID(), order_id: referenceId, operation_type: "address",
      request_json: JSON.stringify(parsed), response_json: JSON.stringify(result),
      source: result.source, processing_time_ms: processingTime, created_at: new Date().toISOString(),
    });

    res.json({ status: "success" as const, reference_id: referenceId, data: { address: result.address, zipcode: result.zipcode } });
  } catch (err) {
    handleError(err, res, "Address");
  }
});

router.post("/address/batch", async (req: Request, res: Response) => {
  try {
    const parsed = batchAddressSchema.parse(req.body);
    const results = await Promise.all(parsed.items.map(async (item) => {
      const referenceId = item.order_id || generateReferenceId();
      const result = await cleanseAddress(referenceId, item.raw_address, item.provided_zipcode);
      return { reference_id: referenceId, data: { address: result.address, zipcode: result.zipcode } };
    }));
    res.json({ status: "success", results });
  } catch (err) {
    handleError(err, res, "Address");
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
