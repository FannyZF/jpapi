import { Router, Request, Response } from "express";
import { cacheGet, cacheSet, clearCredentialCache } from "../../services/cache";
import { DEFAULT_PRICING, DEFAULT_COMPANY } from "../../services/billingStore";
import { importDutyCsv } from "../../services/dutyRate.service";

const SETTINGS_KEY = "settings:credentials";
const COMPANY_KEY = "settings:company";
const PRICING_KEY = "settings:pricing";

interface CredentialStatus {
  key: string;
  configured: boolean;
  masked: string;
  optional: boolean;
  description: string;
}

const router = Router();

router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const stored = await cacheGet<Record<string, string>>(SETTINGS_KEY);

    const credentials: CredentialStatus[] = [
      {
        key: "GOOGLE_MAPS_API_KEY",
        configured: !!(stored?.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
        masked: maskValue(stored?.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ""),
        optional: false,
        description: "Google Geocoding + Address Validation API",
      },
      {
        key: "YAHOO_CLIENT_ID",
        configured: !!(stored?.YAHOO_CLIENT_ID || process.env.YAHOO_CLIENT_ID),
        masked: maskValue(stored?.YAHOO_CLIENT_ID || process.env.YAHOO_CLIENT_ID || ""),
        optional: true,
        description: "Yahoo Japan Furigana API (Name conversion)",
      },
      {
        key: "REDIS_URL",
        configured: !!(stored?.REDIS_URL || process.env.REDIS_URL),
        masked: stored?.REDIS_URL || process.env.REDIS_URL || "",
        optional: false,
        description: "Redis connection URL for caching",
      },
      {
        key: "DEEPSEEK_API_KEY",
        configured: !!(stored?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY),
        masked: maskValue(stored?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || ""),
        optional: true,
        description: "DeepSeek V4 LLM API for HS Code classification",
      },
      {
        key: "QWEN_API_KEY",
        configured: !!(stored?.QWEN_API_KEY || process.env.QWEN_API_KEY),
        masked: maskValue(stored?.QWEN_API_KEY || process.env.QWEN_API_KEY || ""),
        optional: true,
        description: "QWen 3.6 Plus LLM for dual-model consensus",
      },
    ];

    res.json({ status: "success", credentials });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to get settings",
    });
  }
});

router.put("/settings", async (req: Request, res: Response) => {
  try {
    const { credentials } = req.body;

    if (!credentials || typeof credentials !== "object") {
      res.status(400).json({ status: "error", message: "credentials object is required" });
      return;
    }

    const validKeys = ["GOOGLE_MAPS_API_KEY", "YAHOO_CLIENT_ID", "REDIS_URL", "DEEPSEEK_API_KEY", "QWEN_API_KEY"];
    const updates: Record<string, string> = {};

    for (const key of validKeys) {
      if (credentials[key] !== undefined) {
        updates[key] = String(credentials[key]);
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ status: "error", message: "No valid credential keys provided" });
      return;
    }

    const current = (await cacheGet<Record<string, string>>(SETTINGS_KEY)) || {};
    const merged = { ...current, ...updates };
    await cacheSet(SETTINGS_KEY, merged);
    clearCredentialCache();

    res.json({
      status: "success",
      message: "Credentials updated",
      updated_keys: Object.keys(updates),
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to update settings",
    });
  }
});

// === Company Info ===

router.get("/settings/company", async (_req: Request, res: Response) => {
  try {
    const stored = await cacheGet<Record<string, string>>(COMPANY_KEY);
    const company = { ...DEFAULT_COMPANY, ...(stored || {}) };
    res.json({ status: "success", company });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to get company info" });
  }
});

router.put("/settings/company", async (req: Request, res: Response) => {
  try {
    const { company_name, address, phone, email, tax_id } = req.body || {};
    const updates: Record<string, string> = {};
    if (typeof company_name === "string") updates.company_name = company_name;
    if (typeof address === "string") updates.address = address;
    if (typeof phone === "string") updates.phone = phone;
    if (typeof email === "string") updates.email = email;
    if (typeof tax_id === "string") updates.tax_id = tax_id;
    const current = (await cacheGet<Record<string, string>>(COMPANY_KEY)) || {};
    const merged = { ...current, ...updates };
    await cacheSet(COMPANY_KEY, merged);
    res.json({ status: "success", message: "Company info updated", company: merged });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to update company info" });
  }
});

// === Pricing ===

router.get("/settings/pricing", async (_req: Request, res: Response) => {
  try {
    const stored = await cacheGet<Record<string, number>>(PRICING_KEY);
    const pricing = { ...DEFAULT_PRICING, ...(stored || {}) };
    res.json({ status: "success", pricing });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to get pricing" });
  }
});

router.put("/settings/pricing", async (req: Request, res: Response) => {
  try {
    const { pricing } = req.body || {};
    if (!pricing || typeof pricing !== "object") {
      res.status(400).json({ status: "error", message: "pricing object required" });
      return;
    }
    const updates: Record<string, number> = {};
    const validKeys = Object.keys(DEFAULT_PRICING);
    for (const key of validKeys) {
      if (typeof pricing[key] === "number" && pricing[key] >= 0) {
        updates[key] = pricing[key];
      }
    }
    const current = (await cacheGet<Record<string, number>>(PRICING_KEY)) || {};
    const merged = { ...current, ...updates };
    await cacheSet(PRICING_KEY, merged);
    res.json({ status: "success", message: "Pricing updated", pricing: merged });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to update pricing" });
  }
});

// === Duty Rates ===
router.put("/settings/duty-rates", async (req: Request, res: Response) => {
  try {
    await importDutyCsv();
    res.json({ status: "success", message: "Duty rates reloaded from CSV" });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to reload duty rates", details: String(err) });
  }
});

function maskValue(value: string): string {
  if (!value || value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

export default router;
