import { classifyWithLlm, type LlmCandidate } from "./llmClassifier.service";
import { classifyWithQwen } from "./qwenClassifier.service";
import type { StructuredAttributes } from "./llmClassifier.service";

export interface ConsensusResult {
  candidates: LlmCandidate[];
  structured_attributes?: StructuredAttributes;
  suggested_name_cn?: string;
  suggested_name_en?: string;
  tokens_used: number;
  deepseek_tokens: number;
  qwen_tokens: number;
  consensus: {
    agreed: boolean;
    primary_model: string;
    both_available: boolean;
    deepseek_top_code: string | null;
    qwen_top_code: string | null;
  };
}

export async function classifyConsensus(
  description: string
): Promise<ConsensusResult | null> {
  // Fast path: DeepSeek first
  const deepseekResult = await classifyWithLlm(description);
  const dsTokens = deepseekResult?.tokens_used || 0;
  let qwTokens = 0;

  const dsTop = deepseekResult?.candidates[0];
  if (dsTop && dsTop.confidence >= 0.75) {
    return {
      candidates: deepseekResult!.candidates,
      structured_attributes: deepseekResult!.structured_attributes,
      suggested_name_cn: deepseekResult!.suggested_name_cn,
      suggested_name_en: deepseekResult!.suggested_name_en,
      tokens_used: dsTokens, deepseek_tokens: dsTokens, qwen_tokens: 0,
      consensus: { agreed: false, primary_model: "deepseek", both_available: false, deepseek_top_code: dsTop.code?.substring(0, 6) || null, qwen_top_code: null },
    };
  }

  const qwenResult = await classifyWithQwen(description);
  qwTokens = qwenResult?.tokens_used || 0;
  const total = dsTokens + qwTokens;

  const dsAvailable = deepseekResult !== null;
  const qwAvailable = qwenResult !== null;
  if (!dsAvailable && !qwAvailable) return null;

  if (dsAvailable && !qwAvailable) {
    return {
      candidates: deepseekResult!.candidates,
      structured_attributes: deepseekResult!.structured_attributes,
      suggested_name_cn: deepseekResult!.suggested_name_cn,
      suggested_name_en: deepseekResult!.suggested_name_en,
      tokens_used: dsTokens, deepseek_tokens: dsTokens, qwen_tokens: 0,
      consensus: { agreed: false, primary_model: "deepseek", both_available: false, deepseek_top_code: dsTop?.code?.substring(0, 6) || null, qwen_top_code: null },
    };
  }

  if (!dsAvailable && qwAvailable) {
    const qwTop = qwenResult!.candidates[0];
    return {
      candidates: qwenResult!.candidates as LlmCandidate[],
      structured_attributes: qwenResult!.structured_attributes,
      suggested_name_cn: qwenResult!.suggested_name_cn,
      suggested_name_en: qwenResult!.suggested_name_en,
      tokens_used: qwTokens, deepseek_tokens: 0, qwen_tokens: qwTokens,
      consensus: { agreed: false, primary_model: "qwen", both_available: false, deepseek_top_code: null, qwen_top_code: qwTop?.code?.substring(0, 6) || null },
    };
  }

  const qwTop = qwenResult!.candidates[0];
  const dsCode = dsTop?.code?.substring(0, 6) || null;
  const qwCode = qwTop?.code?.substring(0, 6) || null;
  const agreed = dsCode !== null && qwCode !== null && dsCode === qwCode;

  if (agreed && deepseekResult!.candidates.length > 0) {
    const boosted = deepseekResult!.candidates.map(c => ({ ...c, confidence: Math.min(c.confidence * 1.15, 1.0) }));
    return {
      candidates: boosted, structured_attributes: deepseekResult!.structured_attributes,
      suggested_name_cn: deepseekResult!.suggested_name_cn, suggested_name_en: deepseekResult!.suggested_name_en,
      tokens_used: total, deepseek_tokens: dsTokens, qwen_tokens: qwTokens,
      consensus: { agreed: true, primary_model: "deepseek+qwen", both_available: true, deepseek_top_code: dsCode, qwen_top_code: qwCode },
    };
  }

  return {
    candidates: deepseekResult!.candidates,
    structured_attributes: deepseekResult!.structured_attributes,
    suggested_name_cn: deepseekResult!.suggested_name_cn,
    suggested_name_en: deepseekResult!.suggested_name_en,
    tokens_used: total, deepseek_tokens: dsTokens, qwen_tokens: qwTokens,
    consensus: { agreed: false, primary_model: "deepseek", both_available: true, deepseek_top_code: dsCode, qwen_top_code: qwCode },
  };
}
