import fs from "fs";
import path from "path";
import { validateHsCode, matchDescription, HsCodeMatchResult } from "./hsCode.service";

interface ComplianceRules {
  description_rules: {
    min_length: number;
    vague_terms: string[];
  };
  restricted_keywords: Record<
    string,
    {
      level: "blocked" | "restricted";
      category: string;
      source: string;
      keywords: string[];
    }
  >;
  value_rules: {
    low_multiplier: number;
    high_multiplier: number;
    absolute_min_jpy: number;
    suspicious_round_numbers: number[];
    default_ranges: Record<
      string,
      { min: number; max: number }
    >;
  };
}

export interface ComplianceWarning {
  level: "passed" | "warning" | "restricted" | "blocked";
  check: string;
  category?: string;
  source?: string;
  matched_keywords?: string[];
  message: string;
}

export interface ComplianceResult {
  passed: boolean;
  warnings: ComplianceWarning[];
  source?: "live" | "cache" | "fallback";
}

let rules: ComplianceRules | null = null;

function loadRules(): ComplianceRules {
  if (rules) return rules;
  const rulesPath = path.resolve(__dirname, "../../data/compliance_rules.json");
  const raw = fs.readFileSync(rulesPath, "utf-8");
  rules = JSON.parse(raw) as ComplianceRules;
  return rules;
}

export function checkDescriptionQuality(
  description: string
): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = [];
  const r = loadRules();
  const lower = description.toLowerCase();

  if (lower.length < r.description_rules.min_length) {
    warnings.push({
      level: "warning",
      check: "description_specificity",
      message: `品名过短（${lower.length}字符），请提供更详细的描述`,
    });
    return warnings;
  }

  const matchedVague: string[] = [];
  for (const term of r.description_rules.vague_terms) {
    if (lower === term) {
      matchedVague.push(term);
    }
  }

  if (matchedVague.length > 0) {
    warnings.push({
      level: "warning",
      check: "description_specificity",
      message: `品名仅包含模糊词 '${matchedVague.join(", ")}'，建议补充材质、品牌、功能等信息`,
    });
  }

  const vaguePartial = r.description_rules.vague_terms.filter(
    (t) => t.length > 3 && lower.includes(t)
  );
  if (vaguePartial.length > 0 && matchedVague.length === 0) {
    warnings.push({
      level: "warning",
      check: "description_specificity",
      message: `品名包含模糊词 '${vaguePartial.join(", ")}'，建议具体化`,
    });
  }

  return warnings;
}

export async function checkHsCodeMatch(
  hsCode: string,
  description: string,
  matchResult?: HsCodeMatchResult
): Promise<ComplianceWarning[]> {
  const warnings: ComplianceWarning[] = [];
  const result = matchResult || await matchDescription(hsCode, description);

  if (result.confidence === "mismatch") {
    warnings.push({
      level: "warning",
      check: "hs_code_match",
      message: `${result.detail}`,
    });
    if (result.suggestions.length > 0) {
      const suggestionText = result.suggestions
        .map((c) => `${c.code} (${Math.round(c.confidence * 100)}%)`)
        .join(", ");
      warnings.push({
        level: "warning",
        check: "hs_code_match",
        message: `建议 HS Code: ${suggestionText}`,
      });
    }
  } else if (result.confidence === "partial") {
    warnings.push({
      level: "warning",
      check: "hs_code_match",
      message: result.detail,
    });
  } else if (result.confidence === "unknown") {
    warnings.push({
      level: "warning",
      check: "hs_code_match",
      message: result.detail,
    });
  }

  return warnings;
}

export function checkRestrictedItems(
  description: string
): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = [];
  const r = loadRules();
  const lower = description.toLowerCase();

  for (const [key, rule] of Object.entries(r.restricted_keywords)) {
    const matchedKeywords: string[] = [];
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
    }
    if (matchedKeywords.length > 0) {
      if (rule.level === "blocked") {
        warnings.push({
          level: "blocked",
          check: "restricted_items",
          category: rule.category,
          source: rule.source,
          matched_keywords: matchedKeywords,
          message: `品名命中风险关键词 '${matchedKeywords.join(", ")}'（${rule.category}），建议开箱核对实物后再做进一步处理`,
        });
      } else {
        warnings.push({
          level: "restricted",
          check: "restricted_items",
          category: rule.category,
          source: rule.source,
          matched_keywords: matchedKeywords,
          message: `品名命中管制品关键词 '${matchedKeywords.join(", ")}'（${rule.category}），请确认是否需要特殊许可`,
        });
      }
    }
  }

  return warnings;
}

