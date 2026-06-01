import { Router, Request, Response } from "express";
import { ZodError, z } from "zod";
import { checkUSProhibited, checkPOBox, checkCarrierLimits, validateUsHscode } from "../../../services/usCompliance.service";

const router = Router();

const complianceSchema = z.object({
  items: z.array(z.object({
    raw_description: z.string().min(1),
    hs_code: z.string().min(1),
    declared_value_usd: z.number().positive(),
    weight_lbs: z.number().optional(),
    length_in: z.number().optional(),
    width_in: z.number().optional(),
    height_in: z.number().optional(),
    address_hint: z.string().optional(),
  })).min(1).max(100),
});

router.post("/us/compliance/check", async (req: Request, res: Response) => {
  try {
    const parsed = complianceSchema.parse(req.body);
    const results = parsed.items.map(item => {
      const warnings: any[] = [];

      // Prohibited / restricted goods
      warnings.push(...checkUSProhibited(item.raw_description));

      // HS code validation
      const hs = validateUsHscode(item.hs_code);
      if (!hs.valid) {
        warnings.push({ level: "warning", check: "hs_code", message: "HS code not found in database — please verify" });
      }

      // PO Box
      if (item.address_hint) {
        const poBox = checkPOBox(item.address_hint);
        if (poBox) warnings.push(poBox);
      }

      // Carrier limits
      let carrierRestrictions: any = undefined;
      if (item.weight_lbs && item.length_in && item.width_in && item.height_in) {
        const { warnings: cw, restrictions } = checkCarrierLimits(
          item.weight_lbs, item.length_in, item.width_in, item.height_in
        );
        warnings.push(...cw);
        if (Object.values(restrictions).some(r => r.length > 0)) {
          carrierRestrictions = restrictions;
        }
      }

      const passed = !warnings.some(w => w.level === "blocked" || w.level === "restricted");

      return {
        raw_description: item.raw_description,
        hs_code: item.hs_code,
        declared_value_usd: item.declared_value_usd,
        passed,
        hs_code_valid: hs.valid,
        hs_code_description: hs.description,
        warnings,
        carrier_restrictions: carrierRestrictions,
      };
    });

    res.json({ status: "success", results });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ status: "error", message: "Validation failed", details: err.errors.map(e => e.message) });
      return;
    }
    res.status(500).json({ status: "error", message: "Compliance check failed" });
  }
});

export default router;
