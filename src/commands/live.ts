import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelType,
  Role,
  TextChannel,
  NewsChannel,
  GuildMember,
} from 'discord.js'
import {
  createLiveSession,
  endLiveSession,
  getActiveSession,
  listLiveSessions,
  getLiveHistory,
  type LiveStartData,
} from '../services/live-center.js'
import { postLiveStartAnnouncement, postLiveEndAnnouncement, buildLivePanelEmbed } from '../services/live-announcements.js'
import { logger } from '../lib/logger.js'

/** Roles allowed to start/manage a live session. */
const LIVE_MANAGE_ROLE_IDS = [
  'role_live_director',
  'role_stage_mod',
  'role_live_host',
  'role_verified_streamer',
]

/** Roles allowed to schedule/cancel lives (admin-ish). */
const LIVE_ADMIN_ROLE_IDS = [
  'role_live_director',
  'role_stage_mod',
  'role_head_mod',
  'role_moderator',
  'role_administrator',
  'role_community_manager',
  'role_founder',
  'role_cofounder',
]

export const data = new SlashCommandBuilder()
  .setName('live')
  .setDescription('Live Center — gérer les diffusions en direct')
  .addSubcommand((sub) =>
    sub.setName('panel').setDescription('Panneau d’information du Live Center / Live Center info panel')
  )
  .addSubcommand((sub) =>
    sub
      .setName('start')
      .setDescription('Démarrer un live / Start a live stream (opens a form)')
      .addChannelOption((opt) =>
        opt
          .setName('salon')
          .setDescription('Salon vocal pour le live / Voice channel for the live')
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('end').setDescription('Terminer le live en cours / End the current live stream')
  )
  .addSubcommand((sub) =>
    sub.setName('schedule').setDescription('Programmer un live / Schedule a live stream')
  )
  .addSubcommand((sub) =>
    sub.setName('cancel').setDescription('Annuler un live / Cancel a live stream')
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Lister les lives / List live streams')
  )
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('Statut du live actuel / Current live status')
  )
  .addSubcommand((sub) =>
    sub.setName('history').setDescription('Historique des lives / Live history')
  )

/** Modal custom ID prefix for live start. */
const LIVE_START_MODAL_ID = 'live:start'

export async function execute(
  interaction: ChatInputCommandInteraction,
  deps: { db: unknown; logger: typeof logger }
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild || !interaction.member) {
    await interaction.reply({
      content: 'Cette commande ne fonctionne que dans un serveur / This command only works inside a server.',
      ephemeral: true,
    })
    return
  }

  const guild = interaction.guild
  const member = interaction.member as GuildMember
  const subcommand = interaction.options.getSubcommand(true)

  try {
    switch (subcommand) {
      case 'panel':
        await handlePanel(interaction)
        break
      case 'start':
        await handleStart(interaction)
        break
      case 'end':
        await handleEnd(interaction, guild, member)
        break
      case 'schedule':
        await handleSchedule(interaction, guild)
        break
      case 'cancel':
        await handleCancel(interaction, guild)
        break
      case 'list':
        await handleList(interaction, guild)
        break
      case 'status':
        await handleStatus(interaction, guild)
        break
      case 'history':
        await handleHistory(interaction, guild)
        break
      default:
        await interaction.reply({ content: 'Sous-commande inconnue / Unknown subcommand.', ephemeral: true })
    }
  } catch (error) {
    deps.logger.error({ subcommand, error: String(error) }, '/live command failed')
    const content = 'Une erreur est survenue / An error occurred while running /live.'
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true })
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function hasAnyRole(member: GuildMember, roleIds: string[]): boolean {
  return roleIds.some((id) => member.roles.cache.has(id))
}

function requireRole(interaction: ChatInputCommandInteraction, roleIds: string[]): boolean {
  const member = interaction.member
  if (!member || !(member as GuildMember).roles.cache) {
    void interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour cette action / You do not have the required role for this action.',
      ephemeral: true,
    })
    return false
  }
  if (!hasAnyRole(member as GuildMember, roleIds)) {
    void interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour cette action / You do not have the required role for this action.',
      ephemeral: true,
    })
    return false
  }
  return true
}

