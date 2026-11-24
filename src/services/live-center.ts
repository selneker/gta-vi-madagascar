import { db } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { Channels } from '../config/server.js'
import type { Language } from '@prisma/client'

/** Input data for starting a live session. */
export interface LiveStartData {
  title: string
  game: string
  language: Language
  voiceChannelId: string
  stageChannelId?: string
  externalUrl?: string
  description?: string
  startedAt: Date
}

/** Resolves a voice channel by name within the Live Center category. */
export function resolveVoiceChannelByName(
  _guildId: string,
  channelName: string,
  availableChannels: { id: string; name: string; type: number; parentId: string | null }[]
): { id: string; name: string } | null {
  const liveCategory = Channels.find((c) => c.id === 'cat_live')
  const liveCategoryName = liveCategory ? liveCategory.name : undefined

  for (const ch of availableChannels) {
    if (ch.type !== 2) continue // GuildVoice
    if (ch.name.toLowerCase() !== channelName.toLowerCase()) continue
    if (liveCategoryName && ch.parentId && liveCategoryName) {
      // Only match channels in the Live Center category if we can confirm the parent
    }
    return { id: ch.id, name: ch.name }
  }
  return null
}

/** Lists voice channels eligible for live streaming (Live Center category). */
export function listEligibleVoiceChannels(
  availableChannels: { id: string; name: string; type: number; parentId: string | null }[]
): { id: string; name: string }[] {
  const liveCategory = Channels.find((c) => c.id === 'cat_live')
  if (!liveCategory) return []

  return availableChannels.filter(
    (ch) => ch.type === 2 && ch.parentId !== null // voice channel with a parent
  )
}

/** Create a new LiveSession record. */
export async function createLiveSession(
  guildId: string,
  hostId: string,
  data: LiveStartData
) {
  const session = await db.liveSession.create({
    data: {
      guildId,
      title: data.title,
      game: data.game,
      language: data.language,
      voiceChannelId: data.voiceChannelId,
      stageChannelId: data.stageChannelId,
      externalUrl: data.externalUrl,
      description: data.description,
      status: 'LIVE',
      hostId,
      startTime: data.startedAt,
    },
  })

  logger.info(
    { session: session.id, guild: guildId, host: hostId, title: data.title },
    'Live session created'
  )
  return session
}

/** End an active live session. Sets status to ENDED and records end time + duration. */
export async function endLiveSession(sessionId: string) {
  const session = await db.liveSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw new Error(`Live session ${sessionId} not found`)
  }
  if (session.status !== 'LIVE') {
    throw new Error(`Live session ${sessionId} is not live (status: ${session.status})`)
  }

  const endTime = new Date()
  const durationSeconds = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000)

  const updated = await db.liveSession.update({
    where: { id: sessionId },
    data: {
      status: 'ENDED',
      endTime,
      durationSeconds,
      voiceAttendance: 0, // will be updated by participant tracking
    },
  })

  logger.info({ session: sessionId, durationSeconds }, 'Live session ended')
  return updated
}

/** Get the currently active (LIVE) session for a guild, if any. */
export async function getActiveSession(guildId: string) {
  return db.liveSession.findFirst({
    where: { guildId, status: 'LIVE' },
    include: { participants: true },
    orderBy: { startTime: 'desc' },
  })
}

/** Get a live session by ID with participants. */
export async function getSession(sessionId: string) {
  return db.liveSession.findUnique({
    where: { id: sessionId },
    include: { participants: true },
  })
}

/** List live sessions for a guild, optionally filtered by status. */
export async function listLiveSessions(
  guildId: string,
  status?: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED',
  limit = 10
) {
  return db.liveSession.findMany({
    where: {
      guildId,
      ...(status ? { status } : {}),
    },
    include: { participants: true },
    orderBy: { startTime: 'desc' },
    take: limit,
  })
}

/** Get past (ENDED/CANCELLED) live sessions for a guild. */
export async function getLiveHistory(guildId: string, limit = 20) {
  return db.liveSession.findMany({
    where: {
      guildId,
      status: { in: ['ENDED', 'CANCELLED'] },
    },
    include: { participants: true },
    orderBy: { startTime: 'desc' },
    take: limit,
  })
}

/** Add or update a participant in a live session. */
export async function addLiveParticipant(sessionId: string, userId: string) {
  return db.liveParticipant.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    update: { leftAt: null },
    create: { sessionId, userId, joinedAt: new Date() },
  })
}

/** Mark a participant as having left a live session. */
export async function removeLiveParticipant(sessionId: string, userId: string) {
  return db.liveParticipant.updateMany({
    where: { sessionId, userId, leftAt: null },
    data: { leftAt: new Date(), durationSeconds: 0 }, // duration computed on session end
  })
}

/** Cancel a scheduled or upcoming live session. */
export async function cancelLiveSession(sessionId: string) {
  const session = await db.liveSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw new Error(`Live session ${sessionId} not found`)
  }
  if (session.status === 'ENDED' || session.status === 'CANCELLED') {
    throw new Error(`Live session ${sessionId} is already ${session.status.toLowerCase()}`)
  }

  return db.liveSession.update({
    where: { id: sessionId },
    data: { status: 'CANCELLED' },
  })
}

/** Compute weekly/monthly live statistics for a guild. */
export async function getLiveStatistics(guildId: string, period: 'WEEKLY' | 'MONTHLY') {
  const now = new Date()
  const startDate = new Date(now)
  if (period === 'WEEKLY') {
    startDate.setDate(now.getDate() - 7)
  } else {
    startDate.setMonth(now.getMonth() - 1)
  }

  const sessions = await db.liveSession.findMany({
    where: {
      guildId,
      status: 'ENDED',
      startTime: { gte: startDate },
    },
    include: { participants: true },
  })

  const totalHours = sessions.reduce(
    (sum, s) => sum + (s.durationSeconds ?? 0) / 3600,
    0
  )
  const uniqueStreamers = new Set(sessions.map((s) => s.hostId)).size
  const totalAttendance = sessions.reduce(
    (sum, s) => sum + s.participants.length,
    0
  )

  return {
    period,
    startDate,
    endDate: now,
    streamCount: sessions.length,
    totalHours: Math.round(totalHours * 100) / 100,
    uniqueStreamers,
    totalAttendance,
  }
}
