import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_GUILD_ID: z.string().min(1, 'DISCORD_GUILD_ID is required'),
  DISCORD_GLOBAL_COMMANDS: z.string().default('false').transform((value) => value === 'true'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TIMEZONE: z.string().default('Africa/Antananarivo'),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

export function loadEnv(): Env {
  if (cached) return cached
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const fields = Object.keys(result.error.flatten().fieldErrors).join(', ')
    throw new Error(
      `Invalid environment configuration: ${fields}. Copy .env.example to .env and fill in the values.`
    )
  }
  cached = result.data
  return cached
}

/** Validated runtime configuration. Throws at import time if required env vars are missing. */
export const config = loadEnv()

/** Allows tests to re-load env after mutating process.env. */
export function resetEnvForTesting(): void {
  cached = null
}