function findChannelByName(cache: any, name: string): any {
  return [...cache.values()].find((c: any) => c.name === name)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live panel
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handlePanel(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })
  const embed = buildLivePanelEmbed()
  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live start — opens a modal
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!hasAnyRole(interaction.member as GuildMember, LIVE_MANAGE_ROLE_IDS)) {
    await interaction.reply({
      content: 'Seuls les directeurs live, animateurs, modérateurs de scène et streameurs vérifiés peuvent démarrer un live / Only Live Directors, Hosts, Stage Moderators and Verified Streamers can start a live.',
      ephemeral: true,
    })
    return
  }

  const channelOption = interaction.options.getChannel('salon')
  const voiceChannelId = channelOption?.id ?? ''

  const modal = new ModalBuilder()
    .setCustomId(`${LIVE_START_MODAL_ID}:${voiceChannelId}`)
    .setTitle('Démarrer un live / Start a Live Stream')

  const titleInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Titre du live / Live title')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: GTA VI — Première diffusion / e.g. GTA VI — First stream')
      .setRequired(true)
      .setMaxLength(100)
  )
  const gameInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('game')
      .setLabel('Jeu / Game')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: GTA VI')
      .setRequired(true)
      .setMaxLength(50)
  )
  const languageInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('language')
      .setLabel('Langue / Language')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('malagasy / french / english')
      .setRequired(true)
      .setMaxLength(20)
  )
  const descriptionInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description (optionnel / optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ce live sera diffusé en direct...')
      .setRequired(false)
      .setMaxLength(500)
  )
  const externalUrlInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('externalUrl')
      .setLabel('Lien externe (optionnel / External URL)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://twitch.tv/nomdutilisateur')
      .setRequired(false)
      .setMaxLength(200)
  )

  modal.addComponents(titleInput, gameInput, languageInput, descriptionInput, externalUrlInput)

  await interaction.showModal(modal)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live end
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleEnd(
  interaction: ChatInputCommandInteraction,
  guild: any,
  member: GuildMember
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const active = await getActiveSession(guild.id)
  if (!active) {
    await interaction.editReply({ content: 'Aucun live en cours / No live stream currently running.' })
    return
  }

  const isHost = active.hostId === member.id
  const canManage = hasAnyRole(member, LIVE_MANAGE_ROLE_IDS)
  if (!isHost && !canManage) {
    await interaction.editReply({
      content: 'Seul l’hôte du live ou un responsable Live peut terminer ce live / Only the live host or a Live manager can end this stream.',
    })
    return
  }

  const ended = await endLiveSession(active.id)

  // Post end announcement
  const announcementChannel = findChannelByName(guild.channels.cache, '📢・live-announcements')
  if (announcementChannel && announcementChannel.isTextBased?.()) {
    try {
      await postLiveEndAnnouncement(announcementChannel as TextChannel | NewsChannel, {
        id: ended.id,
        title: ended.title,
        game: ended.game,
        hostId: ended.hostId,
        startTime: ended.startTime,
        endTime: ended.endTime,
        durationSeconds: ended.durationSeconds,
        voiceAttendance: ended.voiceAttendance,
      })
    } catch {
      // Announcement failure shouldn't fail the command
    }
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle('⚫ Live terminé / Live Ended')
        .setDescription(`${ended.title} — ${ended.game}`)
        .setColor(0x808080)
        .addFields(
          { name: 'Durée / Duration', value: `${Math.floor((ended.durationSeconds ?? 0) / 60)} min`, inline: true },
          { name: 'Participants', value: String(ended.voiceAttendance), inline: true }
        )
        .setTimestamp()
    ],
  })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live schedule
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleSchedule(interaction: ChatInputCommandInteraction, _guild: any): Promise<void> {
  if (!requireRole(interaction, LIVE_ADMIN_ROLE_IDS)) return

  await interaction.deferReply({ ephemeral: true })
  await interaction.editReply({
    content: 'La programmation via événements Discord programmés sera configurée prochainement. Utilisez /live start pour diffuser maintenant. / Scheduled events setup coming soon. Use /live start to go live now.',
  })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live cancel
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleCancel(interaction: ChatInputCommandInteraction, _guild: any): Promise<void> {
  if (!requireRole(interaction, LIVE_ADMIN_ROLE_IDS)) return

  await interaction.deferReply({ ephemeral: true })
  await interaction.editReply({
    content: 'Fournissez un ID de session pour annuler / Provide a session ID to cancel. (coming soon)',
  })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live list
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleList(interaction: ChatInputCommandInteraction, guild: any): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const sessions = await listLiveSessions(guild.id, undefined, 10)

  const embed = new EmbedBuilder()
    .setTitle('📅 Lives à venir / Upcoming Lives')
    .setColor(0xff00ff)
    .setTimestamp()

  if (sessions.length === 0) {
    embed.setDescription('Aucun live programmé / No live streams scheduled.')
  } else {
    for (const s of sessions) {
      const statusEmoji = s.status === 'LIVE' ? '🔴' : s.status === 'SCHEDULED' ? '📅' : '⚫'
      embed.addFields({
        name: `${statusEmoji} ${s.title}`,
        value: `Jeu: ${s.game}\nHôte: <@${s.hostId}>\nStatut: ${s.status}\nDébut: <t:${Math.floor(s.startTime.getTime() / 1000)}:R>`,
        inline: true,
      })
    }
  }

  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live status
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleStatus(interaction: ChatInputCommandInteraction, guild: any): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const active = await getActiveSession(guild.id)

  if (!active) {
    await interaction.editReply({ content: 'Aucun live en cours / No live stream currently running.' })
    return
  }

  const embed = new EmbedBuilder()
    .setTitle('🔴 Live en cours / Live Now')
    .setDescription(active.description || '')
    .setColor(0xff00ff)
    .addFields(
      { name: 'Titre / Title', value: active.title, inline: true },
      { name: 'Jeu / Game', value: active.game, inline: true },
      { name: 'Hôte / Host', value: `<@${active.hostId}>`, inline: true },
      { name: 'Salon vocal / Voice', value: `<#${active.voiceChannelId}>`, inline: true },
      { name: 'Débuté à / Started', value: `<t:${Math.floor(active.startTime.getTime() / 1000)}:R>`, inline: true }
    )
    .setTimestamp(active.startTime)

  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live history
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleHistory(interaction: ChatInputCommandInteraction, guild: any): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const sessions = await getLiveHistory(guild.id, 10)

  const embed = new EmbedBuilder()
    .setTitle('📜 Historique des lives / Live History')
    .setColor(0x808080)
    .setTimestamp()

  if (sessions.length === 0) {
    embed.setDescription('Aucun live passé / No past live streams.')
  } else {
    for (const s of sessions) {
      const durationMin = s.durationSeconds ? Math.floor(s.durationSeconds / 60) : 0
      embed.addFields({
        name: `⚫ ${s.title}`,
        value: `Jeu: ${s.game}\nHôte: <@${s.hostId}>\nDurée: ${durationMin} min\nTerminé: <t:${Math.floor((s.endTime ?? s.startTime).getTime() / 1000)}:R>`,
        inline: true,
      })
    }
  }

  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Modal handler — live:start
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const modalCustomId = LIVE_START_MODAL_ID

export async function handleLiveStartModal(
  interaction: any,
  deps: { db: unknown; logger: typeof logger }
): Promise<void> {
  const customId = interaction.customId as string
  const parts = customId.split(':')
  // format: live:start:<voiceChannelId>
  const voiceChannelId = parts.length > 2 ? parts[2] : ''

  await interaction.deferReply({ ephemeral: true })

  const title = interaction.fields.getTextInputValue('title')
  const game = interaction.fields.getTextInputValue('game')
  const languageRaw = interaction.fields.getTextInputValue('language')
  const description = interaction.fields.getTextInputValue('description') || undefined
  const externalUrl = interaction.fields.getTextInputValue('externalUrl') || undefined

  const languageMap: Record<string, 'MALAGASY' | 'FRENCH' | 'ENGLISH'> = {
    malagasy: 'MALAGASY',
    mg: 'MALAGASY',
    french: 'FRENCH',
    fr: 'FRENCH',
    english: 'ENGLISH',
    en: 'ENGLISH',
  }
  const language = languageMap[languageRaw.toLowerCase().trim()]
  if (!language) {
    await interaction.editReply({
      content: 'Langue invalide. Utilisez malagasy, french ou english / Invalid language. Use malagasy, french or english.',
    })
    return
  }

  if (!voiceChannelId) {
    await interaction.editReply({
      content: 'Veuillez sélectionner un salon vocal avec l’option /salon / Please select a voice channel with the /salon option.',
    })
    return
  }

  const guildId = interaction.guildId
  const hostId = interaction.user.id

  const data: LiveStartData = {
    title,
    game,
    language,
    voiceChannelId,
    description,
    externalUrl,
    startedAt: new Date(),
  }

  try {
    const session = await createLiveSession(guildId, hostId, data)

    // Post start announcement
    const guild = interaction.guild as {
      channels: { cache: any }
      roles: { cache: any }
    }
    const announcementChannel = guild.channels.cache.find((c: any) => c.name === '📢・live-announcements')
    if (announcementChannel && announcementChannel.isTextBased?.()) {
      const liveAlertsRole = guild.roles.cache.find((r: any) => r.name === 'Live Alerts')
      await postLiveStartAnnouncement(
        announcementChannel as TextChannel | NewsChannel,
        {
          id: session.id,
          title: session.title,
          game: session.game,
          language: session.language,
          hostId: session.hostId,
          externalUrl: session.externalUrl,
          description: session.description,
          startTime: session.startTime,
          voiceChannelId: session.voiceChannelId,
        },
        liveAlertsRole as Role | undefined
      )
    }

    await interaction.editReply({
      content: `🔴 Live démarré ! / Live started: **${session.title}**\nJeu: ${session.game}\nSalon: <#${session.voiceChannelId}>`,
    })
  } catch (error) {
    deps.logger.error({ error: String(error) }, 'Failed to create live session from modal')
    await interaction.editReply({ content: 'Échec de la création du live / Failed to create live session.' })
  }
}
