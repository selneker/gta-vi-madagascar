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
  Role,
} from 'discord.js'
import { db } from '../lib/db.js'
import {
  submitNews,
  getNewsSubmission,
  approveNews,
  rejectNews,
  publishNews,
  editNews,
  archiveNews,
  getNewsArticle,
  getNewsHistory,
  listNewsSources,
  type NewsSubmitData,
} from '../services/news-center.js'
import type { NewsCategory, Language, ConfirmationStatus } from '@prisma/client'
import { postNewsReview, buildNewsPublishEmbed } from '../services/news-announcements.js'
import { resolveChannel, hasAnyConfigRole } from '../lib/resolve.js'
import { logger } from '../lib/logger.js'

/** Roles allowed to submit news. */
const NEWS_SUBMIT_ROLE_IDS = ['role_member', 'role_veteran', 'role_og_member', 'role_vip', 'role_content_creator']

/** Roles allowed to review/approve/reject news submissions. */
const NEWS_MOD_ROLE_IDS = [
  'role_news_approver',
  'role_news_editor',
  'role_head_mod',
  'role_moderator',
  'role_administrator',
  'role_community_manager',
  'role_founder',
  'role_cofounder',
]

/** Roles allowed to publish approved articles. */
const NEWS_PUBLISH_ROLE_IDS = [
  'role_news_approver',
  'role_head_mod',
  'role_administrator',
  'role_community_manager',
  'role_founder',
  'role_cofounder',
]

/** Roles allowed to edit articles. */
const NEWS_EDIT_ROLE_IDS = [
  'role_news_editor',
  'role_head_mod',
  'role_administrator',
  'role_community_manager',
  'role_founder',
  'role_cofounder',
]

export const data = new SlashCommandBuilder()
  .setName('news')
  .setDescription('Newsroom — gestion des articles de news GTA VI')
  .addSubcommand((sub) =>
    sub.setName('submit').setDescription('Soumettre une news / Submit a news article')
  )
  .addSubcommand((sub) =>
    sub
      .setName('review')
      .setDescription('Revoir une soumission en attente / Review a pending submission')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID de la soumission / Submission ID').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('approve')
      .setDescription('Approuver une soumission / Approve a submission')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID de la soumission / Submission ID').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('note').setDescription('Note de révision / Review note').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('reject')
      .setDescription('Rejeter une soumission / Reject a submission')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID de la soumission / Submission ID').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('note').setDescription('Note de rejet / Reject note').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('publish')
      .setDescription('Publier une news approuvée / Publish an approved article')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID de l’article / Article ID').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Éditer une news existante / Edit an existing article')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID de l’article / Article ID').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('sources').setDescription('Lister les sources de news / List news sources')
  )
  .addSubcommand((sub) =>
    sub
      .setName('history')
      .setDescription('Historique des révisions d’un article / Article revision history')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID de l’article / Article ID').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('archive')
      .setDescription('Archiver une news publiée / Archive a published article')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID de l’article / Article ID').setRequired(true)
      )
  )

const NEWS_SUBMIT_MODAL_ID = 'news:submit'
const NEWS_EDIT_MODAL_ID = 'news:edit'

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
      case 'submit':
        await handleSubmit(interaction)
        break
      case 'review':
        await handleReview(interaction, guild)
        break
      case 'approve':
        await handleApprove(interaction, guild, member)
        break
      case 'reject':
        await handleReject(interaction, member)
        break
      case 'publish':
        await handlePublish(interaction, guild, member)
        break
      case 'edit':
        await handleEdit(interaction)
        break
      case 'sources':
        await handleSources(interaction)
        break
      case 'history':
        await handleHistory(interaction)
        break
      case 'archive':
        await handleArchive(interaction, member)
        break
      default:
        await interaction.reply({ content: 'Sous-commande inconnue / Unknown subcommand.', ephemeral: true })
    }
  } catch (error) {
    deps.logger.error({ subcommand, error: String(error) }, '/news command failed')
    const content = 'Une erreur est survenue / An error occurred while running /news.'
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true })
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function hasAnyRole(member: GuildMember, roleIds: string[]): boolean {
  return hasAnyConfigRole(member.guild, member, roleIds)
}

