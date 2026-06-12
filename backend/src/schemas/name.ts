import { z } from "zod";

export const nameCleanseRequestSchema = z.object({
  order_id: z.string().optional(),
  raw_name: z.string().min(1, "raw_name is required"),
});

export const nameResultSchema = z.object({
  original: z.string(),
  japanese_katakana: z.string(),
  japanese_kanji: z.string().nullable(),
  english_romaji: z.string(),
});

export const nameCleanseResponseSchema = z.object({
  status: z.literal("success"),
  reference_id: z.string(),
  data: z.object({
    name: nameResultSchema,
  }),
});

export type NameCleanseRequest = z.infer<typeof nameCleanseRequestSchema>;
export type NameCleanseResponse = z.infer<typeof nameCleanseResponseSchema>;
export type NameResult = z.infer<typeof nameResultSchema>;
