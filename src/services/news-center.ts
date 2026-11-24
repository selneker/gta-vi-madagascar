import { db } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { newsFingerprint } from '../lib/dedupe.js'
import type { Language, NewsCategory, NewsStatus, ConfirmationStatus } from '@prisma/client'

/** Input data for submitting a news article. */
export interface NewsSubmitData {
  title: string
  summary: string
  category: NewsCategory
  sourceUrl?: string
  sourceName?: string
  language: Language
}

/** Input data for editing a news article. */
export interface NewsEditData {
  title?: string
  summary?: string
  category?: NewsCategory
  confirmationStatus?: ConfirmationStatus
}

/** Submit a news article (creates a NewsSubmission in PENDING status). */
export async function submitNews(
  guildId: string,
  submittedBy: string,
  data: NewsSubmitData
) {
  const fingerprint = newsFingerprint(data.title, data.sourceUrl)

  const submission = await db.newsSubmission.create({
    data: {
      guildId,
      title: data.title,
      summary: data.summary,
      category: data.category,
      sourceUrl: data.sourceUrl,
      sourceName: data.sourceName,
      submittedBy,
      status: 'PENDING',
    },
  })

  logger.info(
    { submission: submission.id, guild: guildId, submittedBy, title: data.title, fingerprint },
    'News submission created'
  )
  return submission
}

/** Get a pending news submission by ID. */
export async function getNewsSubmission(submissionId: string) {
  return db.newsSubmission.findUnique({
    where: { id: submissionId },
  })
}

