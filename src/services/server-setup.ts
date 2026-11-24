import {
  Guild,
  Role,
  CategoryChannel,
  TextChannel,
  VoiceChannel,
  StageChannel,
  NewsChannel,
  ChannelType,
  ColorResolvable,
  PermissionResolvable,
} from 'discord.js'
import { logger } from '../lib/logger.js'
import { combine, PermissionBits, type PermissionName } from '../config/permissions.js'
import { Channels, categoryById, NewsChannelIds, StaffRoleIds, Roles } from '../config/server.js'
import type { RoleDef, ChannelDef } from '../config/server.js'

export interface RolePlan {
  def: RoleDef
  action: 'create' | 'update' | 'unchanged'
  role?: Role
  reason?: string
}

export interface ChannelPlan {
  def: ChannelDef
  action: 'create' | 'update' | 'unchanged'
  channel?: CategoryChannel | TextChannel | VoiceChannel | StageChannel | NewsChannel
  reason?: string
}

export interface SetupPreview {
  roles: RolePlan[]
  channels: ChannelPlan[]
  warnings: string[]
}

export interface SetupResult {
  applied: { roles: number; channels: number }
  skipped: { roles: number; channels: number }
  warnings: string[]
}

/** Resolves named permissions into a bigint bitfield; unknown names are skipped. */
export function resolvePermissions(names: string[]): bigint {
  let total = 0n
  const unknown: string[] = []
  for (const name of names) {
    if (name in PermissionBits) total |= PermissionBits[name as keyof typeof PermissionBits]
    else unknown.push(name)
  }
  if (unknown.length) logger.warn({ unknown }, 'Unknown permission names ignored')
  return total
}

/** The full desired server state (roles + channels). */
export function desiredServerState() {
  return { roles: [...Roles], channels: [...Channels] }
}

function sortRoles(roles: RoleDef[]): RoleDef[] {
  return [...roles].sort((a, b) => a.position - b.position)
}

