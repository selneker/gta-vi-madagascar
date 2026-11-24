/**
 * One-off script to register slash commands with Discord.
 *
 *   npx tsx scripts/register-commands.ts
 *
 * By default commands are registered in the configured guild (instant
 * propagation, recommended during development). Set DISCORD_GLOBAL_COMMANDS=true
 * to register globally (propagation can take up to an hour).
 */

import { REST } from '@discordjs/rest'
import { Routes } from 'discord.js'
import { config } from '../src/config/index.js'
import { commands } from '../src/commands/index.js'

async function main(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN)
  const body = commands.map((command) => command.data.toJSON())

  const route = config.DISCORD_GLOBAL_COMMANDS
    ? Routes.applicationCommands(config.DISCORD_CLIENT_ID)
    : Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID)

  await rest.put(route, { body })
  console.log(
    `Registered ${body.length} slash command(s) ${
      config.DISCORD_GLOBAL_COMMANDS ? 'globally' : `in guild ${config.DISCORD_GUILD_ID}`
    }`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
