import { db } from '../lib/db.js'
import { logger } from '../lib/logger.js'

/** Award XP to a member, recording the transaction. Returns the updated profile. */
export async function awardXp(userId: string, guildId: string, amount: number, reason: string, source: string) {
  const profile = await db.memberProfile.upsert({
    where: { userId },
    create: { userId, guildId, xp: amount, level: 1 },
    update: { xp: { increment: amount } },
  })

  await db.xPTransaction.create({
    data: { userId, guildId, amount, reason, source },
  })

  const level = Math.floor(profile.xp / 500) + 1
  if (level > profile.level) {
    await db.memberProfile.update({
      where: { userId },
      data: { level },
    })
  }

  logger.info({ userId, guildId, amount, reason, source }, 'XP awarded')
  return { profile, leveledUp: level > profile.level }
}

/** Get a member's profile with recent XP transactions. */
export async function getProfile(userId: string, guildId: string) {
  const profile = await db.memberProfile.findUnique({
    where: { userId },
    include: { xpTransactions: { orderBy: { createdAt: 'desc' }, take: 5 } },
  })
  if (!profile || profile.guildId !== guildId) return null
  return profile
}

/** Create an event. */
export async function createEvent(guildId: string, createdBy: string, data: {
  title: string
  description?: string
  type: string
  scheduledStart: Date
  scheduledEnd: Date
  location?: string
}) {
  const event = await db.event.create({
    data: {
      guildId,
      createdBy,
      title: data.title,
      description: data.description,
      type: data.type as any,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      location: data.location,
    },
  })
  logger.info({ event: event.id, guild: guildId, createdBy }, 'Event created')
  return event
}

/** List upcoming events for a guild. */
export async function listEvents(guildId: string, limit = 10) {
  return db.event.findMany({
    where: { guildId, status: 'SCHEDULED' },
    orderBy: { scheduledStart: 'asc' },
    take: limit,
  })
}

/** Register a user for an event. */
export async function registerEvent(eventId: string, userId: string) {
  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) throw new Error(`Event ${eventId} not found`)
  return db.eventParticipant.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: { status: 'REGISTERED' },
    create: { eventId, userId, status: 'REGISTERED' },
  })
}

/** Create a ticket. */
export async function createTicket(guildId: string, userId: string, channelId: string, type: string) {
  const ticket = await db.ticket.create({
    data: { guildId, userId, channelId, type: type as any },
  })
  logger.info({ ticket: ticket.id, guild: guildId, user: userId, type }, 'Ticket created')
  return ticket
}

/** Close a ticket. */
export async function closeTicket(channelId: string, closedBy: string) {
  const ticket = await db.ticket.findUnique({ where: { channelId } })
  if (!ticket) throw new Error(`Ticket for channel ${channelId} not found`)
  if (ticket.status === 'CLOSED') throw new Error(`Ticket ${ticket.id} is already closed`)
  return db.ticket.update({
    where: { id: ticket.id },
    data: { status: 'CLOSED', closedAt: new Date(), closedBy },
  })
}

/** Submit a suggestion. */
export async function submitSuggestion(guildId: string, userId: string, title: string, description: string) {
  // Suggestions are posted as messages in #suggestions; we just log them here.
  logger.info({ guild: guildId, user: userId, title, description }, 'Suggestion submitted')
  return { id: `sugg-${Date.now()}`, title, description, status: 'OPEN' }
}
