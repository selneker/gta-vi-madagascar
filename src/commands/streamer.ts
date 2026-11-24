import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  EmbedBuilder,
  TextChannel,
  NewsChannel,
  GuildMember,
} from 'discord.js'
import { db } from '../lib/db.js'
import { logger } from '../lib/logger.js'

/** Roles allowed to approve/reject streamer applications. */
const STREAMER_MOD_ROLE_IDS = [
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
  .setName('streamer')
  .setDescription('Gestion des streameurs vérifiés / Verified streamer management')
  .addSubcommand((sub) =>
    sub.setName('apply').setDescription('Postuler pour devenir streameur vérifié / Apply to become a verified streamer')
  )
  .addSubcommand((sub) =>
    sub
      .setName('approve')
      .setDescription('Approuver une candidature de streameur / Approve a streamer application')
      .addUserOption((opt) => opt.setName('utilisateur').setDescription('Utilisateur / User').setRequired(true))
      .addStringOption((opt) => opt.setName('note').setDescription('Note / Note').setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName('reject')
      .setDescription('Rejeter une candidature de streameur / Reject a streamer application')
      .addUserOption((opt) => opt.setName('utilisateur').setDescription('Utilisateur / User').setRequired(true))
      .addStringOption((opt) => opt.setName('note').setDescription('Note / Note').setRequired(false))
  )
  .addSubcommand((sub) =>
    sub.setName('profile').setDescription('Profil d’un streameur / Streamer profile').addUserOption((opt) =>
      opt.setName('utilisateur').setDescription('Utilisateur / User').setRequired(false)
    )
  )
  .addSubcommand((sub) =>
    sub.setName('leaderboard').setDescription('Classement des streameurs / Streamer leaderboard')
  )

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
      case 'apply':
        await handleApply(interaction)
        break
      case 'approve':
        await handleApprove(interaction, guild, member)
        break
      case 'reject':
        await handleReject(interaction, guild, member)
        break
      case 'profile':
        await handleProfile(interaction)
        break
      case 'leaderboard':
        await handleLeaderboard(interaction, guild)
        break
      default:
        await interaction.reply({ content: 'Sous-commande inconnue / Unknown subcommand.', ephemeral: true })
    }
  } catch (error) {
    deps.logger.error({ subcommand, error: String(error) }, '/streamer command failed')
    const content = 'Une erreur est survenue / An error occurred while running /streamer.'
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

function findChannelByName(cache: any, name: string): any {
  return [...cache.values()].find((c: any) => c.name === name)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /streamer apply — opens a modal
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleApply(interaction: ChatInputCommandInteraction): Promise<void> {
  const existing = await db.streamerApplication.findUnique({ where: { userId: interaction.user.id } })
  if (existing) {
    await interaction.reply({
      content: `Vous avez déjà une candidature en cours (statut: ${existing.status}) / You already have an application (status: ${existing.status}).`,
      ephemeral: true,
    })
    return
  }

  const modal = new ModalBuilder()
    .setCustomId('streamer:apply')
    .setTitle('Candidature streameur / Streamer Application')

  const platformInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('platform')
      .setLabel('Plateforme / Platform')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Twitch, YouTube, Facebook...')
      .setRequired(true)
      .setMaxLength(50)
  )
  const gamesInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('games')
      .setLabel('Jeux / Games')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('GTA VI, GTA Online (comma-separated)')
      .setRequired(true)
      .setMaxLength(200)
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
  const channelUrlInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('channelUrl')
      .setLabel('URL de la chaîne / Channel URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://twitch.tv/nomdutilisateur')
      .setRequired(true)
      .setMaxLength(200)
  )
  const introductionInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('introduction')
      .setLabel('Présentation / Introduction')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Parlez-nous de vous et de votre chaîne...')
      .setRequired(true)
      .setMaxLength(1000)
  )

  modal.addComponents(
    platformInput,
    gamesInput,
    languageInput,
    channelUrlInput,
    introductionInput
  )

  await interaction.showModal(modal)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /streamer approve
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleApprove(
  interaction: ChatInputCommandInteraction,
  guild: any,
  member: GuildMember
): Promise<void> {
  if (!hasAnyRole(member, STREAMER_MOD_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour cette action / You do not have the required role for this action.',
      ephemeral: true,
    })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const targetUser = interaction.options.getUser('utilisateur')
  if (!targetUser) {
    await interaction.editReply({ content: 'Utilisateur introuvable / User not found.' })
    return
  }

  const note = interaction.options.getString('note') || undefined

  const existing = await db.streamerApplication.findUnique({ where: { userId: targetUser.id } })
  if (!existing || existing.status !== 'PENDING') {
    await interaction.editReply({ content: 'Aucune candidature en attente pour cet utilisateur / No pending application for this user.' })
    return
  }

  await db.streamerApplication.update({
    where: { userId: targetUser.id },
    data: {
      status: 'APPROVED',
      reviewedBy: interaction.user.id,
      reviewedAt: new Date(),
    },
  })

  // Award Verified Streamer role if it exists
  const verifiedRole = findChannelByName(guild.roles.cache, 'Verified Streamer')
  const targetMember = guild.members.cache.get(targetUser.id)
  if (verifiedRole && targetMember) {
    try {
      await targetMember.roles.add(verifiedRole, 'Streamer application approved')
    } catch {
      // Role assignment failure shouldn't fail the command
    }
  }

  await db.auditLog.create({
    data: {
      guildId: guild.id,
      actorId: interaction.user.id,
      action: 'STREAMER_APPROVED',
      targetId: targetUser.id,
      targetType: 'StreamerApplication',
      details: { note },
    },
  })

  await interaction.editReply({
    content: `Candidature de <@${targetUser.id}> approuvée / Application approved for <@${targetUser.id}>.`,
  })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /streamer reject
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleReject(
  interaction: ChatInputCommandInteraction,
  guild: any,
  member: GuildMember
): Promise<void> {
  if (!hasAnyRole(member, STREAMER_MOD_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour cette action / You do not have the required role for this action.',
      ephemeral: true,
    })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const targetUser = interaction.options.getUser('utilisateur')
  if (!targetUser) {
    await interaction.editReply({ content: 'Utilisateur introuvable / User not found.' })
    return
  }

  const note = interaction.options.getString('note') || undefined

  const existing = await db.streamerApplication.findUnique({ where: { userId: targetUser.id } })
  if (!existing || existing.status !== 'PENDING') {
    await interaction.editReply({ content: 'Aucune candidature en attente pour cet utilisateur / No pending application for this user.' })
    return
  }

  await db.streamerApplication.update({
    where: { userId: targetUser.id },
    data: {
      status: 'REJECTED',
      reviewedBy: interaction.user.id,
      reviewedAt: new Date(),
    },
  })

  await db.auditLog.create({
    data: {
      guildId: guild.id,
      actorId: interaction.user.id,
      action: 'STREAMER_REJECTED',
      targetId: targetUser.id,
      targetType: 'StreamerApplication',
      details: { note },
    },
  })

  await interaction.editReply({
    content: `Candidature de <@${targetUser.id}> rejetée / Application rejected for <@${targetUser.id}>.`,
  })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /streamer profile
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleProfile(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const targetUser = interaction.options.getUser('utilisateur') ?? interaction.user

  const application = await db.streamerApplication.findUnique({ where: { userId: targetUser.id } })
  const profile = await db.memberProfile.findUnique({ where: { userId: targetUser.id } })

  const embed = new EmbedBuilder()
    .setTitle(`📺 Profil streameur / Streamer Profile — ${targetUser.username}`)
    .setColor(0x00ffff)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp()
    .addFields(
      { name: 'Utilisateur / User', value: `<@${targetUser.id}>`, inline: true },
      { name: 'Statut / Status', value: application ? application.status : 'Aucune candidature / No application', inline: true },
      { name: 'Niveau / Level', value: String(profile?.level ?? 1), inline: true },
      { name: 'XP', value: String(profile?.xp ?? 0), inline: true }
    )

  if (application) {
    embed.addFields(
      { name: 'Plateforme / Platform', value: application.platform, inline: true },
      { name: 'Jeux / Games', value: Array.isArray(application.games) ? application.games.join(', ') : String(application.games), inline: true },
      { name: 'Langue / Language', value: String(application.language), inline: true },
      { name: 'Chaîne / Channel', value: application.channelUrl || 'Non renseigné / Not provided', inline: true }
    )
  }

  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /streamer leaderboard
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleLeaderboard(interaction: ChatInputCommandInteraction, guild: any): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const topMembers = await db.xPTransaction.groupBy({
    by: ['userId'],
    where: { guildId: guild.id },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 10,
  })

  const embed = new EmbedBuilder()
    .setTitle('🏆 Classement des streameurs / Streamer Leaderboard')
    .setColor(0xffd700)
    .setTimestamp()

  if (topMembers.length === 0) {
    embed.setDescription('Aucun classement disponible / No leaderboard data yet.')
  } else {
    const lines = topMembers.map((entry: any, i: number) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
      return `${medal} <@${entry.userId}> — ${entry._sum.amount ?? 0} XP`
    })
    embed.setDescription(lines.join('\n'))
  }

  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Modal handler — streamer:apply
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export async function handleStreamerApplyModal(
  interaction: any,
  deps: { db: unknown; logger: typeof logger }
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const platform = interaction.fields.getTextInputValue('platform')
  const games = interaction.fields.getTextInputValue('games')
  const languageRaw = interaction.fields.getTextInputValue('language')
  const channelUrl = interaction.fields.getTextInputValue('channelUrl')
  const introduction = interaction.fields.getTextInputValue('introduction')

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

  const guildId = interaction.guildId
  const userId = interaction.user.id

  const existing = await db.streamerApplication.findUnique({ where: { userId } })
  if (existing) {
    await interaction.editReply({
      content: `Vous avez déjà une candidature (statut: ${existing.status}) / You already have an application (status: ${existing.status}).`,
    })
    return
  }

  try {
    const application = await db.streamerApplication.create({
      data: {
        userId,
        guildId,
        platform,
        games,
        language,
        channelUrl,
        introduction,
        status: 'PENDING',
      },
    })

    logger.info({ application: application.id, userId, guildId }, 'Streamer application submitted')

    // Notify staff in #news-review
    const guild = interaction.guild as {
      channels: { cache: any }
    }
    const reviewChannel = guild.channels.cache.find((c: any) => c.name === '📰・news-review')
    if (reviewChannel && reviewChannel.isTextBased?.()) {
      const embed = new EmbedBuilder()
        .setTitle('📝 Nouvelle candidature streameur / New Streamer Application')
        .setColor(0xffd700)
        .addFields(
          { name: 'Utilisateur / User', value: `<@${userId}>`, inline: true },
          { name: 'Plateforme / Platform', value: platform, inline: true },
          { name: 'Jeux / Games', value: games, inline: true },
          { name: 'Langue / Language', value: language, inline: true },
          { name: 'Chaîne / Channel', value: channelUrl, inline: true },
          { name: 'Présentation / Introduction', value: introduction.slice(0, 1000), inline: false }
        )
        .setTimestamp()
      void (reviewChannel as TextChannel | NewsChannel).send({ embeds: [embed] })
    }

    await interaction.editReply({
      content: 'Votre candidature a été soumise avec succès ! Elle sera examinée par l’équipe staff. / Your application has been submitted! It will be reviewed by the staff team.',
    })
  } catch (error) {
    deps.logger.error({ error: String(error) }, 'Failed to create streamer application')
    await interaction.editReply({ content: 'Échec de la soumission de la candidature / Failed to submit application.' })
  }
}
