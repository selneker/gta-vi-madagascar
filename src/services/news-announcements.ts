import { EmbedBuilder } from 'discord.js'
import type { TextChannel, NewsChannel, Role } from 'discord.js'

/** Build the embed for a published news article posted to #gta-news. */
export function buildNewsPublishEmbed(article: {
  id: string
  title: string
  summary: string
  category: string
  confirmationStatus: string
  authorId: string
  sourceUrl?: string | null
  sourceName?: string | null
  publishedAt: Date
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📰 ${article.title}`)
    .setDescription(article.summary)
    .setColor(0x00ffff)
    .setTimestamp(article.publishedAt)
    .addFields(
      { name: 'Catégorie / Category', value: article.category, inline: true },
      { name: 'Confirmation', value: article.confirmationStatus, inline: true },
      { name: 'Auteur / Author', value: `<@${article.authorId}>`, inline: true }
    )

  if (article.sourceUrl) {
    embed.addFields({ name: 'Source', value: article.sourceUrl, inline: false })
  }

  embed.setFooter({ text: `Article ID: ${article.id}` })
  return embed
}

/** Build the embed for a pending submission review in #news-review. */
export function buildNewsReviewEmbed(submission: {
  id: string
  title: string
  summary: string
  category: string
  sourceUrl?: string | null
  sourceName?: string | null
  submittedBy: string
  createdAt: Date
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📝 Nouvelle soumission de news / New News Submission`)
    .setDescription(submission.summary)
    .setColor(0xffd700)
    .setTimestamp(submission.createdAt)
    .addFields(
      { name: 'Titre / Title', value: submission.title, inline: false },
      { name: 'Soumis par / Submitted by', value: `<@${submission.submittedBy}>`, inline: true },
      { name: 'Catégorie / Category', value: submission.category, inline: true },
      { name: 'ID', value: submission.id, inline: true }
    )

  if (submission.sourceUrl) {
    embed.addFields({ name: 'Source URL', value: submission.sourceUrl, inline: false })
  }
  if (submission.sourceName) {
    embed.addFields({ name: 'Source', value: submission.sourceName, inline: true })
  }

  embed.setFooter({ text: `Utilisez /news approve ou /news reject avec l'ID ci-dessus` })
  return embed
}

/** Post a published article to the news channel. */
export async function postNewsPublish(
  channel: TextChannel | NewsChannel,
  article: {
    id: string
    title: string
    summary: string
    category: string
    confirmationStatus: string
    authorId: string
    sourceUrl?: string | null
    publishedAt: Date
  },
  newsPingRole: Role | undefined
): Promise<void> {
  const embed = buildNewsPublishEmbed(article)
  const content = newsPingRole ? `<@&${newsPingRole.id}>` : undefined
  await channel.send({ content, embeds: [embed] })
}

/** Post a submission review notification to #news-review. */
export async function postNewsReview(
  channel: TextChannel | NewsChannel,
  submission: {
    id: string
    title: string
    summary: string
    category: string
    sourceUrl?: string | null
    sourceName?: string | null
    submittedBy: string
    createdAt: Date
  },
  staffPingRole: Role | undefined
): Promise<void> {
  const embed = buildNewsReviewEmbed(submission)
  const content = staffPingRole ? `<@&${staffPingRole.id}>` : undefined
  await channel.send({ content, embeds: [embed] })
}
