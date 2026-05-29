// US Compliance Service — prohibited goods, PO Box, carrier restrictions
import { lookupHsCode } from "./hsCode.service";

interface ComplianceWarning {
  level: "passed" | "warning" | "restricted" | "blocked";
  check: string;
  message: string;
}

interface CarrierRestrictions {
  usps: string[];
  fedex: string[];
  ups: string[];
}

const US_PROHIBITED_PATTERNS: { pattern: RegExp; message: string }[] = [
  { pattern: /\b(weapon|gun|firearm|ammunition|rifle|pistol|revolver|explosive|dynamite|firework)\b/i, message: "武器/弹药/爆炸物：禁止运输" },
  { pattern: /\b(drug|narcotic|cocaine|heroin|marijuana|cannabis|methamphetamine|opioid|fentanyl)\b/i, message: "毒品/管制物质：禁止运输" },
  { pattern: /\b(counterfeit|fake|replica)\b/i, message: "仿冒品：涉及知识产权侵权，禁止进口" },
  { pattern: /\b(hazardous waste|radioactive|nuclear)\b/i, message: "危险/放射性废物：禁止运输" },
];

const US_RESTRICTED_PATTERNS: { pattern: RegExp; message: string }[] = [
  { pattern: /\b(lithium|li-ion|li-poly|battery|accumulator)\b/i, message: "锂电池：需符合UN38.3检测，限量运输" },
  { pattern: /\b(alcohol|liquor|whisky|vodka|wine|beer|spirit)\b/i, message: "酒精饮料：需符合各州法规，可能受限" },
  { pattern: /\b(medicine|drug|pharmaceutical|prescription|tablet|capsule|pill|vitamin|supplement)\b/i, message: "药品/保健品：需FDA批准，进口受限" },
  { pattern: /\b(perfume|fragrance|cologne|nail polish|aerosol|spray)\b/i, message: "含易燃成分：航空运输受限" },
  { pattern: /\b(tobacco|cigarette|cigar|vape|e-cigarette|nicotine)\b/i, message: "烟草/电子烟：进口受严格管制" },
  { pattern: /\b(food|meat|dairy|milk|egg|fruit|vegetable|plant|seed|soil)\b/i, message: "食品/农产品：需FDA/USDA检疫许可" },
];

export function checkUSProhibited(description: string): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = [];
  for (const p of US_PROHIBITED_PATTERNS) {
    if (p.pattern.test(description)) {
      return [{ level: "blocked", check: "prohibited_goods", message: p.message }];
    }
  }
  for (const p of US_RESTRICTED_PATTERNS) {
    if (p.pattern.test(description)) {
      warnings.push({ level: "restricted", check: "restricted_goods", message: p.message });
    }
  }
  return warnings;
}

export function checkPOBox(address: string): ComplianceWarning | null {
  if (/\b(P\.?\s*O\.?\s*Box|Post\s*Office\s*Box|PO\s*Box)\b/i.test(address)) {
    return {
      level: "warning",
      check: "po_box_address",
      message: "PO Box地址：FedEx/UPS不投递PO Box，USPS限定服务",
    };
  }
  return null;
}

export function checkCarrierLimits(
  weightLbs: number,
  lengthIn: number,
  widthIn: number,
  heightIn: number
): { warnings: ComplianceWarning[]; restrictions: CarrierRestrictions } {
  const warnings: ComplianceWarning[] = [];
  const girth = lengthIn + 2 * widthIn + 2 * heightIn;

  const restrictions: CarrierRestrictions = { usps: [], fedex: [], ups: [] };

  // USPS limits
  if (weightLbs > 70 || girth > 130) {
    restrictions.usps.push(`超出USPS限制(70lbs/130"围长)，当前:${weightLbs}lbs/${girth}"`);
  }
  // FedEx limits
  if (weightLbs > 150 || girth > 165) {
    restrictions.fedex.push(`超出FedEx限制(150lbs/165"围长)，当前:${weightLbs}lbs/${girth}"`);
  }
  // UPS limits
  if (weightLbs > 150 || girth > 165) {
    restrictions.ups.push(`超出UPS限制(150lbs/165"围长)，当前:${weightLbs}lbs/${girth}"`);
  }

  if (restrictions.usps.length || restrictions.fedex.length || restrictions.ups.length) {
    warnings.push({
      level: "warning",
      check: "carrier_limits",
      message: "包裹超出承运商尺寸/重量限制，详见 carrier_restrictions 字段",
    });
  }

  return { warnings, restrictions };
}

export function hasUsAccess(user: { countries?: string[] } | undefined | null): boolean {
  if (!user) return false;
  return (user.countries || []).includes("us");
}

// Simple HS code validation for US
export function validateUsHscode(code: string): { valid: boolean; description: string | null } {
  const hs = lookupHsCode(code);
  if (!hs) return { valid: false, description: null };
  return { valid: true, description: hs.description };
}
