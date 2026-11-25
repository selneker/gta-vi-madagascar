import { Collection } from 'discord.js'
import { Roles } from '../../src/config/server.js'

/**
 * Builds Discord-shaped role caches: real snowflake ids, config role names.
 * The old tests fed config keys straight into `member.roles.cache`, which is
 * exactly why the config-key/snowflake bug passed every test.
 */
const ROLE_ID_BY_KEY = new Map(
  Roles.map((role, index) => [role.id, String(900000000000000000n + BigInt(index))]),
)

export function roleId(key: string): string {
  return ROLE_ID_BY_KEY.get(key) ?? key
}

export function roleFor(key: string): { id: string; name: string; guild: { id: string } } {
  const def = Roles.find((role) => role.id === key)
  return {
    id: roleId(key),
    name: def?.name ?? key,
    guild: { id: 'guild-1' },
  }
}

/** Every configured role, as the guild cache would hold it. */
export function guildRoleCache(): Collection<string, any> {
  const cache = new Collection<string, any>()
  for (const role of Roles) {
    const resolved = roleFor(role.id)
    cache.set(resolved.id, resolved)
  }
  return cache
}

/** Only the roles the member actually holds (given as config keys). */
export function memberRoleCache(keys: string[]): Collection<string, any> {
  return new Collection(keys.map((key) => {
    const role = roleFor(key)
    return [role.id, role]
  }))
}

/** Channel cache keyed by name, like the old helpers, but as a real Collection. */
export function channelCache(names: string[]): Collection<string, any> {
  return new Collection(names.map((name) => {
    const channel = {
      id: `ch-${name}`,
      name,
      type: 0,
      parentId: null,
      isTextBased: () => true,
    }
    return [channel.id, channel]
  }))
}
