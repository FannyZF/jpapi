import { validateHsCode, matchDescription, lookupHsCode } from "./hsCode.service";
import { runComplianceCheck, checkValueReasonability, type ComplianceResult } from "./compliance.service";

export interface CleanseItemResult {
  raw_description: string;
  cleansed_description: string;
  hs_code: string;
  hs_code_valid: boolean;
  hs_code_description: string | null;
  declared_value_jpy: number;
  value_assessment: string;
  suggested_description: string | null;
}

type Source = "live" | "cache" | "fallback";

export interface ItemServiceResult {
  item: CleanseItemResult;
  compliance: ComplianceResult;
  source: Source;
}

export async function cleanseItem(
  _orderId: string,
  rawDescription: string,
  hsCode: string,
  declaredValueJpy: number
): Promise<ItemServiceResult> {
  const hsValidation = validateHsCode(hsCode);
  const hsEntry = lookupHsCode(hsCode);

  const { assessment } = checkValueReasonability(hsCode, declaredValueJpy);

  const compliance = await runComplianceCheck(hsCode, rawDescription, declaredValueJpy);

  const suggestedDesc =
    compliance.warnings.length > 0
      ? compliance.warnings.find(
          (w) => w.check === "hs_code_match" && w.message
        )?.message || null
      : null;

  return {
    item: {
      raw_description: rawDescription,
      cleansed_description: rawDescription,
      hs_code: hsCode,
      hs_code_valid: hsValidation.valid,
      hs_code_description: hsEntry?.description || hsValidation.description || null,
      declared_value_jpy: declaredValueJpy,
      value_assessment: assessment,
      suggested_description: hsEntry?.description || hsValidation.description || null,
    },
    compliance,
    source: compliance.source || "live",
  };
}
