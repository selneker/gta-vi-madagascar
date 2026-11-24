import {
  ChannelType,
  Events,
  type Client,
  type Guild,
  type VoiceBasedChannel,
  type VoiceState,
} from 'discord.js'
import { logger } from '../lib/logger.js'
import { db } from '../lib/db.js'

/**
 * Join-to-Create public voice channels.
 *
 * Reuses the pre-existing lobby channel 🔴・CREATE YOUR LIVE ROOM (never recreated).
 * When a member joins it, a new PUBLIC N voice channel is created, the member is
 * moved into it, and the channel is deleted automatically when it becomes empty.
 */

/** The pre-existing Join-to-Create lobby. Never recreated by this module. */
const LOBBY_CHANNEL_NAME = '🔴・CREATE YOUR LIVE ROOM'

/** Name of an auto-created public voice channel: PUBLIC 1, PUBLIC 2, ... */
const publicChannelName = (n: number): string => `PUBLIC ${n}`

/** Permissions granted to @everyone in every PUBLIC channel (fully open). */
const publicPermissions = ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'USE_VAD', 'STREAM']

/** Delay before an empty PUBLIC channel is deleted (configurable constant). */
const deleteAfterEmptyMs = 5 * 60 * 1000 // 5 minutes

/** lobbyId => set of temp channel ids created from it. */
const tempChannelsByLobby = new Map<string, Set<string>>()

/** channelId => its PUBLIC number. */
const channelNumberById = new Map<string, number>()

/** channelId => lobby id it belongs to. */
const channelLobbyById = new Map<string, string>()

/** channelId => guild id it belongs to (used to delete the DB row). */
const channelGuildById = new Map<string, string>()

/** lobbyId => set of PUBLIC numbers currently in use. */
const usedNumbersByLobby = new Map<string, Set<number>>()

/** channelId => deletion timer. */
const deleteTimers = new Map<string, NodeJS.Timeout>()

/** Serializes PUBLIC channel creation so numbering stays atomic under concurrency. The absorbed
 * catch keeps the chain alive even if one creation fails, so a single failed creation never
 * blocks subsequent lobby joins. */
let createLock: Promise<void> = Promise.resolve()

function enqueueCreate<T>(task: () => Promise<T>): Promise<T> {
  const next = createLock.then(() => task())
  createLock = next.then(() => undefined, () => undefined)
  return next
}

function getLobbyChannel(guild: Guild): any {
  return guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildVoice && c.name === LOBBY_CHANNEL_NAME
  )
}

function nextFreeNumber(lobbyId: string): number {
  const used = usedNumbersByLobby.get(lobbyId) ?? new Set()
  let n = 1
  while (used.has(n)) n++
  return n
}

function takeNumber(lobbyId: string, number: number): void {
  let used = usedNumbersByLobby.get(lobbyId)
  if (!used) {
    used = new Set()
    usedNumbersByLobby.set(lobbyId, used)
  }
  used.add(number)
}

async function releaseTracking(channelId: string): Promise<void> {
  const lobbyId = channelLobbyById.get(channelId)
  const number = channelNumberById.get(channelId)
  const guildId = channelGuildById.get(channelId)
  channelLobbyById.delete(channelId)
  channelNumberById.delete(channelId)
  channelGuildById.delete(channelId)
  if (lobbyId !== undefined) {
    const channels = tempChannelsByLobby.get(lobbyId)
    if (channels) channels.delete(channelId)
    if (number !== undefined) {
      const used = usedNumbersByLobby.get(lobbyId)
      if (used) used.delete(number)
    }
  }

  // Supprime la ligne de base de données associée au salon.
  if (guildId !== undefined) {
    try {
      await db.channelConfiguration.delete({
        where: { guildId_channelId: { guildId, channelId } },
      })
    } catch (error) {
      logger.error(
        { error: String(error), channel: channelId, guild: guildId },
        'Failed to delete public voice channel from database'
      )
    }
  }
}

