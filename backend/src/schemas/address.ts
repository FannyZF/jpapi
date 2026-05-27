import { z } from "zod";

export const addressCleanseRequestSchema = z.object({
  order_id: z.string().optional(),
  raw_address: z.string().min(1, "raw_address is required"),
  provided_zipcode: z
    .string()
    .min(1, "provided_zipcode is required")
    .transform((v) => v.replace(/\s/g, "")),
});

export const addressResultSchema = z.object({
  is_valid: z.boolean(),
  validation_level: z.string(),
  japanese_address: z.string(),
  english_address: z.string(),
});

export const zipcodeResultSchema = z.object({
  match: z.boolean(),
  provided: z.string(),
  suggested_correct: z.string().nullable(),
});

export const addressCleanseResponseSchema = z.object({
  status: z.literal("success"),
  reference_id: z.string(),
  data: z.object({
    address: addressResultSchema,
    zipcode: zipcodeResultSchema,
  }),
});

export type AddressCleanseRequest = z.infer<typeof addressCleanseRequestSchema>;
export type AddressCleanseResponse = z.infer<
  typeof addressCleanseResponseSchema
>;
export type AddressResult = z.infer<typeof addressResultSchema>;
export type ZipcodeResult = z.infer<typeof zipcodeResultSchema>;
