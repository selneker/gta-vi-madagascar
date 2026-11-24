import { Events, VoiceState, type Client } from 'discord.js'
import { logger } from '../lib/logger.js'

const LOBBY_CHANNEL_NAME = '🔴・CREATE YOUR LIVE ROOM'
const TEMP_CHANNEL_PREFIX = '🔴・Live de '
const DELETE_AFTER_EMPTY_MS = 5 * 60 * 1000 // 5 minutes

/** Map of lobby voice channel ID → set of temp channel IDs created from it. */
const tempChannelsByLobby = new Map<string, Set<string>>()

/** Timers for auto-deleting empty temp channels. */
const deleteTimers = new Map<string, NodeJS.Timeout>()

export function registerVoiceStateEvents(client: Client): void {
  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    try {
      await handleVoiceStateUpdate(oldState, newState, client)
    } catch (error) {
      logger.error({ error: String(error) }, 'Voice state update handler failed')
    }
  })
}

async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
  client: Client
): Promise<void> {
  const guild = newState.guild
  if (!guild) return

  const lobbyChannel = guild.channels.cache.find(
    (c: any) => c.type === 2 && c.name === LOBBY_CHANNEL_NAME
  ) as any
  if (!lobbyChannel) return

  const lobbyId = lobbyChannel.id

  // --- Member joined the lobby: create a temp room ---
  if (
    newState.channelId === lobbyId &&
    oldState.channelId !== lobbyId &&
    newState.member
  ) {
    await createTempVoiceRoom(newState.member, lobbyChannel, guild, client)
    return
  }

  // --- Member left a temp room: schedule deletion if empty ---
  if (oldState.channelId && tempChannelsByLobby.get(lobbyId)?.has(oldState.channelId)) {
    scheduleTempChannelDeletion(oldState.channelId, client)
  }
}

async function createTempVoiceRoom(
  member: any,
  lobbyChannel: any,
  guild: any,
  client: Client
): Promise<void> {
  const category = lobbyChannel.parent as any
  const channelName = `${TEMP_CHANNEL_PREFIX}${member.user.username}`

  const tempChannel = await guild.channels.create({
    name: channelName,
    type: 2, // GuildVoice
    parent: category,
    topic: `Salon vocal temporaire créé par ${member.user.username} / Temporary voice room created by ${member.user.username}`,
    reason: 'GTA VI MADAGASCAR — temporary live voice room',
  }) as any

  // Track the temp channel
  const lobbyId = lobbyChannel.id
  if (!tempChannelsByLobby.has(lobbyId)) tempChannelsByLobby.set(lobbyId, new Set())
  tempChannelsByLobby.get(lobbyId)!.add(tempChannel.id)

  // Move the member into the new room
  try {
    await member.voice.setChannel(tempChannel, 'Temporary live voice room created')
  } catch (error) {
    logger.error({ error: String(error), channel: tempChannel.id }, 'Failed to move member to temp voice room')
  }

  logger.info({ channel: tempChannel.id, user: member.user.id, guild: guild.id }, 'Temporary voice room created')

  // When the temp channel becomes empty, start the deletion timer
  tempChannel.on('voiceStateUpdate', (_oldState: VoiceState, newState: VoiceState) => {
    if (newState.channelId === tempChannel.id && newState.member) return // someone joined
    if (tempChannel.members.size === 0) {
      scheduleTempChannelDeletion(tempChannel.id, client)
    }
  })
}

function scheduleTempChannelDeletion(
  channelId: string,
  client: Client
): void {
  const existing = deleteTimers.get(channelId)
  if (existing) clearTimeout(existing)

  deleteTimers.set(
    channelId,
    setTimeout(async () => {
      deleteTimers.delete(channelId)

      let channel: any
      try {
        channel = await client.channels.fetch(channelId)
      } catch {
        return
      }
      if (!channel) return

      // Remove from tracking
      for (const channels of tempChannelsByLobby.values()) {
        if (channels.has(channelId)) {
          channels.delete(channelId)
          break
        }
      }

      // Verify it's empty before deleting
      if (channel.isVoiceBased() && channel.members.size > 0) return

      try {
        await channel.delete('Temporary voice room empty — auto-deleted')
        logger.info({ channel: channelId }, 'Temporary voice room deleted (empty)')
      } catch (error) {
        logger.error({ error: String(error), channel: channelId }, 'Failed to delete temp voice room')
      }
    }, DELETE_AFTER_EMPTY_MS)
  )
}

/** Expose for testing: clear tracking maps. */
export function resetTempChannelTracking(): void {
  tempChannelsByLobby.clear()
  for (const timer of deleteTimers.values()) clearTimeout(timer)
  deleteTimers.clear()
}

/** Expose tracked temp channels for testing. */
export function getTrackedTempChannels(): Map<string, Set<string>> {
  return new Map(tempChannelsByLobby)
}
