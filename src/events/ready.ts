import { Client, Events } from 'discord.js'
import { logger } from '../lib/logger.js'
import { db } from '../lib/db.js'
import { startNewsRSSService } from '../services/news-rss.js'

export function registerReadyEvents(client: Client): void {
  client.on(Events.Debug, (message: string) => logger.debug({ message }))

  client.on(Events.Error, (error: Error) => logger.error({ error: error.message }, 'Discord client error'))

  client.on(Events.Warn, (warning: string) => logger.warn({ warning }, 'Discord client warning'))

  client.on(Events.ClientReady, async (c) => {
    logger.info({ user: c.user.tag, id: c.user.id, guilds: c.guilds.cache.size }, 'Bot connecté / Bot ready')

    // Démarre le service de polling RSS en arrière-plan
    startNewsRSSService()
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
