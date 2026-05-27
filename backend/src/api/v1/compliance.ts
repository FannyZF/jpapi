import { Router, Request, Response } from "express";
import { ZodError } from "zod";
import { z } from "zod";
import { runComplianceCheck } from "../../services/compliance.service";

const router = Router();

const complianceCheckSchema = z.object({
  items: z.array(
    z.object({
      raw_description: z.string().min(1),
      hs_code: z.string().min(1),
      declared_value_jpy: z.number().positive(),
    })
  ).min(1).max(100),
});

router.post("/compliance/check", async (req: Request, res: Response) => {
  try {
    const parsed = complianceCheckSchema.parse(req.body);

    const results = await Promise.all(parsed.items.map(async (item) => ({
      raw_description: item.raw_description,
      hs_code: item.hs_code,
      declared_value_jpy: item.declared_value_jpy,
      compliance: await runComplianceCheck(
        item.hs_code,
        item.raw_description,
        item.declared_value_jpy
      ),
    })));

    res.json({
      status: "success",
      results,
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
      message: "Compliance check failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