function findRoleByName(cache: any, name: string): Role | undefined {
  return [...cache.values()].find((r: any) => r.name === name) as Role | undefined
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news submit — opens a modal
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleSubmit(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!hasAnyRole(interaction.member as GuildMember, NEWS_SUBMIT_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour soumettre une news / You do not have the required role to submit news.',
      ephemeral: true,
    })
    return
  }

  const modal = new ModalBuilder()
    .setCustomId(NEWS_SUBMIT_MODAL_ID)
    .setTitle('Soumettre une news / Submit News')

  const titleInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Titre / Title')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('GTA VI : date de sortie confirmée')
      .setRequired(true)
      .setMaxLength(200)
  )
  const summaryInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('summary')
      .setLabel('Résumé / Summary')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Résumé court de la news...')
      .setRequired(true)
      .setMaxLength(1000)
  )
  const categoryInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('category')
      .setLabel('Catégorie / Category')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('OFFICIAL, GAME_UPDATES, GTA_VI, COMMUNITY, INDUSTRY, UNCONFIRMED')
      .setRequired(true)
      .setMaxLength(20)
  )
  const languageInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('language')
      .setLabel('Langue / Language')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('french, malagasy, english')
      .setRequired(true)
      .setMaxLength(20)
  )
  const sourceUrlInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('sourceUrl')
      .setLabel('URL de la source (optionnel / Source URL)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://example.com/article')
      .setRequired(false)
      .setMaxLength(500)
  )
  const sourceNameInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('sourceName')
      .setLabel('Nom de la source (optionnel / Source name)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Rockstar Games, GTA Forums...')
      .setRequired(false)
      .setMaxLength(100)
  )

  modal.addComponents(titleInput, summaryInput, categoryInput, languageInput, sourceUrlInput, sourceNameInput)

  await interaction.showModal(modal)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news review — view a pending submission
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleReview(interaction: ChatInputCommandInteraction, guild: any): Promise<void> {
  if (!hasAnyRole(interaction.member as GuildMember, NEWS_MOD_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour reviewer des news / You do not have the required role to review news.',
      ephemeral: true,
    })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const submissionId = interaction.options.getString('id', true)
  const submission = await getNewsSubmission(submissionId)
  if (!submission || submission.guildId !== guild.id) {
    await interaction.editReply({ content: 'Soumission introuvable / Submission not found.' })
    return
  }

  const embed = new EmbedBuilder()
    .setTitle(`📝 Revue de soumission / Submission Review — ${submission.id}`)
    .setColor(0xffd700)
    .addFields(
      { name: 'Titre / Title', value: submission.title, inline: false },
      { name: 'Résumé / Summary', value: submission.summary, inline: false },
      { name: 'Catégorie / Category', value: submission.category, inline: true },
      { name: 'Statut / Status', value: submission.status, inline: true },
      { name: 'Soumis par / Submitted by', value: `<@${submission.submittedBy}>`, inline: true },
      { name: 'Créé le / Created', value: `<t:${Math.floor(submission.createdAt.getTime() / 1000)}:F>`, inline: true }
    )
    .setTimestamp(submission.createdAt)

  if (submission.sourceUrl) {
    embed.addFields({ name: 'Source URL', value: submission.sourceUrl, inline: false })
  }
  if (submission.sourceName) {
    embed.addFields({ name: 'Source', value: submission.sourceName, inline: true })
  }

  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news approve
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleApprove(
  interaction: ChatInputCommandInteraction,
  guild: any,
  member: GuildMember
): Promise<void> {
  if (!hasAnyRole(member, NEWS_MOD_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour approuver des news / You do not have the required role to approve news.',
      ephemeral: true,
    })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const submissionId = interaction.options.getString('id', true)
  const note = interaction.options.getString('note') || undefined

  try {
    const article = await approveNews(submissionId, interaction.user.id, note)

    // Notify in #news-review
    const reviewChannel = resolveChannel(guild, 'ch_news_review')
    if (reviewChannel && reviewChannel.isTextBased?.()) {
      const submission = await getNewsSubmission(submissionId)
      if (submission) {
        const staffRole = findRoleByName(guild.roles.cache, 'News Approver')
        await postNewsReview(reviewChannel as TextChannel | NewsChannel, {
          id: submission.id,
          title: submission.title,
          summary: submission.summary,
          category: submission.category,
          sourceUrl: submission.sourceUrl,
          sourceName: submission.sourceName,
          submittedBy: submission.submittedBy,
          createdAt: submission.createdAt,
        }, staffRole)
      }
    }

    await interaction.editReply({
      content: `Soumission approuvée — article créé : ${article.id} / Submission approved — article created: ${article.id}.`,
    })
  } catch (error) {
    await interaction.editReply({ content: `Échec de l’approbation / Approval failed: ${String(error)}` })
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news reject
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleReject(
  interaction: ChatInputCommandInteraction,
  member: GuildMember
): Promise<void> {
  if (!hasAnyRole(member, NEWS_MOD_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour rejeter des news / You do not have the required role to reject news.',
      ephemeral: true,
    })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const submissionId = interaction.options.getString('id', true)
  const note = interaction.options.getString('note') || undefined

  try {
    await rejectNews(submissionId, interaction.user.id, note)
    await interaction.editReply({ content: `Soumission rejetée / Submission rejected: ${submissionId}.` })
  } catch (error) {
    await interaction.editReply({ content: `Échec du rejet / Rejection failed: ${String(error)}` })
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news publish
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handlePublish(
  interaction: ChatInputCommandInteraction,
  guild: any,
  member: GuildMember
): Promise<void> {
  if (!hasAnyRole(member, NEWS_PUBLISH_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour publier des news / You do not have the required role to publish news.',
      ephemeral: true,
    })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const articleId = interaction.options.getString('id', true)

  try {
    const article = await getNewsArticle(articleId)
    if (!article || article.guildId !== guild.id) {
      await interaction.editReply({ content: 'Article introuvable / Article not found.' })
      return
    }
    if (article.status !== 'APPROVED') {
      await interaction.editReply({ content: `L’article n’est pas approuvé (statut: ${article.status}) / Article is not approved (status: ${article.status}).` })
      return
    }

    const newsChannel = resolveChannel(guild, 'ch_gta_news')
    if (!newsChannel || !newsChannel.isTextBased?.()) {
      await interaction.editReply({ content: 'Salon #gta-news introuvable / #gta-news channel not found.' })
      return
    }

    const newsPingRole = findRoleByName(guild.roles.cache, 'News Alerts')

    // Create the publication record with a placeholder message ID, then update with the real one
    await publishNews(articleId, interaction.user.id, newsChannel.id, 'pending')
    const embed = buildNewsPublishEmbed({
      id: article.id,
      title: article.title,
      summary: article.summary,
      category: article.category,
      confirmationStatus: article.confirmationStatus,
      authorId: article.authorId,
      sourceUrl: article.sourceUrl,
      publishedAt: article.publishedAt ?? new Date(),
    })
    const content = newsPingRole ? `<@&${newsPingRole.id}>` : undefined
    const message = await (newsChannel as TextChannel | NewsChannel).send({ content, embeds: [embed] })

    // Update publication with real message ID
    await db.newsPublication.update({
      where: { articleId },
      data: { messageId: message.id },
    })

    await interaction.editReply({
      content: `Article publié dans #gta-news / Article published in #gta-news: <@${article.authorId}> — ${article.title}`,
    })
  } catch (error) {
    await interaction.editReply({ content: `Échec de la publication / Publish failed: ${String(error)}` })
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news edit — opens a modal
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleEdit(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!hasAnyRole(interaction.member as GuildMember, NEWS_EDIT_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour éditer des news / You do not have the required role to edit news.',
      ephemeral: true,
    })
    return
  }

  const articleId = interaction.options.getString('id', true)

  const modal = new ModalBuilder()
    .setCustomId(`${NEWS_EDIT_MODAL_ID}:${articleId}`)
    .setTitle('Éditer une news / Edit News')

  const titleInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Titre / Title')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Nouveau titre (laisser vide pour ne pas changer)')
      .setRequired(false)
      .setMaxLength(20)
  )
  const summaryInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('summary')
      .setLabel('Résumé / Summary')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Nouveau résumé (laisser vide pour ne pas changer)')
      .setRequired(false)
      .setMaxLength(1000)
  )
  const categoryInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('category')
      .setLabel('Catégorie / Category')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('OFFICIAL, GAME_UPDATES, GTA_VI, COMMUNITY, INDUSTRY, UNCONFIRMED')
      .setRequired(false)
      .setMaxLength(20)
  )
  const confirmationInput = new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('confirmationStatus')
      .setLabel('Statut de confirmation / Confirmation Status')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('CONFIRMED ou UNCONFIRMED')
      .setRequired(false)
      .setMaxLength(20)
  )

  modal.addComponents(titleInput, summaryInput, categoryInput, confirmationInput)

  await interaction.showModal(modal)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news sources
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleSources(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!hasAnyRole(interaction.member as GuildMember, NEWS_MOD_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour gérer les sources / You do not have the required role to manage sources.',
      ephemeral: true,
    })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const sources = await listNewsSources()

  const embed = new EmbedBuilder()
    .setTitle('📡 Sources de news / News Sources')
    .setColor(0x00ffff)
    .setTimestamp()

  if (sources.length === 0) {
    embed.setDescription('Aucune source configurée / No sources configured.')
  } else {
    for (const s of sources) {
      embed.addFields({
        name: s.name,
        value: `Type: ${s.type}\nURL: ${s.url}\nActivé: ${s.enabled ? 'Oui' : 'Non'}\nAutorisé: ${s.allowlisted ? 'Oui' : 'Non'}`,
        inline: true,
      })
    }
  }

  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news history
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const articleId = interaction.options.getString('id', true)

  const article = await getNewsArticle(articleId)
  if (!article) {
    await interaction.editReply({ content: 'Article introuvable / Article not found.' })
    return
  }

  const revisions = await getNewsHistory(articleId)

  const embed = new EmbedBuilder()
    .setTitle(`📜 Historique des révisions / Revision History — ${article.title}`)
    .setColor(0x808080)
    .setTimestamp()

  if (revisions.length === 0) {
    embed.setDescription('Aucune révision / No revisions yet.')
  } else {
    for (const r of revisions) {
      embed.addFields({
        name: `${r.field} — <t:${Math.floor(r.changedAt.getTime() / 1000)}:R>`,
        value: `Avant: ${r.oldValue ?? '—'}\nAprès: ${r.newValue ?? '—'}\nPar: <@${r.changedBy}>`,
        inline: false,
      })
    }
  }

  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news archive
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleArchive(
  interaction: ChatInputCommandInteraction,
  member: GuildMember
): Promise<void> {
  if (!hasAnyRole(member, NEWS_MOD_ROLE_IDS)) {
    await interaction.reply({
      content: 'Vous n’avez pas le rôle requis pour archiver des news / You do not have the required role to archive news.',
      ephemeral: true,
    })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const articleId = interaction.options.getString('id', true)

  try {
    await archiveNews(articleId, interaction.user.id)
    await interaction.editReply({ content: `Article archivé / Article archived: ${articleId}.` })
  } catch (error) {
    await interaction.editReply({ content: `Échec de l’archivage / Archive failed: ${String(error)}` })
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Modal handler — news:submit and news:edit:<articleId>
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const newsSubmitModalCustomId = NEWS_SUBMIT_MODAL_ID
export const newsEditModalCustomId = NEWS_EDIT_MODAL_ID

export async function handleNewsSubmitModal(
  interaction: any,
  deps: { db: unknown; logger: typeof logger }
): Promise<void> {
  const customId = interaction.customId as string

  if (customId.startsWith(`${NEWS_EDIT_MODAL_ID}:`)) {
    await handleNewsEditModal(interaction, deps)
    return
  }

  // news:submit
  await interaction.deferReply({ ephemeral: true })

  const title = interaction.fields.getTextInputValue('title')
  const summary = interaction.fields.getTextInputValue('summary')
  const categoryRaw = interaction.fields.getTextInputValue('category')
  const languageRaw = interaction.fields.getTextInputValue('language')
  const sourceUrl = interaction.fields.getTextInputValue('sourceUrl') || undefined
  const sourceName = interaction.fields.getTextInputValue('sourceName') || undefined

  const categoryMap: Record<string, NewsCategory> = {
    official: 'OFFICIAL',
    game_updates: 'GAME_UPDATES',
    gta_vi: 'GTA_VI',
    community: 'COMMUNITY',
    industry: 'INDUSTRY',
    unconfirmed: 'UNCONFIRMED',
  }
  const category = categoryMap[categoryRaw.toLowerCase().trim().replace(/\s+/g, '_')]
  if (!category) {
    await interaction.editReply({
      content: 'Catégorie invalide. Utilisez: OFFICIAL, GAME_UPDATES, GTA_VI, COMMUNITY, INDUSTRY, UNCONFIRMED / Invalid category.',
    })
    return
  }

  const languageMap: Record<string, Language> = {
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

  const data: NewsSubmitData = {
    title,
    summary,
    category,
    sourceUrl,
    sourceName,
    language,
  }

  try {
    const submission = await submitNews(interaction.guildId!, interaction.user.id, data)

    // Notify staff in #news-review
    const reviewChannel = resolveChannel(interaction.guild!, 'ch_news_review')
    if (reviewChannel && reviewChannel.isTextBased?.()) {
      const staffRole = findRoleByName(interaction.guild!.roles.cache, 'News Approver')
      await postNewsReview(reviewChannel as TextChannel | NewsChannel, {
        id: submission.id,
        title: submission.title,
        summary: submission.summary,
        category: submission.category,
        sourceUrl: submission.sourceUrl,
        sourceName: submission.sourceName,
        submittedBy: submission.submittedBy,
        createdAt: submission.createdAt,
      }, staffRole as Role | undefined)
    }

    await interaction.editReply({
      content: `News soumise avec succès / News submitted successfully (ID: ${submission.id}). Elle sera examinée par l’équipe staff.`,
    })
  } catch (error) {
    deps.logger.error({ error: String(error) }, 'Failed to create news submission')
    await interaction.editReply({ content: 'Échec de la soumission de news / Failed to submit news.' })
  }
}

async function handleNewsEditModal(
  interaction: any,
  deps: { db: unknown; logger: typeof logger }
): Promise<void> {
  const customId = interaction.customId as string
  const articleId = customId.split(':')[2]

  await interaction.deferReply({ ephemeral: true })

  const title = interaction.fields.getTextInputValue('title') || undefined
  const summary = interaction.fields.getTextInputValue('summary') || undefined
  const categoryRaw = interaction.fields.getTextInputValue('category') || undefined
  const confirmationRaw = interaction.fields.getTextInputValue('confirmationStatus') || undefined

  const categoryMap: Record<string, NewsCategory> = {
    official: 'OFFICIAL',
    game_updates: 'GAME_UPDATES',
    gta_vi: 'GTA_VI',
    community: 'COMMUNITY',
    industry: 'INDUSTRY',
    unconfirmed: 'UNCONFIRMED',
  }
  const category = categoryRaw ? categoryMap[categoryRaw.toLowerCase().trim().replace(/\s+/g, '_')] : undefined
  if (categoryRaw && !category) {
    await interaction.editReply({
      content: 'Catégorie invalide / Invalid category.',
    })
    return
  }

  const confirmationMap: Record<string, ConfirmationStatus> = {
    confirmed: 'CONFIRMED',
    unconfirmed: 'UNCONFIRMED',
  }
  const confirmationStatus = confirmationRaw ? confirmationMap[confirmationRaw.toLowerCase().trim()] : undefined
  if (confirmationRaw && !confirmationStatus) {
    await interaction.editReply({
      content: 'Statut de confirmation invalide. Utilisez CONFIRMED ou UNCONFIRMED / Invalid confirmation status.',
    })
    return
  }

  const data = {
    ...(title !== undefined ? { title } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(confirmationStatus !== undefined ? { confirmationStatus } : {}),
  }

  try {
    const { article, revisions } = await editNews(articleId, interaction.user.id, data)
    await interaction.editReply({
      content: `Article édité / Article edited: ${article.id} — ${article.title} (${revisions.length} révision(s) / revision(s)).`,
    })
  } catch (error) {
    deps.logger.error({ error: String(error) }, 'Failed to edit news article')
    await interaction.editReply({ content: 'Échec de l’édition de l’article / Failed to edit article.' })
  }
}
