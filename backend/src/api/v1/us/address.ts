import { Router, Request, Response } from "express";
import { ZodError, z } from "zod";
import { fetchGoogleMaps } from "../../../services/googleMaps";
import { checkPOBox, detectAddressType } from "../../../services/usCompliance.service";

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
        verdict: "Review needed",
        formatted_address: parsed.raw_address,
        zip_match: false,
        address_type: detectAddressType(null, null, parsed.raw_address),
        warnings: [{ level: "warning", message: "Address validation failed — manual review required" }],
      });
      return;
    }

    const address = result.address;
    const zipMatch = result.postalCode?.replace(/[\s\-]/g, "") === parsed.zipcode.replace(/[\s\-]/g, "");

    const warnings: any[] = [];
    const poBox = checkPOBox(parsed.raw_address);
    if (poBox) warnings.push(poBox);

    const verdictMap: Record<string, string> = {
      "PREMISE": "Verified - Safe to ship",
      "SUB_PREMISE": "Verified - Safe to ship",
      "STREET_ADDRESS": "Likely valid",
      "ROUTE": "Review needed - low precision",
      "NEIGHBORHOOD": "Review needed - low precision",
      "LOCALITY": "Review needed",
    };

    res.json({
      status: "success",
      is_valid: address.is_valid,
      validation_level: address.validation_level,
      verdict: verdictMap[address.validation_level] || "Review needed",
      formatted_address: address.english_address,
      zip_match: zipMatch,
      address_type: detectAddressType(result.uspsDpvConfirmation, result.uspsDpvCmra, parsed.raw_address),
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
