import { describe, it, expect, vi } from 'vitest'
import { Collection, ChannelType } from 'discord.js'
import {
  resolvePermissions,
  desiredServerState,
  permissionOverwrites,
  channelsInPositionOrder,
  cleanupDuplicateChannels,
  applyOverwrites,
} from '@/src/services/server-setup.js'
import { PermissionBits } from '@/src/config/permissions.js'
import type { Role } from 'discord.js'

function fakeRole(id: string): Role {
  return { id, guild: { id: 'guild-1' } } as unknown as Role
}

describe('resolvePermissions', () => {
  it('combines known permissions into a bitfield', () => {
    expect(resolvePermissions(['VIEW_CHANNEL', 'SEND_MESSAGES'])).toBe(
      PermissionBits.VIEW_CHANNEL | PermissionBits.SEND_MESSAGES
    )
  })

  it('ignores unknown permission names without throwing', () => {
    expect(resolvePermissions(['NOT_A_PERMISSION', 'VIEW_CHANNEL'])).toBe(PermissionBits.VIEW_CHANNEL)
  })
})

describe('desiredServerState', () => {
  it('returns every configured role and channel', () => {
    const { roles, channels } = desiredServerState()
    expect(roles.length).toBe(30)
    expect(channels.length).toBe(57)
    for (const role of roles) {
      expect(role.position).toBeGreaterThan(0)
      expect(role.permissions.length).toBeGreaterThan(0)
    }
    const names = channels.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('permissionOverwrites', () => {
  const everyone = fakeRole('role-everyone')

  it('denies view to everyone on staff channels', () => {
    const roles = new Map<string, Role>([
      ['role_founder', fakeRole('role_founder')],
    ])
    const entries = permissionOverwrites('ch_staff_room', roles, everyone)
    const everyoneEntry = entries.find((e) => e.role.id === 'role-everyone')
    expect(everyoneEntry).toBeDefined()
    expect(everyoneEntry!.deny & PermissionBits.VIEW_CHANNEL).toBe(PermissionBits.VIEW_CHANNEL)
  })

  it('lets everyone watch the live stage', () => {
    const entries = permissionOverwrites('ch_live_stage', new Map(), everyone)
    const everyoneEntry = entries.find((e) => e.role.id === 'role-everyone')
    expect(everyoneEntry).toBeDefined()
    expect(everyoneEntry!.allow & PermissionBits.VIEW_CHANNEL).toBe(PermissionBits.VIEW_CHANNEL)
    expect(everyoneEntry!.allow & PermissionBits.SPEAK).toBe(0n)
  })

  it('grants stream permission to streamers in stream rooms', () => {
    const roles = new Map<string, Role>([
      ['role_verified_streamer', fakeRole('role_verified_streamer')],
    ])
    const entries = permissionOverwrites('ch_stream_room_01', roles, everyone)
    const streamer = entries.find((e) => e.role.id === 'role_verified_streamer')
    expect(streamer).toBeDefined()
    expect(streamer!.allow & PermissionBits.STREAM).toBe(PermissionBits.STREAM)
  })
})

describe('applyOverwrites', () => {
  it('writes allow/deny bitfields through set()', async () => {
    const set = vi.fn(async () => {})
    const channel = { id: 'ch-1', name: 'general-chat', type: 0, permissionOverwrites: { set } }
    const role = fakeRole('role-1')

    await applyOverwrites(channel, [
      { role, allow: PermissionBits.STREAM, deny: PermissionBits.SPEAK },
    ])

    expect(set).toHaveBeenCalledWith(
      [{ id: 'role-1', allow: PermissionBits.STREAM, deny: PermissionBits.SPEAK }],
      expect.any(String),
    )
  })
})

describe('channelsInPositionOrder', () => {
  it('sorts channels by position', () => {
    const channels = [
      { id: 'b', name: 'b', type: 'text' as const, position: 2 },
      { id: 'a', name: 'a', type: 'text' as const, position: 1 },
    ]
    const ordered = channelsInPositionOrder(channels)
    expect(ordered.map((c) => c.id)).toEqual(['a', 'b'])
  })
})

describe('cleanupDuplicateChannels', () => {
  function fakeChannel(
    id: string,
    name: string,
    type: ChannelType,
    parentId: string | null = null,
    lastMessageId: string | null = null,
  ) {
    return {
      id,
      name,
      type,
      parentId,
      lastMessageId,
      delete: vi.fn(async () => {}),
      setParent: vi.fn(async () => {}),
    }
  }

  function fixture() {
    const channels = [
      fakeChannel('cat-start', '🏝️・START-HERE', ChannelType.GuildCategory),
      // Lowercase duplicate category left over from an older run.
      fakeChannel('cat-start-dup', '🏝️・start-here', ChannelType.GuildCategory),
      fakeChannel('cat-community', '💬・COMMUNITY', ChannelType.GuildCategory),
      // Correct welcome (exact name, correct parent).
      fakeChannel('welcome-ok', '╭ㆍwelcome', ChannelType.GuildText, 'cat-start'),
      // Old copies that must go: one in the duplicate category, one unparented.
      fakeChannel('welcome-old-1', '╭ㆍwelcome', ChannelType.GuildText, 'cat-start-dup'),
      fakeChannel('welcome-old-2', 'welcome', ChannelType.GuildText, null),
      // Correct general-chat plus an orphan copy.
      fakeChannel('general-ok', '╭ㆍgeneral-chat', ChannelType.GuildText, 'cat-community'),
      fakeChannel('general-old', 'general-chat', ChannelType.GuildText, null),
      // A duplicate that holds messages must never be deleted.
      fakeChannel('general-with-msgs', 'general-chat', ChannelType.GuildText, null, 'msg-1'),
      // Not part of the config (Discord default) — leave it alone.
      fakeChannel('general-default', 'general', ChannelType.GuildText, null),
      // Not in the config, but lives in the duplicate category: it must survive
      // and be moved into the kept category.
      fakeChannel('note-in-dup', 'temp-note', ChannelType.GuildText, 'cat-start-dup'),
    ]
    return {
      channels: new Collection(channels.map((channel) => [channel.id, channel])),
      byId: new Map(channels.map((channel) => [channel.id, channel])),
    }
  }

  it('deletes duplicates across categories and merges duplicate categories', async () => {
    const { channels, byId } = fixture()
    const guild = { id: 'guild-1', channels: { cache: channels } } as any

    const result = await cleanupDuplicateChannels(guild, channels, false)

    expect(byId.get('welcome-ok')!.delete).not.toHaveBeenCalled()
    expect(byId.get('welcome-old-1')!.delete).toHaveBeenCalled()
    expect(byId.get('welcome-old-2')!.delete).toHaveBeenCalled()
    expect(byId.get('general-ok')!.delete).not.toHaveBeenCalled()
    expect(byId.get('general-old')!.delete).toHaveBeenCalled()
    expect(byId.get('general-with-msgs')!.delete).not.toHaveBeenCalled()
    expect(byId.get('general-default')!.delete).not.toHaveBeenCalled()

    // Children of the duplicate category are moved before it is deleted.
    expect(byId.get('note-in-dup')!.setParent).toHaveBeenCalledWith(
      'cat-start',
      expect.anything(),
    )
    expect(byId.get('cat-start-dup')!.delete).toHaveBeenCalled()

    expect(result.removed).toBe(4)
  })

  it('deletes nothing in dry-run mode', async () => {
    const { channels, byId } = fixture()
    const guild = { id: 'guild-1', channels: { cache: channels } } as any

    const result = await cleanupDuplicateChannels(guild, channels, true)

    for (const channel of byId.values()) {
      expect(channel.delete).not.toHaveBeenCalled()
      expect(channel.setParent).not.toHaveBeenCalled()
    }
    expect(result.removed).toBe(4)
  })

  it('deletes an empty duplicate even when lastMessageId is stale', async () => {
    const category = fakeChannel('cat-community', '💬・COMMUNITY', ChannelType.GuildCategory)
    const keeper = fakeChannel('general-ok', '╭ㆍgeneral-chat', ChannelType.GuildText, 'cat-community')
    const stale = {
      ...fakeChannel('general-stale', 'general-chat', ChannelType.GuildText, null, 'msg-9'),
      messages: { fetch: vi.fn(async () => ({ size: 0 })) },
    }
    const channels = new Collection<string, any>([
      [category.id, category],
      [keeper.id, keeper],
      [stale.id, stale],
    ])
    const guild = { id: 'guild-1', channels: { cache: channels } } as any

    const result = await cleanupDuplicateChannels(guild, channels, false)

    expect(stale.messages.fetch).toHaveBeenCalled()
    expect(stale.delete).toHaveBeenCalled()
    expect(result.removed).toBe(1)
  })
})
