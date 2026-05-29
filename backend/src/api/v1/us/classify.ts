import { Router, Request, Response } from "express";
import { ZodError, z } from "zod";
import { suggestHsCodes } from "../../../services/hsCode.service";
import { lookupHsCode } from "../../../services/hsCode.service";

const router = Router();

const classifySchema = z.object({
  raw_description: z.string().min(1),
  hs_code: z.string().optional(),
});

router.post("/us/classify", async (req: Request, res: Response) => {
  try {
    const parsed = classifySchema.parse(req.body);
    const candidates = await suggestHsCodes(parsed.raw_description);
    const best = candidates[0];

    if (parsed.hs_code) {
      const lookup = lookupHsCode(parsed.hs_code);
      res.json({
        status: "success",
        mode: "verify",
        provided_hs_code: parsed.hs_code,
        hs_code_valid: !!lookup,
        hs_code_description: lookup?.description || null,
        suggested_hs_code: best?.code || null,
        suggested_description: best?.description || null,
        confidence: best?.confidence || 0,
        matched: best?.code === parsed.hs_code.replace(/[.\-\s]/g, ""),
      });
      return;
    }

    res.json({
      status: "success",
      mode: "classify",
      hs_code: best?.code || null,
      description: best?.description || null,
      confidence: best?.confidence || 0,
      alternatives: candidates.slice(1, 3).map(c => ({ code: c.code, description: c.description, confidence: c.confidence })),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ status: "error", message: "Validation failed", details: err.errors.map(e => e.message) });
      return;
    }
    res.status(500).json({ status: "error", message: "Classification failed" });
  }
});

export default router;
