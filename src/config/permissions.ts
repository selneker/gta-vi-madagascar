/**
 * Discord permission bit flags (Discord API permission numbers).
 * Defined as bigints so they compose cleanly with PermissionResolvable.
 */

export const PermissionBits = {
  ADMINISTRATOR: 1n << 3n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_MESSAGES: 1n << 13n,
  MANAGE_WEBHOOKS: 1n << 23n,
  MANAGE_EVENTS: 1n << 22n,
  VIEW_AUDIT_LOG: 1n << 7n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  EMBED_LINKS: 1n << 12n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  STREAM: 1n << 9n,
  USE_VAD: 1n << 27n,
  PRIORITY_SPEAKER: 1n << 8n,
  REQUEST_TO_SPEAK: 1n << 31n,
  MOVE_MEMBERS: 1n << 24n,
  MUTE_MEMBERS: 1n << 25n,
  DEAFEN_MEMBERS: 1n << 26n,
  MODERATE_MEMBERS: 1n << 30n,
} as const

export type PermissionName = keyof typeof PermissionBits

/** Combine named permissions into a single bigint. */
export function combine(...names: PermissionName[]): bigint {
  let total = 0n
  for (const name of names) total |= PermissionBits[name]
  return total
}

/** Permission sets used by the server setup system. Least privilege by default. */
export const RolePermissionSets = {
  /** Default Member role: read, speak in voice, read history. No streaming privilege by default. */
  Member: combine(
    'VIEW_CHANNEL',
    'SEND_MESSAGES',
    'READ_MESSAGE_HISTORY',
    'CONNECT',
    'SPEAK',
    'USE_EXTERNAL_EMOJIS'
  ),
  /** Staff baseline: moderate the server, manage channels/roles/events, read audit log. */
  Staff: combine(
    'MANAGE_CHANNELS',
    'MANAGE_ROLES',
    'MANAGE_EVENTS',
    'MANAGE_MESSAGES',
    'VIEW_AUDIT_LOG',
    'KICK_MEMBERS',
    'BAN_MEMBERS',
    'MODERATE_MEMBERS',
    'VIEW_CHANNEL',
    'SEND_MESSAGES',
    'READ_MESSAGE_HISTORY',
    'CONNECT',
    'SPEAK',
    'STREAM',
    'USE_VAD'
  ),
  /** Stage moderators on the Live Stage. */
  StageModerator: combine(
    'VIEW_CHANNEL',
    'CONNECT',
    'SPEAK',
    'STREAM',
    'USE_VAD',
    'REQUEST_TO_SPEAK',
    'MUTE_MEMBERS',
    'DEAFEN_MEMBERS',
    'MOVE_MEMBERS',
    'MANAGE_CHANNELS'
  ),
  /** Verified streamers / live hosts may stream their gameplay in stream rooms. */
  Streamer: combine('VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD'),
  /** Announcement channels are read-only for members. */
  AnnouncementReader: combine('VIEW_CHANNEL', 'READ_MESSAGE_HISTORY'),
  /** Live Alerts is a self-assignable ping role: no channel privileges. */
  LiveAlerts: combine('VIEW_CHANNEL', 'READ_MESSAGE_HISTORY'),
} as const
