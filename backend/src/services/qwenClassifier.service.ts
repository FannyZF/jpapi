import axios from "axios";
import { getCredential } from "./cache";
import { config } from "../core/config";
import type { StructuredAttributes } from "./llmClassifier.service";

const API_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";

export async function classifyWithQwen(
  description: string
): Promise<{
  candidates: any[];
  extracted_keywords: string[];
  structured_attributes?: StructuredAttributes;
  suggested_name_cn?: string;
  suggested_name_en?: string;
  needsReview: boolean;
  tokens_used: number;
} | null> {
  const key = await getCredential("QWEN_API_KEY");
  if (!key || key.length < 20) return null;

  try {
    const response = await axios.post(
      `${API_BASE}/chat/completions`,
      {
        model: config.QWEN_MODEL || "qwen-plus",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Classify this product for HS code: "${description}"` },
        ],
        temperature: 0.1,
        max_tokens: 800,
      },
      {
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        timeout: 12000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const tokensUsed = response.data?.usage?.total_tokens || 0;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    const sa = parsed.structured_attributes;

    return {
      extracted_keywords: parsed.extracted_keywords || [],
      structured_attributes: sa ? {
        core_product_cn: sa.core_product_cn || null, core_product_en: sa.core_product_en || null,
        material_cn: sa.material_cn || null, material_en: sa.material_en || null,
        function_cn: sa.function_cn || null, function_en: sa.function_en || null,
        composition_cn: sa.composition_cn || null, composition_en: sa.composition_en || null,
        processing_cn: sa.processing_cn || null, processing_en: sa.processing_en || null,
        structure_cn: sa.structure_cn || null, structure_en: sa.structure_en || null,
        technical_cn: sa.technical_cn || null, technical_en: sa.technical_en || null,
      } : undefined,
      suggested_name_cn: parsed.suggested_name_cn,
      suggested_name_en: parsed.suggested_name_en,
      candidates: (parsed.candidates || []).slice(0, 3).map((c: any) => ({
        code: c.code, description: c.description, description_cn: c.description_cn || c.description,
        confidence: c.confidence, reasoning: c.reasoning, matched_keywords: c.matched_keywords || [],
      })),
      needsReview: parsed.needsReview ?? true,
      tokens_used: tokensUsed,
    };
  } catch { return null; }
}

const SYSTEM_PROMPT = `You are an HS code classification expert. Output ONLY valid JSON, no markdown:
{"extracted_keywords":["laptop","computer"],"structured_attributes":{"core_product_cn":"","core_product_en":"","material_cn":null,"material_en":null,"function_cn":null,"function_en":null,"composition_cn":null,"composition_en":null,"processing_cn":null,"processing_en":null,"structure_cn":null,"structure_en":null,"technical_cn":null,"technical_en":null},"suggested_name_cn":"","suggested_name_en":"","candidates":[{"code":"84713000","description":"","description_cn":"","confidence":0.95,"matched_keywords":["laptop"],"reasoning":""}],"needsReview":false}

Rules: core_product determines HS chapter (REQUIRED). Confidence: 0.85-0.95 exact, 0.70-0.85 strong, 0.50-0.70 likely. Prefer 8-digit codes. needsReview true only if no candidate>=0.65`;
