import { Router, Request, Response } from "express";
import { ZodError } from "zod";
import { z } from "zod";
import crypto from "crypto";
import { suggestHsCodes, extractKeywords } from "../../services/hsCode.service";
import { classifyConsensus } from "../../services/consensus.service";
import { deliverWebhook } from "../../services/webhook.service";
import { createTask } from "../../services/taskManager.service";
import { updateApiCallTokens } from "../../services/billingStore";
import type { User } from "../../services/userStore";
import type { StructuredAttributes } from "../../services/llmClassifier.service";

const router = Router();

const classifyRequestSchema = z.object({
  raw_description: z.string().min(1, "raw_description is required"),
  hs_code: z.string().optional(),
});

const batchClassifySchema = z.object({
  items: z.array(classifyRequestSchema).min(1).max(100),
});

const pendingLLM = new Map<string, any>();

function fallbackStructuredAttributes(raw: string): StructuredAttributes {
  const hasCN = /[\u4e00-\u9fff]/.test(raw);
  const pick = (map: Record<string, string>, raw: string): string | null => {
    for (const [cn, en] of Object.entries(map)) { if (raw.includes(cn)) return en; }
    return null;
  };
  const materialMap: Record<string, string> = {
    "纯棉": "100%棉 (100% Cotton)", "棉": "棉 (Cotton)", "真丝": "100%丝 (100% Silk)",
    "皮革": "皮革 (Leather)", "不锈钢": "304不锈钢 (Stainless Steel)",
    "涤纶": "涤纶 (Polyester)", "尼龙": "尼龙 (Nylon)", "无纺布": "无纺布 (Non-woven)",
  };
  const materialCN = hasCN ? pick(materialMap, raw) : null;
  const functionMap: Record<string, string> = {
    "上衣": "上衣 (Top/Blouse)", "衬衫": "衬衫 (Shirt)", "裤子": "裤子 (Trousers)",
    "裙": "裙 (Skirt)", "外套": "外套 (Jacket)", "毛衣": "毛衣 (Sweater)",
    "T恤": "T恤 (T-Shirt)", "鞋": "鞋 (Shoes)", "手机": "手机 (Phone)",
    "电脑": "电脑 (Computer)", "笔记本": "笔记本 (Laptop)", "耳机": "耳机 (Headphones)",
    "音箱": "音箱 (Speaker)", "相机": "相机 (Camera)", "玩具": "玩具 (Toy)",
    "家具": "家具 (Furniture)", "拖把": "地面清洁工具 (Floor Mop)",
    "包": "包袋 (Bag)", "手表": "手表 (Watch)", "工具": "工具 (Tool)",
  };
  const functionCN = hasCN ? pick(functionMap, raw) : null;
  return {
    core_product_cn: functionCN, core_product_en: functionCN ? functionCN.match(/\(([^)]+)\)/)?.[1] || functionCN : null,
    material_cn: materialCN, material_en: materialCN ? materialCN.match(/\(([^)]+)\)/)?.[1] || materialCN : null,
    function_cn: null, function_en: null,
    composition_cn: null, composition_en: null,
    processing_cn: null, processing_en: null,
    structure_cn: null, structure_en: null,
    technical_cn: null, technical_en: null,
  };
}

router.get("/classify/result/:id", async (req: Request, res: Response) => {
  const user = (req as any).user as User | undefined;
  const isAdmin = user?.permissions?.includes("admin");
  const result = pendingLLM.get(req.params.id);
  if (result !== undefined) {
    pendingLLM.delete(req.params.id);
    if (isAdmin) {
      return res.json({ status: "ready", data: result });
    }
    // Simplified for external users
    return res.json({
      status: "ready",
      data: {
        suggested_name: result.suggested_name_cn || result.suggested_name_en || "",
        hs_code: result.hs_code || null,
        description: result.description_cn || result.description_en || null,
        confidence: result.confidence || 0,
      }
    });
  }
  // Try task manager (webhook mode)
  const { getTask } = await import("../../services/taskManager.service");
  const task = await getTask(req.params.id);
  if (task) {
    if (isAdmin) {
      return res.json({ status: "ready", data: task });
    }
    return res.json({
      status: "ready",
      data: {
        suggested_name: task.suggested_name_cn || task.suggested_name_en || "",
        hs_code: task.hs_code || null,
        description: task.description_cn || task.description_en || null,
        confidence: task.confidence || 0,
      }
    });
  }
  res.json({ status: "pending" });
});

