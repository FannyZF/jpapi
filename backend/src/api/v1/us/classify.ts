import { Router, Request, Response } from "express";
import { ZodError, z } from "zod";
import crypto from "crypto";
import { suggestHsCodes } from "../../../services/hsCode.service";
import { lookupHsCode } from "../../../services/hsCode.service";
import { estimateUsDuty } from "../../../services/dutyRate.service";
import { logger } from "../../../core/logger";

const router = Router();

const classifySchema = z.object({
  raw_description: z.string().min(1),
  hs_code: z.string().optional(),
  sale_price: z.number().positive().optional(),
  currency: z.string().default("CNY"),
});

router.post("/us/classify", async (req: Request, res: Response) => {
  try {
    const parsed = classifySchema.parse(req.body);
    logger.info({description:parsed.raw_description},"[US classify] Request received");
    const candidates = await suggestHsCodes(parsed.raw_description);
    logger.info({candidates:candidates.length,top:candidates[0]?.code},"[US classify] suggestHsCodes result");
    const best = candidates[0];
    const taskId = crypto.randomUUID();

    const result: any = {
      status: "success",
      task_id: taskId,
      mode: parsed.hs_code ? "verify" : "classify",
      suggested_name: parsed.raw_description.substring(0, 80),
      hs_code: best?.code || null,
      description: best?.description || null,
      confidence: best?.confidence || 0,
    };

    if (parsed.hs_code) {
      const lookup = lookupHsCode(parsed.hs_code);
      result.provided_hs_code = parsed.hs_code;
      result.hs_code_valid = !!lookup;
      result.suggested_hs_code = best?.code || null;
      result.matched = best?.code === parsed.hs_code.replace(/[.\-\s]/g, "");
    }

    if (parsed.sale_price && best?.code) {
      try {
        result.duty = await estimateUsDuty(best.code, parsed.sale_price, parsed.currency || "CNY");
      } catch {}
    }

    res.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ status: "error", message: "Validation failed", details: err.errors.map(e => e.message) });
      return;
    }
    res.status(500).json({ status: "error", message: "Classification failed" });
  }
});

export default router;