export function checkValueReasonability(
  hsCode: string,
  value: number
): {
  assessment: string;
  warnings: ComplianceWarning[];
} {
  const warnings: ComplianceWarning[] = [];
  const r = loadRules();
  let assessment = "reasonable";

  const chapter = hsCode.replace(/[.\-\s]/g, "").substring(0, 2);
  const chapterNum = parseInt(chapter, 10);

  let range: { min: number; max: number };
  if (chapterNum >= 84 && chapterNum <= 85) {
    range = r.value_rules.default_ranges["electronics"];
  } else if (chapterNum >= 61 && chapterNum <= 67) {
    range = r.value_rules.default_ranges["clothing"];
  } else if (chapterNum >= 84 && chapterNum <= 92) {
    range = r.value_rules.default_ranges["mechanical"];
  } else if (chapterNum >= 28 && chapterNum <= 38) {
    range = r.value_rules.default_ranges["chemical"];
  } else if (chapterNum >= 1 && chapterNum <= 24) {
    range = r.value_rules.default_ranges["food"];
  } else if (chapterNum >= 94 && chapterNum <= 96) {
    range = r.value_rules.default_ranges["toys"];
  } else if (chapterNum >= 72 && chapterNum <= 83) {
    range = r.value_rules.default_ranges["metal"];
  } else if (chapterNum >= 39 && chapterNum <= 40) {
    range = r.value_rules.default_ranges["plastic"];
  } else if (chapterNum >= 50 && chapterNum <= 60) {
    range = r.value_rules.default_ranges["textile"];
  } else if (chapterNum >= 47 && chapterNum <= 49) {
    range = r.value_rules.default_ranges["paper"];
  } else if (chapterNum >= 68 && chapterNum <= 70) {
    range = r.value_rules.default_ranges["ceramic"];
  } else {
    range = r.value_rules.default_ranges["default"];
  }

  if (value <= r.value_rules.absolute_min_jpy) {
    assessment = "suspicious";
    warnings.push({
      level: "warning",
      check: "value_reasonability",
      message: `申报价格 ¥${value} 异常，请核实`,
    });
  }

  const lowThreshold = range.min * r.value_rules.low_multiplier;
  const highThreshold = range.max * r.value_rules.high_multiplier;

  if (value < lowThreshold && value > r.value_rules.absolute_min_jpy) {
    assessment = "low";
    warnings.push({
      level: "warning",
      check: "value_reasonability",
      message: `申报价格 ¥${value.toLocaleString()} 偏低（HS ${chapter} 类目参考区间 ¥${range.min.toLocaleString()} - ¥${range.max.toLocaleString()}）`,
    });
  } else if (value > highThreshold) {
    assessment = "high";
    warnings.push({
      level: "warning",
      check: "value_reasonability",
      message: `申报价格 ¥${value.toLocaleString()} 偏高（HS ${chapter} 类目参考区间 ¥${range.min.toLocaleString()} - ¥${range.max.toLocaleString()}）`,
    });
  }

  return { assessment, warnings };
}

export async function runComplianceCheck(
  hsCode: string,
  description: string,
  declaredValueJpy: number
): Promise<ComplianceResult> {
  const allWarnings: ComplianceWarning[] = [];

  allWarnings.push(...checkDescriptionQuality(description));
  const matchResult = await matchDescription(hsCode, description);
  allWarnings.push(...(await checkHsCodeMatch(hsCode, description, matchResult)));

  const hsValidation = validateHsCode(hsCode);
  if (hsValidation.valid) {
    allWarnings.push({
      level: "passed",
      check: "hs_code_validity",
      message: "HS Code 格式有效",
    });
  } else if (hsValidation.format_valid) {
    allWarnings.push({
      level: "warning",
      check: "hs_code_validity",
      message: `HS Code ${hsCode} 格式有效但未在数据库中查到`,
    });
  } else {
    allWarnings.push({
      level: "warning",
      check: "hs_code_validity",
      message: `HS Code ${hsCode} 格式无效`,
    });
  }

  const { assessment, warnings: valueWarnings } = checkValueReasonability(
    hsCode,
    declaredValueJpy
  );
  allWarnings.push(...valueWarnings);

  allWarnings.push(...checkRestrictedItems(description));

  if (assessment === "reasonable" && !valueWarnings.length) {
    allWarnings.push({
      level: "passed",
      check: "value_reasonability",
      message: "申报价格在合理范围内",
    });
  }

  const hasIssues = allWarnings.some((w) => w.level !== "passed");

  return {
    passed: !hasIssues,
    warnings: allWarnings,
  };
}
