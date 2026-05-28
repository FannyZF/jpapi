import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  GOOGLE_MAPS_API_KEY: z.string().min(1, "GOOGLE_MAPS_API_KEY is required"),
  YAHOO_CLIENT_ID: z.string().optional(),
  REDIS_URL: z.string().default(""),
  SQLITE_PATH: z.string().default("./data/cleanse_history.db"),
  PORT: z.coerce.number().int().positive().default(3000),
  KUROMOJI_DICT_PATH: z.string().default("node_modules/kuromoji/dict"),
  AUTH_BYPASS_LOCALHOST: z.string().default("false"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  QWEN_API_KEY: z.string().optional(),
  QWEN_MODEL: z.string().default("qwen-plus"),
  HUNYUAN_API_KEY: z.string().optional(),
  HUNYUAN_MODEL: z.string().default("hunyuan-turbo"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash-lite"),
  SIGNATURE_REQUIRED: z.string().default("true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(`[Config] ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
