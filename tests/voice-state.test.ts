import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adoptExistingPublicChannels,
  createPublicVoiceChannel,
  getChannelNumbers,
  getUsedNumbers,
  getTrackedTempChannels,
  resetTempChannelTracking,
  scheduleTempChannelDeletion,
} from '@/src/events/voice-state.js'
import { db } from '@/src/lib/db.js'

vi.mock('@/src/lib/db.js', () => ({
  db: {
    channelConfiguration: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

const mockedDb = db as unknown as {
  channelConfiguration: { create: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }
}

function makeMember(userId = 'user-1', bot = false) {
  return {
    user: { id: userId, bot },
    voice: { setChannel: vi.fn(async () => {}) },
  } as any
}

function makeClient(fetchResult: any = null) {
  return {
    channels: { fetch: vi.fn(async () => fetchResult) },
  } as any
}

/** Builds a guild whose lobby is 🔴・CREATE YOUR LIVE ROOM. */
function makeGuildAndLobby() {
  let channelCounter = 0
  const created: any[] = []
  const lobby = {
    id: 'lobby-1',
    name: '🔴・CREATE YOUR LIVE ROOM',
    type: 2,
    isVoiceBased: () => true,
    parent: { id: 'cat-1', children: { cache: new Map<string, any>() } },
  }
  lobby.parent.children.cache.set(lobby.id, lobby)

  const guild = {
    id: 'guild-1',
    roles: { everyone: { id: 'role-everyone' } },
    channels: {
      cache: {
        find: (fn: any) => {
          if (fn(lobby)) return lobby
          return created.find(fn) ?? undefined
        },
      },
      create: vi.fn(async (opts: any) => {
        const id = `vc-${++channelCounter}`
        const ch: any = {
          id,
          name: opts.name,
          members: { size: 0 },
          delete: vi.fn(async () => {}),
          on: vi.fn(),
          isVoiceBased: () => true,
        }
        created.push(ch)
        return ch
      }),
    },
  }
  return { guild, lobby, created, channelCount: () => channelCounter }
}

beforeEach(() => {
  resetTempChannelTracking()
  mockedDb.channelConfiguration.create.mockClear()
  mockedDb.channelConfiguration.delete.mockClear()
})

afterEach(() => {
  resetTempChannelTracking()
  vi.useRealTimers()
})

describe('createPublicVoiceChannel', () => {
  it('creates PUBLIC 1 then PUBLIC 2 and moves the member in', async () => {
    const { guild, lobby } = makeGuildAndLobby()
    const m1 = makeMember('u1')
    const m2 = makeMember('u2')

    await createPublicVoiceChannel(m1, lobby, guild, makeClient())
    await createPublicVoiceChannel(m2, lobby, guild, makeClient())

    const numbers = [...getChannelNumbers().values()].sort((a, b) => a - b)
    expect(numbers).toEqual([1, 2])
    const names = guild.channels.create.mock.calls.map((c: any) => c[0].name)
    expect(names).toContain('PUBLIC 1')
    expect(names).toContain('PUBLIC 2')
    expect(m1.voice.setChannel).toHaveBeenCalled()
    expect(m2.voice.setChannel).toHaveBeenCalled()
  })

  it('assigns unique numbers when several members join simultaneously', async () => {
    const { guild, lobby } = makeGuildAndLobby()
    const members = ['u1', 'u2', 'u3', 'u4'].map((id) => makeMember(id, false))

    await Promise.all(members.map((m) => createPublicVoiceChannel(m, lobby, guild, makeClient())))

    const numbers = [...getChannelNumbers().values()].sort((a, b) => a - b)
    expect(numbers).toEqual([1, 2, 3, 4])
    expect([...getUsedNumbers('lobby-1')].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
    expect(getTrackedTempChannels().get('lobby-1')?.size).toBe(4)
  })

  it('ignores bots joining the lobby', async () => {
    const { guild, lobby } = makeGuildAndLobby()
    await createPublicVoiceChannel(makeMember('bot-1', true), lobby, guild, makeClient())

    expect(getChannelNumbers().size).toBe(0)
    expect(guild.channels.create).not.toHaveBeenCalled()
  })

  it('opens PUBLIC channels to everyone with voice permissions', async () => {
    const { guild, lobby } = makeGuildAndLobby()
    await createPublicVoiceChannel(makeMember('u1'), lobby, guild, makeClient())

    const call = guild.channels.create.mock.calls[0][0]
    const overwrite = call.permissionOverwrites[0]
    expect(overwrite.id).toBe('role-everyone')
    expect(overwrite.allow).toEqual(
      expect.arrayContaining(['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'USE_VAD', 'STREAM'])
    )
    expect(overwrite.deny).toEqual([])
  })

  it('registers the channel in the database', async () => {
    const { guild, lobby } = makeGuildAndLobby()
    await createPublicVoiceChannel(makeMember('u1'), lobby, guild, makeClient())

    expect(mockedDb.channelConfiguration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channelId: 'vc-1', name: 'PUBLIC 1', type: 'voice' }),
      })
    )
  })
})

describe('cleanup', () => {
  it('deletes an empty PUBLIC channel and releases its number', async () => {
    vi.useFakeTimers()
    try {
      const { guild, lobby, created } = makeGuildAndLobby()
      await createPublicVoiceChannel(makeMember('u1'), lobby, guild, makeClient())
      const channel = created[0]
      channel.members.size = 0
      const client = makeClient(channel)

      expect(getChannelNumbers().has('vc-1')).toBe(true)

      scheduleTempChannelDeletion('vc-1', client)
      vi.advanceTimersByTime(5 * 60 * 1000 + 10)
      // Le rappel du timer est asynchrone (fetch → delete → releaseTracking) :
      // on vide plusieurs microtasks pour le laisser courir jusqu'au bout.
      for (let i = 0; i < 3; i++) await Promise.resolve()

      expect(channel.delete).toHaveBeenCalled()
      expect(getChannelNumbers().has('vc-1')).toBe(false)
      expect(getTrackedTempChannels().get('lobby-1')?.has('vc-1')).toBe(false)
      expect(mockedDb.channelConfiguration.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { guildId: 'guild-1', channelId: 'vc-1' } })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps tracking when the channel is still occupied', async () => {
    vi.useFakeTimers()
    try {
      const { guild, lobby, created } = makeGuildAndLobby()
      await createPublicVoiceChannel(makeMember('u1'), lobby, guild, makeClient())
      const channel = created[0]
      channel.members.size = 1
      const client = makeClient(channel)

      scheduleTempChannelDeletion('vc-1', client)
      vi.advanceTimersByTime(5 * 60 * 1000 + 10)

      expect(channel.delete).not.toHaveBeenCalled()
      expect(getChannelNumbers().has('vc-1')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('restart recovery', () => {
  it('re-adopts existing PUBLIC channels and reserves their numbers', async () => {
    const { guild, lobby } = makeGuildAndLobby()
    const ch1 = { id: 'vc-old-1', name: 'PUBLIC 1', members: { size: 0 }, isVoiceBased: () => true, on: vi.fn() }
    const ch2 = { id: 'vc-old-2', name: 'PUBLIC 2', members: { size: 2 }, isVoiceBased: () => true, on: vi.fn() }
    lobby.parent.children.cache.set(ch1.id, ch1)
    lobby.parent.children.cache.set(ch2.id, ch2)

    adoptExistingPublicChannels(guild, makeClient())

    expect(getChannelNumbers().get('vc-old-1')).toBe(1)
    expect(getChannelNumbers().get('vc-old-2')).toBe(2)
    expect([...getUsedNumbers('lobby-1')].sort((a, b) => a - b)).toEqual([1, 2])

    // A fresh creation reuses the next free number (3).
    await createPublicVoiceChannel(makeMember('u1'), lobby, guild, makeClient())
    const calls = guild.channels.create.mock.calls
    const call = calls[calls.length - 1]?.[0]
    expect(call.name).toBe('PUBLIC 3')
    expect(getChannelNumbers().get('vc-1')).toBe(3)
    expect(getTrackedTempChannels().get('lobby-1')?.has('vc-1')).toBe(true)
  })
})
