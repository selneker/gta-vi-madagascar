import { EmbedBuilder, TextChannel, NewsChannel, Role } from 'discord.js'
import { logger } from '../lib/logger.js'

const EMBED_COLOR = 0xff00ff
const FOOTER_TEXT = 'GTA VI MADAGASCAR — Live Center'

/** Build the embed posted when a live session starts. */
export function buildLiveStartEmbed(session: {
  id: string
  title: string
  game: string
  language: string
  hostId: string
  externalUrl?: string | null
  description?: string | null
  startTime: Date
  voiceChannelId: string
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🔴 Live en direct / Live Now')
    .setDescription(session.description || 'Aucune description / No description provided.')
    .setColor(EMBED_COLOR)
    .setTimestamp(session.startTime)
    .setFooter({ text: FOOTER_TEXT })

  embed.addFields(
    { name: 'Titre / Title', value: session.title, inline: true },
    { name: 'Jeu / Game', value: session.game, inline: true },
    { name: 'Langue / Language', value: session.language, inline: true },
    { name: 'Hôte / Host', value: `<@${session.hostId}>`, inline: true },
    { name: 'Salon vocal / Voice Channel', value: `<#${session.voiceChannelId}>`, inline: true }
  )

  if (session.externalUrl) {
    embed.addFields({
      name: 'Diffusion externe / External Stream',
      value: `[Regarder / Watch](${session.externalUrl})`,
      inline: false,
    })
  }

  return embed
}

/** Build the embed posted when a live session ends. */
export function buildLiveEndEmbed(session: {
  id: string
  title: string
  game: string
  hostId: string
  startTime: Date
  endTime?: Date | null
  durationSeconds?: number | null
  voiceAttendance: number
}): EmbedBuilder {
  const durationMinutes = session.durationSeconds
    ? Math.floor(session.durationSeconds / 60)
    : 0

  const embed = new EmbedBuilder()
    .setTitle('⚫ Live terminé / Live Ended')
    .setDescription(`${session.title} — ${session.game}`)
    .setColor(0x808080)
    .setTimestamp(session.endTime ?? new Date())
    .setFooter({ text: FOOTER_TEXT })

  embed.addFields(
    { name: 'Titre / Title', value: session.title, inline: true },
    { name: 'Jeu / Game', value: session.game, inline: true },
    { name: 'Hôte / Host', value: `<@${session.hostId}>`, inline: true },
    { name: 'Durée / Duration', value: `${durationMinutes} min`, inline: true },
    { name: 'Participants', value: String(session.voiceAttendance), inline: true }
  )

  return embed
}

/** Post a live start announcement to the announcements channel. */
export async function postLiveStartAnnouncement(
  channel: TextChannel | NewsChannel,
  session: {
    id: string
    title: string
    game: string
    language: string
    hostId: string
    externalUrl?: string | null
    description?: string | null
    startTime: Date
    voiceChannelId: string
  },
  liveAlertsRole?: Role | null
): Promise<void> {
  const embed = buildLiveStartEmbed(session)
  const content = liveAlertsRole ? `<@&${liveAlertsRole.id}> Un live vient de commencer ! / A live just started!` : undefined

  try {
    await channel.send({ content, embeds: [embed] })
    logger.info({ channel: channel.id, session: session.id }, 'Live start announcement posted')
  } catch (error) {
    logger.error({ channel: channel.id, session: session.id, error: String(error) }, 'Failed to post live start announcement')
    throw error
  }
}

/** Post a live end announcement to the announcements channel. */
export async function postLiveEndAnnouncement(
  channel: TextChannel | NewsChannel,
  session: {
    id: string
    title: string
    game: string
    hostId: string
    startTime: Date
    endTime?: Date | null
    durationSeconds?: number | null
    voiceAttendance: number
  }
): Promise<void> {
  const embed = buildLiveEndEmbed(session)

  try {
    await channel.send({ embeds: [embed] })
    logger.info({ channel: channel.id, session: session.id }, 'Live end announcement posted')
  } catch (error) {
    logger.error({ channel: channel.id, session: session.id, error: String(error) }, 'Failed to post live end announcement')
    throw error
  }
}

/** Build the /live panel embed. */
export function buildLivePanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🔴 Live Center — GTA VI MADAGASCAR')
    .setDescription(
      "Bienvenue dans le Live Center ! Utilisez les commandes ci-dessous pour gérer vos diffusions.\n" +
      'Welcome to the Live Center! Use the commands below to manage your live streams.'
    )
    .setColor(0xff00ff)
    .addFields(
      {
        name: '/live start',
        value: "Démarrer un live (modal) / Start a live stream (opens a modal).",
        inline: false,
      },
      {
        name: '/live end',
        value: 'Terminer le live en cours / End the current live stream.',
        inline: false,
      },
      {
        name: '/live schedule',
        value: 'Programmer un live à venir / Schedule an upcoming live stream.',
        inline: false,
      },
      {
        name: '/live cancel',
        value: 'Annuler un live programmé / Cancel a scheduled live stream.',
        inline: false,
      },
      {
        name: '/live list',
        value: 'Lister les lives à venir et en cours / List upcoming and live streams.',
        inline: false,
      },
      {
        name: '/live status',
        value: 'Statut du live actuel / Current live stream status.',
        inline: false,
      },
      {
        name: '/live history',
        value: "Historique des lives passés / Past live streams history.",
        inline: false,
      },
      {
        name: '/streamer apply',
        value: 'Devenir streameur vérifié / Apply to become a verified streamer.',
        inline: false,
      },
      {
        name: '🔴・CREATE YOUR LIVE ROOM',
        value: "Rejoignez ce salon vocal pour créer un salon temporaire dédié à votre live.\nJoin this voice channel to create a temporary voice room for your live.",
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: FOOTER_TEXT })
}
