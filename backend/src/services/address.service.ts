import { fetchZipCloud } from "./zipcloud";
import { fetchGoogleMaps } from "./googleMaps";
import { getCredential } from "./cache";
import { formatZipcode } from "../utils/textCleaner";
import type { AddressCleanseResponse } from "../schemas/address";

type Source = "live" | "cache" | "fallback";
type AddressServiceResult = AddressCleanseResponse["data"] & { source: Source };

function isPlaceholderKey(key: string): boolean {
  return !key || key.startsWith("placeholder") || key.length < 20;
}

// Extract room/apartment number to strip before validation, reattach after
function extractRoomNumber(address: string): { base: string; room: string } {
  const roomPatterns = [
    /(\d+[号ＦFf階阶])\s*$/,
    /([A-Za-z]?\d{2,4}[号室]?)\s*$/,
    /(\d{3,4}[号室])\s*$/,
    /([\d零一二三四五六七八九十]+[号室階Ff])\s*$/,
    /(\d+[‐\-–—ー]\d+[号室]?)\s*$/,
    /(\d+[番号]?\s*\d+[号室])\s*$/,
  ];

  for (const pattern of roomPatterns) {
    const match = address.match(pattern);
    if (match) {
      const room = match[1];
      const base = address.slice(0, match.index).trim().replace(/[、,]\s*$/, "");
      return { base, room };
    }
  }

  // Try to split on last hyphen/dash if address contains multiple
  const parts = address.split(/[\s　]+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^\d/.test(last) && last.length <= 10) {
      const base = parts.slice(0, -1).join(" ");
      return { base, room: last };
    }
  }

  return { base: address, room: "" };
}

export async function cleanseAddress(
  orderId: string,
  rawAddress: string,
  providedZipcode: string
): Promise<AddressServiceResult> {
  const normalizedProvided = providedZipcode.replace(/[\s\-]/g, "");

  // Extract room number, validate base address first
  const { base: baseAddress, room } = extractRoomNumber(rawAddress);

  const zipResult = await fetchZipCloud(providedZipcode);
  const zipValid = zipResult !== null;

  const googleKey = await getCredential("GOOGLE_MAPS_API_KEY");
  const hasValidGoogleKey = !isPlaceholderKey(googleKey);

  let googleResult = null;
  if (hasValidGoogleKey) {
    // Try with room-stripped base address first
    googleResult = await fetchGoogleMaps(baseAddress, providedZipcode);
    // If base fails and we had a room number, try full address as fallback
    if (googleResult && !googleResult.address.is_valid && room) {
      const fullResult = await fetchGoogleMaps(rawAddress, providedZipcode);
      if (fullResult && fullResult.address.is_valid) {
        googleResult = fullResult;
      }
    }
  }

  const googlePostalCode =
    googleResult?.postalCode?.replace(/[\s\-]/g, "") || "";
  const googleZipMatch =
    googlePostalCode === normalizedProvided && googlePostalCode !== "";
  const zipMatch = hasValidGoogleKey ? googleZipMatch : zipValid;

  const hasGoogleData = googleResult !== null;
  const validationLevel = hasGoogleData
    ? googleResult!.address.validation_level
    : zipValid
      ? "LOCALITY"
      : "UNKNOWN";
  const isAddressValid = hasGoogleData ? googleResult!.address.is_valid : zipValid;

  const suggestedCorrect = zipMatch
    ? null
    : googlePostalCode
      ? formatZipcode(googlePostalCode)
      : null;

  // Determine source
  let source: Source = "live";
  if (hasValidGoogleKey) {
    if (googleResult && zipResult) {
      const gSource = googleResult.source || "live";
      const zSource = zipResult.source || "live";
      source = (gSource === "cache" && zSource === "cache") ? "cache" : "live";
    } else if (googleResult) {
      source = (googleResult.source as Source) || "live";
    } else if (zipResult) {
      source = (zipResult.source as Source) || "live";
    }
  } else {
    if (zipResult) {
      source = (zipResult.source as Source) || "live";
    }
  }

  // Reattach room number to validated result
  const jaAddress = googleResult?.address.japanese_address ?? (isAddressValid ? baseAddress : rawAddress);
  const enAddress = googleResult?.address.english_address ?? (isAddressValid ? baseAddress : rawAddress);
  const finalJa = isAddressValid && room ? `${jaAddress} ${room}` : jaAddress;
  const finalEn = isAddressValid && room ? `${enAddress} ${room}` : enAddress;

  // Verdict for shipment readiness
  const verdictMap: Record<string, { level: string; message: string }> = {
    "SUB_PREMISE":  { level: "reliable",   message: "地址精确到房间号，可用于寄递" },
    "PREMISE":      { level: "reliable",   message: "地址精确到门牌号，可用于寄递" },
    "STREET_ADDRESS":{level: "trusted",    message: "地址验证到街道级别，可用于寄递" },
    "ROUTE":        { level: "review",     message: "地址需核实，仅精确到道路级别" },
    "NEIGHBORHOOD":{ level: "review",     message: "地址需核实，仅精确到街区级别" },
    "LOCALITY":    { level: "unreliable", message: "地址需核实，仅精确到城市级别" },
    "OTHER":        { level: "unreliable", message: "地址无法精确匹配，需人工核实" },
    "UNKNOWN":     { level: "unreliable", message: "地址验证失败，需人工核实" },
  };
  const verdict = verdictMap[validationLevel] || { level: "unreliable", message: "未知" };

  return {
    address: {
      is_valid: isAddressValid,
      validation_level: validationLevel,
      verdict_level: verdict.level,
      verdict_message: verdict.message,
      japanese_address: finalJa,
      english_address: finalEn,
    },
    zipcode: {
      match: zipMatch,
      provided: providedZipcode,
      suggested_correct: suggestedCorrect,
    },
    source,
  };
}
