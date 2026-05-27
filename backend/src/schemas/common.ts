import { z } from "zod";

export const sourceEnum = z.enum(["live", "cache", "fallback"]);
export type Source = z.infer<typeof sourceEnum>;

export const operationTypeEnum = z.enum([
  "address",
  "name",
  "item",
]);
export type OperationType = z.infer<typeof operationTypeEnum>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const historyFilterSchema = z.object({
  operation_type: operationTypeEnum.optional(),
  order_id: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});
