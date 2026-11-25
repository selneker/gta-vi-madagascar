import { ChannelType, type Guild, type GuildMember, type NonThreadGuildBasedChannel, type Role } from 'discord.js'
import { Channels, Roles, categoryById } from '../config/server.js'

/**
 * Config ids (role_streamer, ch_live_announcements, ...) are stable keys, not
 * Discord snowflakes. Every runtime check must go through these resolvers,
 * otherwise a role/permission check is silently always false.
 */

const stylePrefix = /^[╭│╰]ㆍ\s*/

export function baseChannelName(name: string): string {
  return name.replace(stylePrefix, '')
}

/** Resolves a config role key to the live Discord role (matched by name). */
export function resolveRole(guild: Guild, key: string): Role | undefined {
  const def = Roles.find((r) => r.id === key)
  if (!def) return undefined
  return guild.roles.cache.find((r) => r.name === def.name)
}

/** True when the member holds at least one of the configured roles. */
export function hasAnyConfigRole(guild: Guild, member: GuildMember, keys: string[]): boolean {
  return keys.some((key) => {
    const role = resolveRole(guild, key)
    return role !== undefined && member.roles.cache.has(role.id)
  })
}

/** Resolves a config channel key to the live channel (exact name + category, then styled-name fallback). */
export function resolveChannel(guild: Guild, key: string): NonThreadGuildBasedChannel | undefined {
  const def = Channels.find((c) => c.id === key)
  if (!def) return undefined

  const parentName = def.category ? categoryById(def.category)?.name.toUpperCase() : undefined
  const live = [...guild.channels.cache.values()].filter(
    (c): c is NonThreadGuildBasedChannel => c !== null && c.type !== ChannelType.GuildCategory,
  )
  const sameParent = (c: NonThreadGuildBasedChannel): boolean => {
    if (!parentName) return true
    const parent = c.parentId ? guild.channels.cache.get(c.parentId) : undefined
    return parent?.name.toUpperCase() === parentName
  }

  return (
    live.find((c) => c.name === def.name && sameParent(c)) ??
    live.find((c) => baseChannelName(c.name) === baseChannelName(def.name) && sameParent(c)) ??
    live.find((c) => baseChannelName(c.name) === baseChannelName(def.name))
  )
}
