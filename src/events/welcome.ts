import { Client, Events, GuildMember, ChannelType } from 'discord.js'
import { logger } from '../lib/logger.js'
import { buildWelcomeEmbed, buildWelcomeComponents } from '../commands/welcome.js'

/**
 * Enregistre l'événement de bienvenue : quand un membre rejoint le serveur,
 * le bot poste un message dans #welcome avec un bouton de sondage d'accueil
 * et un sélecteur de rôles.
 */
export function registerWelcomeEvents(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    if (member.user.bot) return

    const guild = member.guild
    const welcomeChannel = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === '╭ㆍwelcome',
    )

    if (!welcomeChannel || !welcomeChannel.isTextBased?.()) {
      logger.warn({ guild: guild.id }, 'Welcome channel not found; skipping welcome message')
      return
    }

    try {
      await (welcomeChannel as any).send({
        embeds: [buildWelcomeEmbed(member)],
        components: buildWelcomeComponents(),
      })
      logger.info({ user: member.id, guild: guild.id }, 'Welcome message posted')
    } catch (error) {
      logger.error({ user: member.id, guild: guild.id, error: String(error) }, 'Failed to post welcome message')
    }
  })

  logger.info('Welcome events registered')
}
