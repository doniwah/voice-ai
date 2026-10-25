import { z } from "zod";

/**
 * Server Configuration & Environment Schema.
 * Validates database and S3-compatible Object Storage credentials.
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // PostgreSQL Database Configuration
  DATABASE_URL: z.string().default("postgresql://soapi_user:soapi_secret@localhost:5432/soapi_db"),
  DB_POOL_MAX: z.coerce.number().default(20),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().default(5000),

  // S3-Compatible Object Storage Configuration
  S3_ENDPOINT: z
    .string()
    .default("http://localhost:9000")
    .transform((val) => {
      // Clean up endpoint: remove trailing slashes and bucket paths if accidentally attached
      return val.trim().replace(/\/+$/, "").replace(/(\.cloudflarestorage\.com)\/[^/]+$/, "$1");
    }),
  S3_REGION: z.string().default("ap-southeast-1"),
  S3_ACCESS_KEY_ID: z.string().default("test"),
  S3_SECRET_ACCESS_KEY: z.string().default("test"),
  S3_BUCKET_NAME: z.string().default("soapi-audio-recordings"),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((val) => val === "true" || val === "1"),

  // Security & Retention Settings
  PRESIGNED_URL_EXPIRES_SECONDS: z.coerce.number().default(900), // 15 minutes upload/download window
  AUDIO_AUTO_PURGE_HOURS: z.coerce.number().default(24), // Auto-delete audio 24 hours after approval (UU PDP)

  // AI Engine Configuration (Gemini Multimodal Audio & Diarization)
  GEMINI_API_KEY: z.string().optional().default(""),
});


export type ServerEnv = z.infer<typeof envSchema>;

export const serverEnv = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  DB_POOL_MAX: process.env.DB_POOL_MAX,
  DB_POOL_IDLE_TIMEOUT_MS: process.env.DB_POOL_IDLE_TIMEOUT_MS,
  DB_POOL_CONNECTION_TIMEOUT_MS: process.env.DB_POOL_CONNECTION_TIMEOUT_MS,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  PRESIGNED_URL_EXPIRES_SECONDS: process.env.PRESIGNED_URL_EXPIRES_SECONDS,
  AUDIO_AUTO_PURGE_HOURS: process.env.AUDIO_AUTO_PURGE_HOURS,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
});

