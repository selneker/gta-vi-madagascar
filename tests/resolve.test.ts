import { describe, expect, it } from 'vitest'
import { Collection, ChannelType } from 'discord.js'
import { hasAnyConfigRole, resolveChannel, resolveRole } from '@/src/lib/resolve.js'
import { guildRoleCache, memberRoleCache } from './helpers/discord.js'

function makeGuild(channels: any[] = []) {
  return {
    id: 'guild-1',
    roles: { cache: guildRoleCache() },
    channels: {
      cache: new Collection(channels.map((channel) => [channel.id, channel])),
    },
  } as any
}

describe('resolveRole', () => {
  it('resolves a config key to the live role by name', () => {
    const guild = makeGuild()
    const role = resolveRole(guild, 'role_streamer')
    expect(role).toBeDefined()
    expect(role!.name).toBe('Streamer')
    expect(role!.id).not.toBe('role_streamer')
  })

  it('returns undefined for an unknown config key', () => {
    expect(resolveRole(makeGuild(), 'role_does_not_exist')).toBeUndefined()
  })
})

describe('hasAnyConfigRole', () => {
  it('is true when the member holds the resolved snowflake', () => {
    const guild = makeGuild()
    const member = { roles: { cache: memberRoleCache(['role_streamer']) } } as any
    expect(hasAnyConfigRole(guild, member, ['role_streamer'])).toBe(true)
  })

  it('is false when the cache only contains the config key (old bug)', () => {
    const guild = makeGuild()
    const staleMember = {
      roles: { cache: new Collection([['role_streamer', { id: 'role_streamer' }]]) },
    } as any
    expect(hasAnyConfigRole(guild, staleMember, ['role_streamer'])).toBe(false)
  })
})

describe('resolveChannel', () => {
  it('prefers the channel in the configured category', () => {
    const category = {
      id: 'cat-start',
      name: '🏝️・START-HERE',
      type: ChannelType.GuildCategory,
      parentId: null,
    }
    const welcome = {
      id: 'ch-welcome',
      name: '╭ㆍwelcome',
      type: ChannelType.GuildText,
      parentId: 'cat-start',
    }
    const stray = {
      id: 'ch-stray',
      name: 'welcome',
      type: ChannelType.GuildText,
      parentId: null,
    }
    const guild = makeGuild([category, welcome, stray])
    expect(resolveChannel(guild, 'ch_welcome')?.id).toBe('ch-welcome')
  })

  it('falls back to a base-name match outside the category', () => {
    const stray = {
      id: 'ch-stray',
      name: 'welcome',
      type: ChannelType.GuildText,
      parentId: null,
    }
    const guild = makeGuild([stray])
    expect(resolveChannel(guild, 'ch_welcome')?.id).toBe('ch-stray')
  })
})
