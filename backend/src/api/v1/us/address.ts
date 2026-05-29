import { Router, Request, Response } from "express";
import { ZodError, z } from "zod";
import { fetchGoogleMaps } from "../../../services/googleMaps";
import { checkPOBox } from "../../../services/usCompliance.service";

const router = Router();

const addressSchema = z.object({
  order_id: z.string().optional(),
  raw_address: z.string().min(1),
  zipcode: z.string().min(1),
  weight_lbs: z.number().optional(),
  length_in: z.number().optional(),
  width_in: z.number().optional(),
  height_in: z.number().optional(),
});

router.post("/us/cleanse/address", async (req: Request, res: Response) => {
  try {
    const parsed = addressSchema.parse(req.body);
    const result = await fetchGoogleMaps(parsed.raw_address, parsed.zipcode);

    if (!result) {
      res.json({
        status: "success",
        is_valid: false,
        validation_level: "UNKNOWN",
        verdict: "需要人工核实",
        japanese_address: parsed.raw_address,
        english_address: parsed.raw_address,
        zip_match: false,
        warnings: [{ level: "warning", message: "Google Maps地址验证失败，请核实地址" }],
      });
      return;
    }

    const address = result.address;
    const zipMatch = result.postalCode?.replace(/[\s\-]/g, "") === parsed.zipcode.replace(/[\s\-]/g, "");

    const warnings: any[] = [];
    const poBox = checkPOBox(parsed.raw_address);
    if (poBox) warnings.push(poBox);

    const verdictMap: Record<string, string> = {
      "PREMISE": "可信，可用于寄递",
      "SUB_PREMISE": "可信，可用于寄递",
      "STREET_ADDRESS": "基本可信",
      "ROUTE": "建议核实，精度不足",
      "NEIGHBORHOOD": "建议核实，精度不足",
      "LOCALITY": "需要核实",
    };

    res.json({
      status: "success",
      is_valid: address.is_valid,
      validation_level: address.validation_level,
      verdict: verdictMap[address.validation_level] || "需要核实",
      japanese_address: address.japanese_address,
      english_address: address.english_address,
      zip_match: zipMatch,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ status: "error", message: "Validation failed", details: err.errors.map(e => e.message) });
      return;
    }
    res.status(500).json({ status: "error", message: "Address validation failed" });
  }
});

export default router;
