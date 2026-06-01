import axios from "axios";
import { cacheGet, cacheSet, getCredential } from "./cache";
import { addressCacheKey } from "../utils/hash";
import type { AddressResult } from "../schemas/address";

const GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
const VALIDATION_BASE =
  "https://addressvalidation.googleapis.com/v1:validateAddress";

function getProxyConfig(): { host: string; port: number; protocol: string } | undefined {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return { host: u.hostname, port: parseInt(u.port) || 443, protocol: u.protocol.replace(":", "") };
  } catch {
    return undefined;
  }
}

export interface GoogleGeocodingResult {
  formattedAddress: string;
  postalCode: string;
  components: Record<string, string>;
}

export interface GoogleValidationResult {
  validationGranularity: string;
  verdict: string;
  uspsDpvConfirmation: string | null;
  uspsDpvCmra: string | null;
}

async function geocodeSingle(
  address: string,
  language: string
): Promise<GoogleGeocodingResult | null> {
  try {
    const apiKey = await getCredential("GOOGLE_MAPS_API_KEY");
    const response = await axios.get(GEOCODE_BASE, {
      params: { address, language, key: apiKey },
      timeout: 8000,
      proxy: getProxyConfig(),
    });

    const data = response.data;
    if (!data || data.status !== "OK" || !data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    const components: Record<string, string> = {};

    for (const comp of result.address_components || []) {
      for (const type of comp.types || []) {
        components[type] = comp.long_name || "";
      }
    }

    const postalCode =
      components.postal_code ||
      components.postal_code_prefix ||
      "";

    return {
      formattedAddress: result.formatted_address || "",
      postalCode,
      components,
    };
  } catch {
    return null;
  }
}

async function validateAddress(
  address: string
): Promise<GoogleValidationResult | null> {
  try {
    const apiKey = await getCredential("GOOGLE_MAPS_API_KEY");
    const response = await axios.post(
      VALIDATION_BASE,
      {
        address: { addressLines: [address] },
      },
      {
        params: { key: apiKey },
        timeout: 10000,
        proxy: getProxyConfig(),
      }
    );

    const data = response.data;
    if (!data || !data.result) return null;

    return {
      validationGranularity:
        data.result.verdict?.validationGranularity || "UNKNOWN",
      verdict: data.result.verdict?.inputGranularity || "UNKNOWN",
      uspsDpvConfirmation: data.result.uspsData?.dpvConfirmation || null,
      uspsDpvCmra: data.result.uspsData?.dpvCmra || null,
    };
  } catch {
    return null;
  }
}

export interface GoogleMapsCombinedResult {
  address: AddressResult;
  postalCode: string;
  components: Record<string, string>;
  uspsDpvConfirmation: string | null;
  uspsDpvCmra: string | null;
  source?: "cache" | "live";
}

export async function fetchGoogleMaps(
  rawAddress: string,
  providedZipcode: string
): Promise<GoogleMapsCombinedResult | null> {
  const cacheKey = addressCacheKey(rawAddress, providedZipcode);
  const cached = await cacheGet<GoogleMapsCombinedResult>(cacheKey);
  if (cached) return { ...cached, source: "cache" };

  try {
    const [jaResult, enResult, validation] = await Promise.all([
      geocodeSingle(rawAddress, "ja"),
      geocodeSingle(rawAddress, "en"),
      validateAddress(rawAddress),
    ]);

    if (!jaResult && !enResult && !validation) return null;

    const validationLevel = validation?.validationGranularity || "UNKNOWN";
    const isBelowRoute = ["UNKNOWN", "OTHER"].includes(validationLevel);
    const isPostalCodeMatch = jaResult?.postalCode
      ? jaResult.postalCode.replace(/[\s\-]/g, "") ===
        providedZipcode.replace(/[\s\-]/g, "")
      : false;

    const result: GoogleMapsCombinedResult = {
      address: {
        is_valid: !isBelowRoute,
        validation_level: validationLevel,
        verdict_level: "",
        verdict_message: "",
        japanese_address: jaResult?.formattedAddress || rawAddress,
        english_address: enResult?.formattedAddress || rawAddress,
      },
      postalCode: jaResult?.postalCode || enResult?.postalCode || "",
      components: jaResult?.components || enResult?.components || {},
      uspsDpvConfirmation: validation?.uspsDpvConfirmation || null,
      uspsDpvCmra: validation?.uspsDpvCmra || null,
    };

    // Only cache high-quality results: SUB_PREMISE, PREMISE, STREET_ADDRESS
    const CACHEABLE_LEVELS = ["SUB_PREMISE", "PREMISE", "STREET_ADDRESS"];
    if (CACHEABLE_LEVELS.includes(validationLevel)) {
      await cacheSet(cacheKey, result);
    }
    return { ...result, source: "live" };
  } catch {
    return null;
  }
}
