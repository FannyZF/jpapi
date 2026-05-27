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

export async function cleanseAddress(
  orderId: string,
  rawAddress: string,
  providedZipcode: string
): Promise<AddressServiceResult> {
  const normalizedProvided = providedZipcode.replace(/[\s\-]/g, "");

  const zipResult = await fetchZipCloud(providedZipcode);
  const zipValid = zipResult !== null;

  const googleKey = await getCredential("GOOGLE_MAPS_API_KEY");
  const hasValidGoogleKey = !isPlaceholderKey(googleKey);

  let googleResult = null;
  if (hasValidGoogleKey) {
    googleResult = await fetchGoogleMaps(rawAddress, providedZipcode);
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

  return {
    address: {
      is_valid: isAddressValid,
      validation_level: validationLevel,
      japanese_address: googleResult?.address.japanese_address ?? rawAddress,
      english_address: googleResult?.address.english_address ?? rawAddress,
    },
    zipcode: {
      match: zipMatch,
      provided: providedZipcode,
      suggested_correct: suggestedCorrect,
    },
    source,
  };
}