function sortChannels(channels: ChannelDef[]): ChannelDef[] {
  return [...channels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

function discordChannelType(type: ChannelDef['type']): ChannelType {
  switch (type) {
    case 'category': return ChannelType.GuildCategory
    case 'text': return ChannelType.GuildText
    case 'voice': return ChannelType.GuildVoice
    case 'stage': return ChannelType.GuildStageVoice
    case 'news': return ChannelType.GuildText // Discord API rejects GuildNews (5) at creation; create as text, convert manually in Discord if Community server
  }
}

/**
 * Read-only diff between the desired configuration and the current guild state.
 * Used by /setup preview. Never mutates anything.
 */
export async function preview(guild: Guild): Promise<SetupPreview> {
  const warnings: string[] = []
  const existingRoles = await guild.roles.fetch()
  const existingChannels = await guild.channels.fetch()

  const rolePlans: RolePlan[] = sortRoles(Roles).map((def) => {
    const existing = existingRoles.find((r) => r.name === def.name && r.id !== guild.id) // skip @everyone
    if (!existing) return { def, action: 'create' as const, reason: 'role does not exist' }
    const permsMatch = existing.permissions.bitfield === resolvePermissions(def.permissions)
    const needsUpdate =
      existing.name !== def.name ||
      existing.hoist !== (def.hoist ?? false) ||
      existing.mentionable !== (def.mentionable ?? false) ||
      !permsMatch
    return needsUpdate
      ? { def, action: 'update' as const, reason: 'name, color, permissions or flags differ' }
      : { def, action: 'unchanged' as const }
  })

  const channelPlans: ChannelPlan[] = []
  for (const def of sortChannels(Channels)) {
    const parent = def.category
      ? existingChannels.find((c) => c?.name === categoryById(def.category!)?.name && c?.type === ChannelType.GuildCategory)
      : undefined
    const parentId = parent?.id ?? null
    const existing = existingChannels.find(
      (c) => c?.name === def.name && (!def.category || (c?.parentId ?? null) === parentId)
    )
    if (!existing) {
      channelPlans.push({ def, action: 'create' as const, reason: 'channel does not exist' })
      continue
    }
    const isTextOrNews = existing.type === ChannelType.GuildText || existing.type === ChannelType.GuildNews
    const needsUpdate =
      existing.type !== discordChannelType(def.type) ||
      (isTextOrNews && existing.topic !== def.topic) ||
      (existing.type !== ChannelType.GuildCategory && existing.nsfw !== (def.nsfw ?? false)) ||
      (def.category && (existing.parentId ?? null) !== (parent?.id ?? null))
    channelPlans.push(
      needsUpdate ? { def, action: 'update' as const, reason: 'type, topic, nsfw or parent differs' } : { def, action: 'unchanged' as const }
    )
  }

  if (!guild.features.includes('NEWS')) {
    warnings.push('Guild is not a Community server: announcement (news) and stage channels may fail to create until community requirements are enabled.')
  }

  return { roles: rolePlans, channels: channelPlans, warnings }
}

/**
 * Applies the desired configuration idempotently. Creates and updates only —
 * unknown existing channels and roles are never deleted.
 */
export async function apply(guild: Guild): Promise<SetupResult> {
  const existingRoles = await guild.roles.fetch()
  const existingChannels = await guild.channels.fetch()
  const resolvedRoles = new Map<string, Role>()

  let rolesCreated = 0
  let rolesUpdated = 0
  let channelsCreated = 0
  let channelsUpdated = 0
  const warnings: string[] = []

  // --- Roles first (channel overwrites reference them) ---
  for (const def of sortRoles(Roles)) {
    const existing = existingRoles.find((r) => r.name === def.name && r.id !== guild.id)
    if (!existing) {
      const created = await guild.roles.create({
        name: def.name,
        color: def.color as unknown as ColorResolvable,
        hoist: def.hoist ?? false,
        mentionable: def.mentionable ?? false,
        permissions: resolvePermissions(def.permissions) as unknown as PermissionResolvable,
        reason: 'GTA VI MADAGASCAR /setup apply',
      })
      try { await created.setPosition(def.position, { reason: 'GTA VI MADAGASCAR /setup apply' }) } catch { /* hierarchy locks are acceptable */ }
      resolvedRoles.set(def.id, created)
      rolesCreated++
      logger.info({ role: def.name, guild: guild.id }, 'role created')
      continue
    }
    const permsMatch = existing.permissions.bitfield === resolvePermissions(def.permissions)
    if (
      existing.name !== def.name ||
      existing.hoist !== (def.hoist ?? false) ||
      existing.mentionable !== (def.mentionable ?? false) ||
      !permsMatch
    ) {
      await existing.edit({
        name: def.name,
        color: def.color as unknown as ColorResolvable,
        hoist: def.hoist ?? false,
        mentionable: def.mentionable ?? false,
        permissions: resolvePermissions(def.permissions) as unknown as PermissionResolvable,
        reason: 'GTA VI MADAGASCAR /setup apply',
      })
      rolesUpdated++
      logger.info({ role: def.name, guild: guild.id }, 'role updated')
    }
    try { await existing.setPosition(def.position, { reason: 'GTA VI MADAGASCAR /setup apply' }) } catch { /* */ }
    resolvedRoles.set(def.id, existing)
  }

  const everyoneRole = existingRoles.get(guild.id) ?? null
  if (!everyoneRole) warnings.push('@everyone role not found; permission defaults will be incomplete.')

  // --- Channels: categories first, then children (sorted by position) ---
  for (const def of sortChannels(Channels)) {
    const parent = def.category
      ? existingChannels.find((c) => c?.name === categoryById(def.category!)?.name && c?.type === ChannelType.GuildCategory)
      : undefined
    const parentId = parent?.id ?? null
    let existing = existingChannels.find(
      (c) => c?.name === def.name && (!def.category || (c?.parentId ?? null) === parentId)
    )

    // Reconnaissance par "nom de base" (préfixe de style ╭ㆍ│ㆍ╰ㆍ retiré) afin
    // d'éviter les doublons quand le style de nommage d'un salon change :
    // un salon déjà présent sous un ancien nom est renommé plutôt que recréé.
    if (!existing && def.category) {
      const baseName = def.name.replace(/^[╭│╰]ㆍ\s*/, '')
      const renamed = existingChannels.find(
        (c) => c?.type !== ChannelType.GuildCategory
          && (c?.parentId ?? null) === parentId
          && c?.name === baseName
      )
      if (renamed) existing = renamed
    }

    const overwrites = permissionOverwrites(def.id, resolvedRoles, everyoneRole, discordChannelType(def.type))

    if (!existing) {
      let created
      let creationError: unknown = null
      try {
        created = await guild.channels.create({
          name: def.name,
          type: discordChannelType(def.type),
          parent: def.category ? parent : undefined,
          topic: def.type === 'text' || def.type === 'news' ? def.topic : undefined,
          nsfw: def.nsfw ?? false,
          reason: 'GTA VI MADAGASCAR /setup apply',
        } as Parameters<Guild['channels']['create']>[0])
      } catch (error) {
        creationError = error
        // Les salons de scène (stage) et d'actualités (news) requièrent un
        // serveur Discord "Community". Si ce n'est pas le cas, on tente un
        // salon vocal classique en fallback pour ne pas bloquer tout le setup.
        if (def.type === 'stage') {
          try {
            created = await guild.channels.create({
              name: def.name,
              type: ChannelType.GuildVoice,
              parent: def.category ? parent : undefined,
              topic: undefined,
              nsfw: def.nsfw ?? false,
              reason: 'GTA VI MADAGASCAR /setup apply (stage → voice fallback)',
            } as Parameters<Guild['channels']['create']>[0])
            creationError = null
          } catch (fallbackError) {
            creationError = fallbackError
          }
        }
      }
      if (!created) {
        logger.error({ channel: def.name, type: def.type, category: def.category, guild: guild.id, error: String(creationError) }, 'Channel creation skipped — incompatible channel type')
        warnings.push(`Impossible de créer le salon « ${def.name}» (${def.type}): ${creationError instanceof Error ? creationError.message : String(creationError)}. Vérifiez les permissions du bot et le type de serveur.`)
        continue
      }
      await applyOverwrites(created, overwrites)
      try { await created.setPosition(def.position ?? 0, { reason: 'GTA VI MADAGASCAR /setup apply' }) } catch { /* */ }
      channelsCreated++
      logger.info({ channel: def.name, type: def.type, guild: guild.id }, 'channel created')
      continue
    }

    const isTextOrNews = existing.type === ChannelType.GuildText || existing.type === ChannelType.GuildNews
    let needsUpdate = false
    if (existing.type !== discordChannelType(def.type)) needsUpdate = true
    if (isTextOrNews && (existing as TextChannel | NewsChannel).topic !== def.topic) needsUpdate = true
    if (existing.type !== ChannelType.GuildCategory && existing.nsfw !== (def.nsfw ?? false)) needsUpdate = true
    if (def.category && (existing.parentId ?? null) !== (parent?.id ?? null)) needsUpdate = true

    if (needsUpdate) {
      const updates: Record<string, unknown> = { reason: 'GTA VI MADAGASCAR /setup apply' }
      if (existing.name !== def.name) updates.name = def.name
      if (isTextOrNews) updates.topic = def.topic
      if (existing.type !== ChannelType.GuildCategory) updates.nsfw = def.nsfw ?? false
      if (def.category && (existing.parentId ?? null) !== (parent?.id ?? null)) updates.parent = parent
      let edited = false
      try {
        await existing.edit(updates)
        edited = true
      } catch (error) {
        logger.error({ channel: def.name, type: existing.type, guild: guild.id, error: String(error) }, 'Channel edit skipped — incompatible channel type')
        warnings.push(`Impossible de mettre à jour le salon « ${def.name}»: ${error instanceof Error ? error.message : String(error)}. Vérifiez les permissions du bot et le type de serveur.`)
      }
      if (edited) {
        await applyOverwrites(existing, overwrites)
        channelsUpdated++
        logger.info({ channel: def.name, guild: guild.id }, 'channel updated')
      }
    }
    try { await existing.setPosition(def.position ?? 0, { reason: 'GTA VI MADAGASCAR /setup apply' }) } catch { /* */ }
  }

  return {
    applied: { roles: rolesCreated + rolesUpdated, channels: channelsCreated + channelsUpdated },
    skipped: { roles: Roles.length - rolesCreated - rolesUpdated, channels: Channels.length - channelsCreated - channelsUpdated },
    warnings,
  }
}

/** Read-only audit report. */
export async function audit(guild: Guild): Promise<SetupPreview> {
  const pre = await preview(guild)
  return {
    ...pre,
    warnings: [...pre.warnings, 'Unknown channels and roles are never deleted by /setup apply; remove them manually if intended.'],
  }
}

type OverwriteEntry = { role: Role; allow: bigint; deny: bigint }

function everyoneTextAllow(): bigint {
  return combine('VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'USE_EXTERNAL_EMOJIS')
}

function everyoneVoiceAllow(): bigint {
  return combine('VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'USE_EXTERNAL_EMOJIS')
}

/** Default @everyone permissions scoped to a channel type, so voice perms never land on text channels (Discord API error 50024). */
function everyoneAllowForChannelType(channelType: ChannelType): bigint {
  switch (channelType) {
    case ChannelType.GuildCategory:
      return combine('VIEW_CHANNEL')
    case ChannelType.GuildVoice:
    case ChannelType.GuildStageVoice:
      return everyoneVoiceAllow()
    default: // GuildText, GuildNews
      return everyoneTextAllow()
  }
}

function addEntry(role: Role | undefined, allow: string[], deny: string[] = []): OverwriteEntry[] {
  if (!role) return []
  return [{ role, allow: combine(...(allow as PermissionName[])), deny: combine(...(deny as PermissionName[])) }]
}

/** Role-based permission overwrites per channel. Staff roles are resolved after role creation. */
export function permissionOverwrites(
  channelId: string,
  roles: Map<string, Role>,
  everyoneRole: Role | null,
  channelType: ChannelType = ChannelType.GuildText
): OverwriteEntry[] {
  const get = (id: string) => roles.get(id)
  const everyone = everyoneRole ? [{ role: everyoneRole, allow: everyoneAllowForChannelType(channelType), deny: 0n }] : []

  // Staff HQ: staff roles only; everyone denied view.
  // Voice permissions (CONNECT/SPEAK) are only valid on voice/stage channels —
  // applying them to text channels triggers Discord API error 50024.
  const staffChannelIds = ['ch_staff_room', 'ch_mod_logs', 'ch_bot_logs', 'ch_security_logs', 'ch_news_review', 'ch_live_management']
  if (staffChannelIds.includes(channelId)) {
    const staffEntries: OverwriteEntry[] = []
    const staffPerms =
      channelType === ChannelType.GuildVoice || channelType === ChannelType.GuildStageVoice
        ? ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK']
        : ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY']
    for (const roleId of StaffRoleIds) staffEntries.push(...addEntry(get(roleId), staffPerms))
    staffEntries.push({ role: everyoneRole!, allow: 0n, deny: combine('VIEW_CHANNEL') })
    return staffEntries
  }

  // Announcement channels: read-only for everyone; News Approver posts.
  if (NewsChannelIds.includes(channelId)) {
    const newsEntries: OverwriteEntry[] = []
    const newsApprover = get('role_news_approver')
    if (newsApprover) newsEntries.push({ role: newsApprover, allow: combine('VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'MANAGE_MESSAGES'), deny: 0n })
    return [...newsEntries, ...everyone]
  }

  // Live Stage: moderation team manages; hosts/guests speak; audience watches.
  if (channelId === 'ch_live_stage') {
    return [
      ...addEntry(get('role_live_director'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD', 'REQUEST_TO_SPEAK', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS']),
      ...addEntry(get('role_stage_mod'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD', 'REQUEST_TO_SPEAK', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS']),
      ...addEntry(get('role_live_host'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD', 'REQUEST_TO_SPEAK']),
      ...addEntry(get('role_guest_speaker'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'REQUEST_TO_SPEAK']),
      { role: everyoneRole!, allow: combine('VIEW_CHANNEL', 'CONNECT'), deny: combine('SPEAK', 'STREAM') },
    ]
  }

  // Stream rooms: members watch; streamers/hosts/director may stream.
  if (channelId === 'ch_stream_room_01' || channelId === 'ch_stream_room_02') {
    return [
      ...addEntry(get('role_verified_streamer'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD']),
      ...addEntry(get('role_live_host'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD']),
      ...addEntry(get('role_live_director'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD']),
      { role: everyoneRole!, allow: combine('VIEW_CHANNEL', 'CONNECT', 'SPEAK'), deny: 0n },
    ]
  }

  // Squad live: members play together.
  if (channelId === 'ch_squad_live') {
    return [{ role: everyoneRole!, allow: combine('VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD'), deny: 0n }]
  }

  // Default public channels.
  return [{ role: everyoneRole!, allow: everyoneAllowForChannelType(channelType), deny: 0n }]
}

async function applyOverwrites(channel: any, overwrites: OverwriteEntry[]): Promise<void> {
  for (const { role, allow, deny } of overwrites) {
    try {
      await channel.permissionOverwrites.edit(role, { allow, deny }, { reason: 'GTA VI MADAGASCAR /setup apply' })
    } catch (error) {
      // Une overwrite sur un type de canal incompatible (ex: permissions voix sur un salon text)
      // est ignorée pour ne pas faire échouer tout le /setup apply. Le canal reste utilisable
      // avec ses permissions par défaut.
      logger.error({
        channel: channel.id,
        channelName: channel.name,
        channelType: channel.type,
        role: role?.name,
        error: String(error),
      }, 'Permission overwrite skipped — incompatible channel type')
    }
  }
}

/** Channel order by position (used by tests and previews). */
export function channelsInPositionOrder(channels: ChannelDef[]): ChannelDef[] {
  return [...channels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}
