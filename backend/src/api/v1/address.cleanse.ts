import { Router, Request, Response } from "express";
import crypto from "crypto";
import { ZodError } from "zod";
import { addressCleanseRequestSchema } from "../../schemas/address";
import { cleanseAddress } from "../../services/address.service";
import { insertHistory } from "../../services/historyStore";
import { cacheIncr } from "../../services/cache";
import { generateReferenceId } from "../../utils/reference";

const router = Router();

router.post("/address", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const parsed = addressCleanseRequestSchema.parse(req.body);
    const referenceId = parsed.order_id || generateReferenceId();

    const result = await cleanseAddress(
      referenceId,
      parsed.raw_address,
      parsed.provided_zipcode
    );

    const processingTime = Date.now() - startTime;
    await cacheIncr("stats:total_requests");
    await cacheIncr(`stats:source:${result.source}`);

    insertHistory({
      id: crypto.randomUUID(),
      order_id: referenceId,
      operation_type: "address",
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
        address: result.address,
        zipcode: result.zipcode,
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
      message: "Address cleansing failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
