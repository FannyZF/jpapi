import { Router, Request, Response } from "express";
import { ZodError, z } from "zod";
import { suggestHsCodes, extractKeywords } from "../../../services/hsCode.service";
import { lookupHsCode } from "../../../services/hsCode.service";
import { estimateUsDuty } from "../../../services/dutyRate.service";

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
    const keywords = extractKeywords(parsed.raw_description);
    const candidates = await suggestHsCodes(parsed.raw_description);
    const best = candidates[0];

    const result: any = {
      status: "success",
      extracted_keywords: keywords,
      candidates: candidates.slice(0, 5).map(c => ({
        code: c.code,
        description: c.description,
        confidence: c.confidence,
        matched_keywords: c.matched_keywords || [],
      })),
      best_guess: best ? {
        hs_code: best.code,
        description: best.description,
        confidence: best.confidence,
        matched_keywords: best.matched_keywords || [],
      } : null,
      suggested_name: parsed.raw_description.substring(0, 80),
    };

    // Duty estimate
    if (parsed.sale_price && best?.code) {
      try {
        result.duty = await estimateUsDuty(best.code, parsed.sale_price, parsed.currency);
      } catch {}
    }

    if (parsed.hs_code) {
      const lookup = lookupHsCode(parsed.hs_code);
      result.mode = "verify";
      result.provided_hs_code = parsed.hs_code;
      result.hs_code_valid = !!lookup;
      result.suggested_hs_code = best?.code || null;
      result.matched = best?.code === parsed.hs_code.replace(/[.\-\s]/g, "");
    } else {
      result.mode = "classify";
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
