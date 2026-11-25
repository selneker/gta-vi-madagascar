/**
 * Live guild maintenance: applies the configured structure and/or removes
 * duplicate channels against the real Discord guild.
 *
 *   npx tsx scripts/live-maintenance.ts preview
 *   npx tsx scripts/live-maintenance.ts apply
 *   npx tsx scripts/live-maintenance.ts cleanup            # dry run
 *   npx tsx scripts/live-maintenance.ts cleanup --yes      # deletes for real
 *
 * Uses the same code as /setup, so the result matches the slash command.
 */

import { Agent, setGlobalDispatcher } from 'undici'
import { Client, GatewayIntentBits } from 'discord.js'
import { config } from '../src/config/index.js'
import { apply, audit, cleanup, preview } from '../src/services/server-setup.js'
import { disconnectDb } from '../src/lib/db.js'

// Discord's edge answers in 10–20 s from some networks. undici gives up on the
// TCP connect after 10 s by default, which killed long apply() runs halfway.
setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 }, headersTimeout: 120_000, bodyTimeout: 120_000 }))

const REST_TIMEOUT_MS = 60_000

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'preview'
  const confirmed = process.argv.includes('--yes')

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    rest: { timeout: REST_TIMEOUT_MS, retries: 5 },
  })
  await client.login(config.DISCORD_TOKEN)

  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID)

    switch (mode) {
      case 'preview': {
        const result = await preview(guild)
        const counts = { create: 0, update: 0, unchanged: 0 }
        for (const item of [...result.roles, ...result.channels]) counts[item.action]++
        const changes = [...result.roles, ...result.channels]
          .filter((item) => item.action !== 'unchanged')
          .map((item) => ({ action: item.action, name: item.def.name }))
        console.log(JSON.stringify({ mode, counts, changes, warnings: result.warnings }, null, 2))
        break
      }
      case 'audit': {
        const result = await audit(guild)
        console.log(JSON.stringify({ mode, roles: result.roles.length, channels: result.channels.length, warnings: result.warnings }, null, 2))
        break
      }
      case 'apply': {
        const result = await apply(guild)
        console.log(JSON.stringify({ mode, result }, null, 2))
        break
      }
      case 'cleanup': {
        const result = await cleanup(guild, !confirmed)
        console.log(JSON.stringify({ mode, dryRun: !confirmed, result }, null, 2))
        break
      }
      default:
        throw new Error(`Unknown mode: ${mode}. Use preview | audit | apply | cleanup [--yes]`)
    }
  } finally {
    await client.destroy()
    await disconnectDb()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