/** List pending news submissions for a guild. */
export async function listPendingSubmissions(guildId: string, limit = 10) {
  return db.newsSubmission.findMany({
    where: { guildId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/** Approve a news submission: creates a NewsArticle in APPROVED status. */
export async function approveNews(
  submissionId: string,
  approverId: string,
  reviewNote?: string
) {
  const submission = await db.newsSubmission.findUnique({
    where: { id: submissionId },
  })
  if (!submission) {
    throw new Error(`News submission ${submissionId} not found`)
  }
  if (submission.status !== 'PENDING') {
    throw new Error(`News submission ${submissionId} is not pending (status: ${submission.status})`)
  }

  const article = await db.newsArticle.create({
    data: {
      guildId: submission.guildId,
      title: submission.title,
      summary: submission.summary,
      category: submission.category,
      sourceUrl: submission.sourceUrl,
      language: 'FRENCH', // default language; can be edited later
      authorId: submission.submittedBy,
      status: 'APPROVED',
      confirmationStatus: 'UNCONFIRMED',
    },
  })

  await db.newsSubmission.update({
    where: { id: submissionId },
    data: { status: 'APPROVED', reviewerId: approverId, reviewedAt: new Date() },
  })

  await db.newsApproval.create({
    data: {
      guildId: submission.guildId,
      targetId: article.id,
      targetType: 'NewsArticle',
      approverId,
      status: 'APPROVED',
      comment: reviewNote,
    },
  })

  logger.info(
    { article: article.id, submission: submissionId, approver: approverId },
    'News submission approved'
  )
  return article
}

/** Reject a news submission. */
export async function rejectNews(
  submissionId: string,
  approverId: string,
  reviewNote?: string
) {
  const submission = await db.newsSubmission.findUnique({
    where: { id: submissionId },
  })
  if (!submission) {
    throw new Error(`News submission ${submissionId} not found`)
  }
  if (submission.status !== 'PENDING') {
    throw new Error(`News submission ${submissionId} is not pending (status: ${submission.status})`)
  }

  await db.newsSubmission.update({
    where: { id: submissionId },
    data: { status: 'REJECTED', reviewerId: approverId, reviewedAt: new Date(), reviewNote },
  })

  await db.newsApproval.create({
    data: {
      guildId: submission.guildId,
      targetId: submissionId,
      targetType: 'NewsSubmission',
      approverId,
      status: 'REJECTED',
      comment: reviewNote,
    },
  })

  logger.info(
    { submission: submissionId, approver: approverId },
    'News submission rejected'
  )
}

/** Publish an approved article to the news channel. Returns the article with publication record. */
export async function publishNews(
  articleId: string,
  publisherId: string,
  channelId: string,
  messageId: string
) {
  const article = await db.newsArticle.findUnique({
    where: { id: articleId },
  })
  if (!article) {
    throw new Error(`News article ${articleId} not found`)
  }
  if (article.status !== 'APPROVED') {
    throw new Error(`News article ${articleId} is not approved (status: ${article.status})`)
  }

  const now = new Date()

  const updated = await db.newsArticle.update({
    where: { id: articleId },
    data: {
      status: 'PUBLISHED',
      publishedAt: now,
      publisherId,
      announcementChannelId: channelId,
      announcementMessageId: messageId,
    },
  })

  await db.newsPublication.create({
    data: {
      articleId,
      guildId: article.guildId,
      channelId,
      messageId,
      publishedBy: publisherId,
    },
  })

  logger.info(
    { article: articleId, publisher: publisherId, channel: channelId, message: messageId },
    'News article published'
  )
  return updated
}

/** Edit an article, recording revisions for changed fields. */
export async function editNews(
  articleId: string,
  editorId: string,
  data: NewsEditData
) {
  const article = await db.newsArticle.findUnique({
    where: { id: articleId },
  })
  if (!article) {
    throw new Error(`News article ${articleId} not found`)
  }

  const revisions: Array<{ articleId: string; field: string; oldValue: string | null; newValue: string | null; changedBy: string }> = []

  const updateData: Record<string, unknown> = {}

  if (data.title !== undefined && data.title !== article.title) {
    revisions.push({ articleId, field: 'title', oldValue: article.title, newValue: data.title, changedBy: editorId })
    updateData.title = data.title
  }
  if (data.summary !== undefined && data.summary !== article.summary) {
    revisions.push({ articleId, field: 'summary', oldValue: article.summary, newValue: data.summary, changedBy: editorId })
    updateData.summary = data.summary
  }
  if (data.category !== undefined && data.category !== article.category) {
    revisions.push({ articleId, field: 'category', oldValue: String(article.category), newValue: String(data.category), changedBy: editorId })
    updateData.category = data.category
  }
  if (data.confirmationStatus !== undefined && data.confirmationStatus !== article.confirmationStatus) {
    revisions.push({ articleId, field: 'confirmationStatus', oldValue: String(article.confirmationStatus), newValue: String(data.confirmationStatus), changedBy: editorId })
    updateData.confirmationStatus = data.confirmationStatus
  }

  if (revisions.length === 0) {
    return { article, revisions: [] as const }
  }

  const updated = await db.$transaction([
    db.newsArticle.update({
      where: { id: articleId },
      data: updateData,
    }),
    ...revisions.map((r) => db.newsRevision.create({ data: r })),
  ])

  logger.info(
    { article: articleId, editor: editorId, revisions: revisions.length },
    'News article edited'
  )
  return { article: updated[0], revisions: updated.slice(1) as unknown as Array<{ id: string; field: string; oldValue: string | null; newValue: string | null; changedBy: string; changedAt: Date }> }
}

/** Archive a published article. */
export async function archiveNews(articleId: string, archiverId: string) {
  const article = await db.newsArticle.findUnique({
    where: { id: articleId },
  })
  if (!article) {
    throw new Error(`News article ${articleId} not found`)
  }
  if (article.status === 'ARCHIVED') {
    throw new Error(`News article ${articleId} is already archived`)
  }

  const updated = await db.newsArticle.update({
    where: { id: articleId },
    data: { status: 'ARCHIVED' },
  })

  await db.auditLog.create({
    data: {
      guildId: article.guildId,
      actorId: archiverId,
      action: 'NEWS_ARCHIVED',
      targetId: articleId,
      targetType: 'NewsArticle',
    },
  })

  logger.info({ article: articleId, archiver: archiverId }, 'News article archived')
  return updated
}

/** Get an article by ID with revisions and publication. */
export async function getNewsArticle(articleId: string) {
  return db.newsArticle.findUnique({
    where: { id: articleId },
    include: { revisions: { orderBy: { changedAt: 'desc' } }, publication: true },
  })
}

/** List articles for a guild, optionally filtered by status. */
export async function listNewsArticles(
  guildId: string,
  status?: NewsStatus,
  limit = 10
) {
  return db.newsArticle.findMany({
    where: {
      guildId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/** Get revision history for an article. */
export async function getNewsHistory(articleId: string) {
  return db.newsRevision.findMany({
    where: { articleId },
    orderBy: { changedAt: 'desc' },
  })
}

/** List news sources for a guild. */
export async function listNewsSources(guildId?: string) {
  return db.newsSource.findMany({
    where: guildId ? { guildId } : {},
    orderBy: { name: 'asc' },
  })
}

/** Create or update a news source by URL. */
export async function upsertNewsSource(data: {
  guildId?: string
  name: string
  type: string
  url: string
  allowlisted?: boolean
  enabled?: boolean
}) {
  const existing = await db.newsSource.findFirst({ where: { url: data.url } })
  if (existing) {
    return db.newsSource.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        type: data.type,
        allowlisted: data.allowlisted ?? true,
        enabled: data.enabled ?? true,
        guildId: data.guildId,
      },
    })
  }
  return db.newsSource.create({
    data: {
      guildId: data.guildId,
      name: data.name,
      type: data.type,
      url: data.url,
      allowlisted: data.allowlisted ?? true,
      enabled: data.enabled ?? true,
    },
  })
}
