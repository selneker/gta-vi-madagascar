import Parser from 'rss-parser'
import { db } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { submitNews } from './news-center.js'
import type { Language, NewsCategory } from '@prisma/client'

const parser = new Parser()

/** Intervalle entre deux pollings des sources RSS (15 minutes par défaut). */
const POLL_INTERVAL_MS = 15 * 60 * 1000

/** Utilisateur système qui "soumet" les news automatiques (le bot lui-même). */
const BOT_SUBMITTER_ID = 'bot-system'

/**
 * Récupère les nouvelles d'une source RSS et crée des NewsSubmission pour
 * les articles inédits. Retourne le nombre de nouvelles soumissions créées.
 */
export async function pollSource(source: {
  id: string
  url: string
  name: string
  guildId: string | null
}): Promise<number> {
  if (!source.guildId) {
    logger.warn({ source: source.id, name: source.name }, 'RSS source has no guild; skipping')
    return 0
  }

  let feed
  try {
    feed = await parser.parseURL(source.url)
  } catch (error) {
    logger.error({ source: source.id, name: source.name, url: source.url, error: String(error) }, 'RSS fetch failed')
    return 0
  }

  let created = 0
  const lastItemId = source.id // fallback: use source id as lastItemId reference

  for (const item of feed.items.slice(0, 10)) {
    const title = item.title || 'Sans titre / Untitled'
    const summary = item.contentSnippet || item.summary || ''
    const sourceUrl = item.link || undefined
    const sourceName = source.name

    // Déduplication : vérifier si une soumission avec ce titre et cette URL existe déjà
    const existing = await db.newsSubmission.findFirst({
      where: {
        guildId: source.guildId,
        title,
        ...(sourceUrl ? { sourceUrl } : {}),
      },
    })
    if (existing) continue

    try {
      await submitNews(source.guildId, BOT_SUBMITTER_ID, {
        title,
        summary,
        category: 'UNCONFIRMED' as NewsCategory,
        sourceUrl,
        sourceName,
        language: 'FRENCH' as Language,
      })
      created++
      logger.info({ source: source.id, title, guild: source.guildId }, 'RSS item submitted as news')
    } catch (error) {
      logger.error({ source: source.id, title, error: String(error) }, 'Failed to create news submission from RSS')
    }
  }

  // Marquer la source comme vérifiée
  try {
    await db.newsSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastItemId: feed.items[0]?.guid ?? feed.items[0]?.link ?? lastItemId,
      },
    })
  } catch (error) {
    logger.error({ source: source.id, error: String(error) }, 'Failed to update RSS source lastCheckedAt')
  }

  if (created > 0) {
    logger.info({ source: source.id, name: source.name, created, guild: source.guildId }, 'RSS poll completed')
  }

  return created
}

/**
 * Sonde toutes les sources RSS activées de tous les serveurs.
 * À appeler périodiquement (ex: toutes les 15 minutes).
 */
export async function pollAllSources(): Promise<void> {
  const sources = await db.newsSource.findMany({
    where: { enabled: true, type: 'rss' },
  })

  logger.info({ count: sources.length }, 'RSS sources to poll')

  for (const source of sources) {
    await pollSource(source as { id: string; url: string; name: string; guildId: string | null })
    // Petite pause entre les sources pour éviter le rate-limiting
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

/**
 * Démarre le service de polling RSS en arrière-plan.
 * Retourne une fonction d'arrêt.
 */
export function startNewsRSSService(intervalMs: number = POLL_INTERVAL_MS): () => void {
  logger.info({ intervalMs }, 'Starting RSS news polling service')

  // Premier poll immédiatement (démarrage différé pour laisser le temps à la DB)
  setTimeout(() => pollAllSources().catch((e) => logger.error({ error: String(e) }, 'RSS initial poll failed')), 5000)

  const interval = setInterval(() => {
    pollAllSources().catch((e) => logger.error({ error: String(e) }, 'RSS poll cycle failed'))
  }, intervalMs)

  return () => {
    clearInterval(interval)
    logger.info('RSS news polling service stopped')
  }
}
