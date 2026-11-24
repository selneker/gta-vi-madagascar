import { describe, it, expect } from 'vitest'
import {
  resolvePermissions,
  desiredServerState,
  permissionOverwrites,
  channelsInPositionOrder,
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
    expect(roles.length).toBe(29)
    expect(channels.length).toBe(68)
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
