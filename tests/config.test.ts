import { describe, it, expect, beforeEach } from 'vitest'
import { loadEnv, resetEnvForTesting, type Env } from '@/src/config/index.js'

function withEnv(overrides: Partial<Record<keyof Env, string | undefined>>): void {
  resetEnvForTesting()
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('loadEnv', () => {
  beforeEach(() => {
    resetEnvForTesting()
    process.env.DISCORD_TOKEN = 'test-token'
    process.env.DISCORD_CLIENT_ID = '111'
    process.env.DISCORD_GUILD_ID = '222'
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
    process.env.NODE_ENV = 'test'
  })

  it('parses a valid environment with defaults', () => {
    const env = loadEnv()
    expect(env.DISCORD_TOKEN).toBe('test-token')
    expect(env.DISCORD_GLOBAL_COMMANDS).toBe(false)
    expect(env.TIMEZONE).toBe('Africa/Antananarivo')
    expect(env.NODE_ENV).toBe('test')
  })

  it('coerces DISCORD_GLOBAL_COMMANDS=true', () => {
    withEnv({ DISCORD_GLOBAL_COMMANDS: 'true' })
    expect(loadEnv().DISCORD_GLOBAL_COMMANDS).toBe(true)
  })

  it('throws when DISCORD_TOKEN is missing', () => {
    withEnv({ DISCORD_TOKEN: undefined })
    expect(() => loadEnv()).toThrow(/DISCORD_TOKEN/)
  })

  it('throws when DATABASE_URL is missing', () => {
    withEnv({ DATABASE_URL: undefined })
    expect(() => loadEnv()).toThrow(/DATABASE_URL/)
  })
})