function clearDeletionTimer(channelId: string): void {
  const existing = deleteTimers.get(channelId)
  if (existing) {
    clearTimeout(existing)
    deleteTimers.delete(channelId)
  }
}

/**
 * Create a PUBLIC N voice channel next to the lobby, open it to everyone,
 * register it, move the member in, and start watching it for auto-deletion.
 */
export async function createPublicVoiceChannel(
  member: any,
  lobbyChannel: any,
  guild: Guild,
  client: Client
): Promise<void> {
  if (member.user.bot) return

  await enqueueCreate(async () => {
    const lobbyId = lobbyChannel.id
    const category = lobbyChannel.parent as any
    const number = nextFreeNumber(lobbyId)
    const name = publicChannelName(number)

    const everyoneRole = guild.roles.everyone
    const overwrites = [
      { id: everyoneRole.id, allow: publicPermissions, deny: [] },
    ]

    const tempChannel = (await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: category,
      permissionOverwrites: overwrites as any,
      reason: 'GTA VI MADAGASCAR — public dynamic voice channel',
    })) as VoiceBasedChannel

    takeNumber(lobbyId, number)
    channelNumberById.set(tempChannel.id, number)
    channelLobbyById.set(tempChannel.id, lobbyId)
    channelGuildById.set(tempChannel.id, guild.id)
    if (!tempChannelsByLobby.has(lobbyId)) tempChannelsByLobby.set(lobbyId, new Set())
    tempChannelsByLobby.get(lobbyId)!.add(tempChannel.id)

    // Register in the database so the channel survives a restart inventory.
    try {
      await db.channelConfiguration.create({
        data: {
          guildId: guild.id,
          channelId: tempChannel.id,
          categoryId: category?.id ?? null,
          name: tempChannel.name,
          type: 'voice',
          position: 0,
          nsfw: false,
        },
      })
    } catch (error) {
      logger.error(
        { error: String(error), channel: tempChannel.id, guild: guild.id },
        'Failed to register public voice channel in database'
      )
    }

    attachEmptyWatcher(tempChannel, client)

    try {
      await member.voice.setChannel(tempChannel, 'Public voice channel created')
    } catch (error) {
      logger.error(
        { error: String(error), channel: tempChannel.id, user: member.user.id },
        'Failed to move member to public voice channel'
      )
    }

    logger.info(
      { channel: tempChannel.id, number, user: member.user.id, guild: guild.id },
      'Public voice channel created'
    )
  })
}

/** Attach the empty-check watcher to a PUBLIC channel. */
function attachEmptyWatcher(channel: any, client: Client): void {
  channel.on('voiceStateUpdate', (_oldState: VoiceState, newState: VoiceState) => {
    if (newState.channelId === channel.id && newState.member) {
      // Someone joined: cancel any pending deletion.
      clearDeletionTimer(channel.id)
      return
    }
    if (channel.members.size === 0) {
      scheduleTempChannelDeletion(channel.id, client)
    }
  })
}

export function scheduleTempChannelDeletion(channelId: string, client: Client): void {
  clearDeletionTimer(channelId)

  deleteTimers.set(
    channelId,
    setTimeout(async () => {
      deleteTimers.delete(channelId)

      let channel: VoiceBasedChannel | null
      try {
        channel = (await client.channels.fetch(channelId)) as VoiceBasedChannel | null
      } catch {
        await releaseTracking(channelId)
        return
      }
      if (!channel) {
        await releaseTracking(channelId)
        return
      }

      // Still occupied: keep tracking, the watcher will re-schedule when empty.
      if (channel.members.size > 0) return

      try {
        await channel.delete('Public voice channel empty — auto-deleted')
        await releaseTracking(channelId)
        logger.info({ channel: channelId }, 'Public voice channel deleted (empty)')
      } catch (error) {
        logger.error({ error: String(error), channel: channelId }, 'Failed to delete public voice channel')
        // Keep tracking: the watcher re-schedules deletion when it empties again.
      }
    }, deleteAfterEmptyMs)
  )
}

