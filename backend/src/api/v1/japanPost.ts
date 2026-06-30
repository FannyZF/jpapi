import { Router, Request, Response } from "express";
import { z } from "zod";
import { validateAddress } from "../../services/japanPost";
import { logger } from "../../core/logger";

const router = Router();

const validateSchema = z.object({
  raw_address: z.string().min(1, "raw_address is required"),
  provided_zipcode: z.string().min(1, "provided_zipcode is required"),
});

router.post("/jp/post/validate", async (req: Request, res: Response) => {
  try {
    const parsed = validateSchema.parse(req.body);
    logger.info({ address: parsed.raw_address, zip: parsed.provided_zipcode }, "[JapanPost] validate request");

    const result = await validateAddress(parsed.raw_address, parsed.provided_zipcode);
    res.json({ status: "success", data: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ status: "error", message: "Validation failed", details: err.errors });
      return;
    }
    logger.error({ err: err?.message }, "[JapanPost] validate error");
    res.status(500).json({ status: "error", message: "Japan Post validation failed" });
  }
});

export default router;
