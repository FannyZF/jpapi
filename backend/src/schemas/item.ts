import { z } from "zod";

export const itemCleanseRequestSchema = z.object({
  order_id: z.string().optional(),
  raw_description: z.string().min(1, "raw_description is required"),
  hs_code: z.string().min(1, "hs_code is required"),
  declared_value_jpy: z.number().positive(),
});

export const complianceWarningSchema = z.object({
  level: z.enum(["passed", "warning", "restricted", "blocked"]),
  check: z.string(),
  category: z.string().optional(),
  source: z.string().optional(),
  matched_keywords: z.array(z.string()).optional(),
  message: z.string(),
});

export const complianceResultSchema = z.object({
  passed: z.boolean(),
  warnings: z.array(complianceWarningSchema),
});

export const itemResultSchema = z.object({
  raw_description: z.string(),
  cleansed_description: z.string(),
  hs_code: z.string(),
  hs_code_valid: z.boolean(),
  hs_code_description: z.string().nullable(),
  declared_value_jpy: z.number(),
  value_assessment: z.string(),
  suggested_description: z.string().nullable(),
});

export const itemCleanseResponseSchema = z.object({
  status: z.literal("success"),
  reference_id: z.string(),
  data: z.object({
    item: itemResultSchema,
    compliance: complianceResultSchema,
  }),
});

export type ItemCleanseRequest = z.infer<typeof itemCleanseRequestSchema>;
export type ItemCleanseResponse = z.infer<typeof itemCleanseResponseSchema>;
export type ItemResult = z.infer<typeof itemResultSchema>;
export type ComplianceWarning = z.infer<typeof complianceWarningSchema>;
export type ComplianceResult = z.infer<typeof complianceResultSchema>;