/**
 * Re-adopt PUBLIC channels that already exist after a bot restart, so tracking,
 * numbering and auto-deletion timers are rebuilt without Discord calls.
 */
export function adoptExistingPublicChannels(guild: Guild, client: Client): void {
  const lobbyChannel = getLobbyChannel(guild) as any
  if (!lobbyChannel) return
  const category = lobbyChannel.parent as any
  if (!category) return
  const lobbyId = lobbyChannel.id

  for (const channel of category.children.cache.values()) {
    if (!channel.isVoiceBased()) continue
    const match = channel.name.match(/^PUBLIC (\d+)$/)
    if (!match) continue
    const channelId = channel.id
    const number = parseInt(match[1], 10)
    if (tempChannelsByLobby.get(lobbyId)?.has(channelId)) continue

    takeNumber(lobbyId, number)
    channelNumberById.set(channelId, number)
    channelLobbyById.set(channelId, lobbyId)
    channelGuildById.set(channelId, guild.id)
    if (!tempChannelsByLobby.has(lobbyId)) tempChannelsByLobby.set(lobbyId, new Set())
    tempChannelsByLobby.get(lobbyId)!.add(channelId)
    attachEmptyWatcher(channel as VoiceBasedChannel, client)
    if (channel.members.size === 0) scheduleTempChannelDeletion(channelId, client)

    logger.info(
      { channel: channelId, number, guild: guild.id },
      'Existing public voice channel re-adopted after restart'
    )
  }
}

async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
  client: Client
): Promise<void> {
  const guild = newState.guild
  if (!guild) return

  const lobbyChannel = getLobbyChannel(guild) as any
  if (!lobbyChannel) return
  const lobbyId = lobbyChannel.id

  // --- Member joined the lobby: create a public channel ---
  if (
    newState.channelId === lobbyId &&
    oldState.channelId !== lobbyId &&
    newState.member
  ) {
    await createPublicVoiceChannel(newState.member, lobbyChannel, guild, client)
    return
  }

  // --- Member left a tracked PUBLIC channel: schedule deletion if empty ---
  if (oldState.channelId && tempChannelsByLobby.get(lobbyId)?.has(oldState.channelId)) {
    scheduleTempChannelDeletion(oldState.channelId, client)
  }
}

export function registerVoiceStateEvents(client: Client): void {
  client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
    try {
      void handleVoiceStateUpdate(oldState, newState, client)
    } catch (error) {
      logger.error({ error: String(error) }, 'Voice state update handler failed')
    }
  })

  client.on(Events.ClientReady, (c) => {
    for (const guild of c.guilds.cache.values()) {
      try {
        adoptExistingPublicChannels(guild, c)
      } catch (error) {
        logger.error({ error: String(error), guild: guild.id }, 'Failed to adopt existing public voice channels')
      }
    }
  })
}

/** Clear all in-memory tracking and pending timers (testing only). */
export function resetTempChannelTracking(): void {
  tempChannelsByLobby.clear()
  channelNumberById.clear()
  channelLobbyById.clear()
  channelGuildById.clear()
  usedNumbersByLobby.clear()
  for (const timer of deleteTimers.values()) clearTimeout(timer)
  deleteTimers.clear()
}

/** lobbyId => set of tracked temp channel ids. */
export function getTrackedTempChannels(): Map<string, Set<string>> {
  return new Map(tempChannelsByLobby)
}

/** channelId => its PUBLIC number. */
export function getChannelNumbers(): Map<string, number> {
  return new Map(channelNumberById)
}

/** lobbyId => set of PUBLIC numbers currently in use. */
export function getUsedNumbers(lobbyId: string): Set<number> {
  return new Set(usedNumbersByLobby.get(lobbyId) ?? [])
}