// Reusable classify logic for single + batch
async function classifyOneProduct(
  parsed: { raw_description: string; hs_code?: string },
  user?: User
): Promise<any> {
  const { raw_description } = parsed;
  const brandMatch = raw_description.match(/([A-Za-z0-9]+)\s*牌/);
  const brand = brandMatch ? brandMatch[1] : null;
  const cleanDesc = brand ? raw_description.replace(/[A-Za-z0-9]+\s*牌/g, "").trim() : raw_description;

  const keywords = extractKeywords(raw_description);
  const candidates = await suggestHsCodes(raw_description);
  const best = candidates[0];
  const initialAttrs = fallbackStructuredAttributes(cleanDesc);
  const taskId = crypto.randomUUID();

  const useWebhook = user?.webhook_enabled === 1 && user?.webhook_url;
  const isAdmin = user?.permissions?.includes("admin");

  const result: any = {
    status: "success",
    task_id: taskId,
  };

  if (isAdmin) {
    Object.assign(result, {
      cached: false,
      poll_id: taskId,
      mode: useWebhook ? "webhook" : "poll",
      structured_attributes: initialAttrs,
      suggested_name_cn: cleanDesc.substring(0, 40),
      suggested_name_en: cleanDesc.substring(0, 80),
      tokens_used: 0,
      extracted_keywords: keywords,
      candidates,
      best_guess: best ? { hs_code: best.code, description_en: best.description, description_cn: best.description_cn || best.description, confidence: best.confidence, matched_keywords: best.matched_keywords || [] } : null,
      consensus: { agreed: false, primary_model: "local", both_available: false, deepseek_top_code: null, qwen_top_code: null },
    });
    if (useWebhook) result.webhook_status = "pending";
  } else {
    // External user: simplified response
    const isChineseInput = /[\u4e00-\u9fff]/.test(raw_description);
    if (useWebhook) {
      // Webhook mode: no immediate result, only acknowledgment
      result.mode = "webhook";
      result.webhook_status = "pending";
      result.message = "Result will be delivered to your webhook URL";
    } else {
      // Poll mode: return immediate keyword match
      result.mode = "poll";
      result.poll_id = taskId;
      result.suggested_name = isChineseInput ? cleanDesc.substring(0, 40) : cleanDesc.substring(0, 80);
      if (best) {
        result.hs_code = best.code;
        result.description = isChineseInput ? (best.description_cn || best.description) : best.description;
        result.confidence = best.confidence;
      } else {
        result.hs_code = null;
        result.description = null;
        result.confidence = 0;
      }
    }
  }

  // Async LLM
  classifyConsensus(cleanDesc).then(async (llmResult) => {
    const isChineseInput = /[\u4e00-\u9fff]/.test(raw_description);
    const output: any = { task_id: taskId, status: "completed" };

    if (isAdmin) {
      Object.assign(output, {
        structured_attributes: llmResult?.structured_attributes || null,
        suggested_name_cn: brand ? `${brand}牌` + (llmResult?.suggested_name_cn || "") : (llmResult?.suggested_name_cn || cleanDesc),
        suggested_name_en: brand ? brand + " " + (llmResult?.suggested_name_en || "") : (llmResult?.suggested_name_en || cleanDesc),
        tokens_used: llmResult?.tokens_used || 0,
        consensus: llmResult?.consensus || null,
        candidates: llmResult?.candidates || [],
        extracted_keywords: keywords,
      });
      if (llmResult?.candidates[0]) {
        const top = llmResult.candidates[0];
        output.hs_code = top.code;
        output.confidence = top.confidence;
        output.description_en = top.description;
        output.description_cn = top.description_cn;
      }
    } else {
      const top = llmResult?.candidates?.[0] || best;
      if (top) {
        output.hs_code = "code" in top ? (top as any).code : (top as any).hs_code;
        output.confidence = "confidence" in top ? (top as any).confidence : (best?.confidence || 0);
        output.description = isChineseInput
          ? ((top as any).description_cn || (top as any).description || "")
          : ((top as any).description_en || (top as any).description || "");
        output.suggested_name = llmResult?.suggested_name_cn && isChineseInput
          ? (brand ? `${brand}牌` + llmResult.suggested_name_cn : llmResult.suggested_name_cn)
          : llmResult?.suggested_name_en
            ? (brand ? brand + " " + llmResult.suggested_name_en : llmResult.suggested_name_en)
            : (isChineseInput ? cleanDesc.substring(0, 40) : cleanDesc.substring(0, 80));
      }
    }

    try {
      const DB = require("../../services/historyStore").getHistoryDb();
      const row = DB.prepare("SELECT id FROM api_call_logs WHERE operation_type='classify' ORDER BY created_at DESC LIMIT 1").get() as any;
      if (row) updateApiCallTokens(row.id, llmResult?.deepseek_tokens || 0, llmResult?.qwen_tokens || 0);
    } catch {}

    if (useWebhook && user) {
      await createTask(taskId, output);
      await deliverWebhook(user.webhook_url!, user.webhook_secret!, taskId, output);
    } else {
      pendingLLM.set(taskId, output);
    }
  });

  return result;
}

function handleClassifyError(err: unknown, res: Response): void {
  if (err instanceof ZodError) {
    res.status(400).json({ status: "error", message: "Validation failed", details: err.errors.map(e => ({ path: e.path.join("."), message: e.message })) });
    return;
  }
  res.status(500).json({ status: "error", message: "Classification failed", details: err instanceof Error ? err.message : String(err) });
}

router.post("/classify", async (req: Request, res: Response) => {
  try {
    // Auto-batch if body is an array
    if (Array.isArray(req.body)) {
      const safeItems = req.body.slice(0, 100);
      const user = (req as any).user as User | undefined;
      const results = await Promise.all(safeItems.map((item: any) => {
        const parsed = classifyRequestSchema.parse(item);
        return classifyOneProduct(parsed, user);
      }));
      return res.json({ status: "success", results });
    }

    const parsed = classifyRequestSchema.parse(req.body);
    const user = (req as any).user as User | undefined;
    const result = await classifyOneProduct(parsed, user);
    res.json(result);
  } catch (err) {
    handleClassifyError(err, res);
  }
});

router.post("/classify/batch", async (req: Request, res: Response) => {
  try {
    const parsed = batchClassifySchema.parse(req.body);
    const user = (req as any).user as User | undefined;
    const results = await Promise.all(parsed.items.map(item => classifyOneProduct(item, user)));
    res.json({ status: "success", results });
  } catch (err) {
    handleClassifyError(err, res);
  }
});

export default router;
