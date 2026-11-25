import { Client, Events, type ApplicationCommandDataResolvable } from 'discord.js'
import { logger } from '../lib/logger.js'
import { db } from '../lib/db.js'
import { config } from '../config/index.js'
import { commands } from '../commands/index.js'
import { startNewsRSSService } from '../services/news-rss.js'
import { setGatewayStatus } from '../health.js'

/**
 * Registers the slash commands on startup. Doing it here (instead of relying on
 * scripts/register-commands.ts) guarantees that a newly added command such as
 * /mandy is actually available after a deploy.
 */
async function registerCommands(client: Client): Promise<void> {
  if (!client.application) {
    logger.warn('Application unavailable — slash command registration skipped')
    return
  }
  const body = commands.map((command) => command.data.toJSON()) as ApplicationCommandDataResolvable[]
  try {
    if (config.DISCORD_GLOBAL_COMMANDS) {
      await client.application.commands.set(body)
      logger.info({ count: body.length }, 'Slash commands registered globally')
    } else {
      await client.application.commands.set(body, config.DISCORD_GUILD_ID)
      logger.info({ count: body.length, guild: config.DISCORD_GUILD_ID }, 'Slash commands registered in guild')
    }
  } catch (error) {
    logger.error({ error: String(error) }, 'Slash command registration failed')
  }
}

export function registerReadyEvents(client: Client): void {
  client.on(Events.Debug, (message: string) => logger.debug({ message }))

  client.on(Events.Error, (error: Error) => logger.error({ error: error.message }, 'Discord client error'))

  client.on(Events.Warn, (warning: string) => logger.warn({ warning }, 'Discord client warning'))

  client.on(Events.ClientReady, async (c) => {
    setGatewayStatus('ready')
    logger.info({ user: c.user.tag, id: c.user.id, guilds: c.guilds.cache.size }, 'Bot connecté / Bot ready')

    await registerCommands(c)

    // Démarre le service de polling RSS en arrière-plan
    startNewsRSSService()
  })

  client.on(Events.ShardDisconnect, (_event, shardId) => {
    setGatewayStatus('disconnected')
    logger.warn({ shardId }, 'Gateway disconnected')
  })

  client.on(Events.ShardReconnecting, (shardId) => {
    setGatewayStatus('connecting')
    logger.warn({ shardId }, 'Gateway reconnecting')
  })

  client.on(Events.ShardResume, (shardId) => {
    setGatewayStatus('ready')
    logger.info({ shardId }, 'Gateway resumed')
  })

  client.on(Events.GuildCreate, async (guild) => {
    logger.info({ guild: guild.id, name: guild.name }, 'Guild joined / seen')
    try {
      await db.guildConfiguration.upsert({
        where: { guildId: guild.id },
        create: { guildId: guild.id, name: guild.name },
        update: { name: guild.name },
      })
    } catch (error) {
      logger.error({ guild: guild.id, error: String(error) }, 'Failed to record guild configuration')
    }
  })
}
