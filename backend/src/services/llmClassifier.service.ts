import axios from "axios";
import { getCredential } from "./cache";
import { config } from "../core/config";

const API_BASE = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";

export interface LlmCandidate {
  code: string;
  description: string;
  description_cn: string;
  confidence: number;
  reasoning: string;
  matched_keywords: string[];
}

export interface StructuredAttributes {
  core_product_cn: string | null;
  core_product_en: string | null;
  material_cn: string | null;
  material_en: string | null;
  function_cn: string | null;
  function_en: string | null;
  composition_cn: string | null;
  composition_en: string | null;
  processing_cn: string | null;
  processing_en: string | null;
  structure_cn: string | null;
  structure_en: string | null;
  technical_cn: string | null;
  technical_en: string | null;
}

interface LlmClassificationResult {
  candidates: LlmCandidate[];
  extracted_keywords: string[];
  structured_attributes?: StructuredAttributes;
  suggested_name_cn?: string;
  suggested_name_en?: string;
  needsReview: boolean;
  tokens_used: number;
}

const cache = new Map<string, LlmClassificationResult>();

function cacheKey(description: string): string {
  return `llm:${description.toLowerCase().trim()}`;
}

function getFromCache(description: string): LlmClassificationResult | null {
  return cache.get(cacheKey(description)) || null;
}

function setCache(description: string, result: LlmClassificationResult): void {
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(cacheKey(description), result);
}

const SYSTEM_PROMPT = `You are an HS code classification expert. Output ONLY valid JSON, no markdown:
{"extracted_keywords":["laptop","computer"],"structured_attributes":{"core_product_cn":"","core_product_en":"","material_cn":null,"material_en":null,"function_cn":null,"function_en":null,"composition_cn":null,"composition_en":null,"processing_cn":null,"processing_en":null,"structure_cn":null,"structure_en":null,"technical_cn":null,"technical_en":null},"suggested_name_cn":"","suggested_name_en":"","candidates":[{"code":"84713000","description":"","description_cn":"","confidence":0.95,"matched_keywords":["laptop"],"reasoning":""}],"needsReview":false}

Rules:
- core_product: what the product IS (Chinese+English). Required. Determines HS chapter.
- material: physical material, null if N/A.
- function: what it does, null if N/A.
- composition: percentages, null if N/A.
- processing: how made, null if N/A.
- structure: form/shape, null if N/A.
- technical: specs, null if N/A.
- suggested_name_cn/en: concise product names.
- candidates: 1-3 HS codes, 8-digit preferred.
- confidence: 0.85-0.95 exact, 0.70-0.85 strong, 0.50-0.70 likely.
- extracted_keywords: 3-8 English keywords for HS matching.
- matched_keywords: which keywords matched each candidate.
- needsReview: true only if no candidate>=0.65`;


export async function classifyWithLlm(
  description: string
): Promise<LlmClassificationResult | null> {
  const key = await getCredential("DEEPSEEK_API_KEY");
  if (!key || key.startsWith("sk-your") || key.length < 20) {
    return null;
  }

  const cached = getFromCache(description);
  if (cached) return cached;

  try {
    const response = await axios.post(
      `${API_BASE}/chat/completions`,
      {
        model: config.DEEPSEEK_MODEL || DEFAULT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Classify this product for HS code: "${description}"` },
        ],
        temperature: 0.1,
        max_tokens: 800,
      },
      {
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const tokensUsed = response.data?.usage?.total_tokens || 0;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    const sa = parsed.structured_attributes;
    const result: LlmClassificationResult = {
      extracted_keywords: parsed.extracted_keywords || [],
      structured_attributes: sa ? {
        core_product_cn: sa.core_product_cn || null,
        core_product_en: sa.core_product_en || null,
        material_cn: sa.material_cn || null,
        material_en: sa.material_en || null,
        function_cn: sa.function_cn || null,
        function_en: sa.function_en || null,
        composition_cn: sa.composition_cn || null,
        composition_en: sa.composition_en || null,
        processing_cn: sa.processing_cn || null,
        processing_en: sa.processing_en || null,
        structure_cn: sa.structure_cn || null,
        structure_en: sa.structure_en || null,
        technical_cn: sa.technical_cn || null,
        technical_en: sa.technical_en || null,
      } : undefined,
      suggested_name_cn: parsed.suggested_name_cn,
      suggested_name_en: parsed.suggested_name_en,
      candidates: (parsed.candidates || []).slice(0, 3).map((c: any) => ({
        code: c.code,
        description: c.description,
        description_cn: c.description_cn || c.description,
        confidence: c.confidence,
        reasoning: c.reasoning,
        matched_keywords: c.matched_keywords || [],
      })),
      needsReview: parsed.needsReview ?? true, tokens_used: tokensUsed };

    setCache(description, result);
    return result;
  } catch {
    return null;
  }
}
