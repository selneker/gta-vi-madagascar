import {
  Guild,
  Role,
  CategoryChannel,
  TextChannel,
  VoiceChannel,
  StageChannel,
  NewsChannel,
  Collection,
  NonThreadGuildBasedChannel,
  ChannelType,
  ColorResolvable,
  PermissionResolvable,
  PermissionFlagsBits,
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

/** Config channel types vs what Discord actually allows on a non-Community guild. */
function channelTypeMatches(existingType: ChannelType, def: ChannelDef): boolean {
  const desired = discordChannelType(def.type)
  if (existingType === desired) return true
  // Non-Community guilds reject stage channels: the voice fallback is final.
  if (def.type === 'stage' && existingType === ChannelType.GuildVoice) return true
  // Same for announcement channels: plain text is the supported fallback.
  if (def.type === 'news' && existingType === ChannelType.GuildText) return true
  return false
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
      ? existingChannels.find((c) => c?.type === ChannelType.GuildCategory && c?.name.toUpperCase() === categoryById(def.category!)?.name.toUpperCase())
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
      !channelTypeMatches(existing.type, def) ||
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
  let existingChannels = await guild.channels.fetch()
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

  // --- Channels pass 1: categories. Pass 2 runs on a fresh snapshot so the
  // children created right after them actually get a parent (unparented
  // children were the root cause of the duplicate channel generations).
  for (const def of sortChannels(Channels).filter((c) => c.type === 'category')) {
    const existing = existingChannels.find(
      (c) => c?.type === ChannelType.GuildCategory && c.name.toUpperCase() === def.name.toUpperCase()
    )
    if (!existing) {
      const created = await guild.channels.create({
        name: def.name,
        type: ChannelType.GuildCategory,
        reason: 'GTA VI MADAGASCAR /setup apply',
      } as Parameters<Guild['channels']['create']>[0])
      await applyOverwrites(
        created,
        permissionOverwrites(def.id, resolvedRoles, everyoneRole, ChannelType.GuildCategory),
      )
      try { await created.setPosition(def.position ?? 0, { reason: 'GTA VI MADAGASCAR /setup apply' }) } catch { /* */ }
      channelsCreated++
      logger.info({ channel: def.name, guild: guild.id }, 'category created')
      continue
    }
    if (existing.name !== def.name) {
      // Same category, different casing/styling: rename instead of creating a second one.
      await existing.edit({ name: def.name, reason: 'GTA VI MADAGASCAR /setup apply' }).catch(() => undefined)
      channelsUpdated++
    }
    await applyOverwrites(
      existing,
      permissionOverwrites(def.id, resolvedRoles, everyoneRole, ChannelType.GuildCategory),
    )
    try { await existing.setPosition(def.position ?? 0, { reason: 'GTA VI MADAGASCAR /setup apply' }) } catch { /* */ }
  }

  existingChannels = await guild.channels.fetch()

  const findCategory = (key: string) => {
    const name = categoryById(key)?.name.toUpperCase()
    if (!name) return undefined
    return existingChannels.find((c) => c?.type === ChannelType.GuildCategory && c.name.toUpperCase() === name)
  }

  // --- Channels pass 2: everything else ---
  for (const def of sortChannels(Channels).filter((c) => c.type !== 'category')) {
    const parent = def.category ? findCategory(def.category) : undefined
    if (def.category && !parent) {
      warnings.push(`Catégorie introuvable pour « ${def.name}» — création ignorée pour éviter un salon orphelin.`)
      continue
    }
    const parentId = parent?.id ?? null
    let existing = existingChannels.find((c) => c?.name === def.name && (c?.parentId ?? null) === parentId)

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
          parent: parent,
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
              parent: parent,
              topic: undefined,
              nsfw: def.nsfw ?? false,
              reason: 'GTA VI MADAGASCAR /setup apply (stage → voice fallback)',
            } as Parameters<Guild['channels']['create']>[0])
            creationError = null
          } catch (fallbackError) {
            creationError = fallbackError
          }
        } else if (def.type === 'news') {
          try {
            created = await guild.channels.create({
              name: def.name,
              type: ChannelType.GuildText,
              parent: parent,
              topic: def.topic,
              nsfw: def.nsfw ?? false,
              reason: 'GTA VI MADAGASCAR /setup apply (news → text fallback)',
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
    if (!channelTypeMatches(existing.type, def)) needsUpdate = true
    if (isTextOrNews && (existing as TextChannel | NewsChannel).topic !== def.topic) needsUpdate = true
    if (existing.type !== ChannelType.GuildCategory && existing.nsfw !== (def.nsfw ?? false)) needsUpdate = true
    if (def.category && (existing.parentId ?? null) !== parentId) needsUpdate = true

    if (needsUpdate) {
      const updates: Record<string, unknown> = { reason: 'GTA VI MADAGASCAR /setup apply' }
      if (existing.name !== def.name) updates.name = def.name
      if (isTextOrNews) updates.topic = def.topic
      if (existing.type !== ChannelType.GuildCategory) updates.nsfw = def.nsfw ?? false
      if (def.category && (existing.parentId ?? null) !== parentId) updates.parent = parent
      try {
        await existing.edit(updates)
        channelsUpdated++
        logger.info({ channel: def.name, guild: guild.id }, 'channel updated')
      } catch (error) {
        logger.error({ channel: def.name, type: existing.type, guild: guild.id, error: String(error) }, 'Channel edit skipped — incompatible channel type')
        warnings.push(`Impossible de mettre à jour le salon « ${def.name}»: ${error instanceof Error ? error.message : String(error)}. Vérifiez les permissions du bot et le type de serveur.`)
      }
    }
    // Always re-apply overwrites so permission changes (e.g. everyone can stream) propagate.
    await applyOverwrites(existing, overwrites)
    try { await existing.setPosition(def.position ?? 0, { reason: 'GTA VI MADAGASCAR /setup apply' }) } catch { /* */ }
  }

  // --- Nettoyage des doublons : volontairement séparé (/setup cleanup).
  // apply() ne supprime jamais rien : il crée et met à jour uniquement.

  return {
    applied: { roles: rolesCreated + rolesUpdated, channels: channelsCreated + channelsUpdated },
    skipped: { roles: Roles.length - rolesCreated - rolesUpdated, channels: Channels.length - channelsCreated - channelsUpdated },
    warnings,
  }
}

/** Extrait le nom de base d'un salon (préfixe de style ╭ㆍ│ㆍ╰ㆍ retiré). */
function stripStylePrefix(name: string): string {
  return name.replace(/^[╭│╰]ㆍ\s*/, '')
}

/**
 * A channel is only protected when it really holds messages. `lastMessageId`
 * survives message deletion, so an empty channel can still report one.
 * Unknown/failed lookups are treated as "has messages" (never risk data loss).
 */
async function channelHasMessages(channel: NonThreadGuildBasedChannel): Promise<boolean> {
  const lastMessageId = (channel as { lastMessageId?: string | null }).lastMessageId
  if (!lastMessageId) return false
  const text = channel as unknown as {
    messages?: { fetch: (options: { limit: number }) => Promise<{ size: number }> }
  }
  if (!text.messages?.fetch) return true
  try {
    const messages = await text.messages.fetch({ limit: 1 })
    return messages.size > 0
  } catch (error) {
    logger.warn(
      { channel: channel.id, name: channel.name, error: String(error) },
      'Duplicate message check failed — keeping channel',
    )
    return true
  }
}

/**
 * Supprime les salons en doublon. Un doublon est un salon qui partage le nom de
 * base (préfixe de style retiré) d'un salon défini dans la config, où qu'il soit
 * dans le serveur — l'ancienne version ne comparait que dans une même catégorie,
 * ce qui laissait survivre les copies orphelines. Les salons inconnus de la
 * config ne sont jamais supprimés, et un salon qui contient des messages n'est
 * jamais supprimé. Les catégories en double sont fusionnées (enfants déplacés).
 */
export async function cleanupDuplicateChannels(
  guild: Guild,
  existingChannels: Collection<string, NonThreadGuildBasedChannel | null>,
  dryRun = false,
): Promise<{ removed: number; kept: number }> {
  const all = [...existingChannels.values()].filter(
    (c): c is NonThreadGuildBasedChannel => c !== null,
  )
  const categoryName = (id: string | null): string | null => {
    if (!id) return null
    const cat = all.find((c) => c.id === id)
    return cat ? cat.name.toUpperCase() : null
  }

  let removed = 0
  let kept = 0

  // 1) Salons (hors catégories) qui partagent un nom de base, toutes catégories confondues.
  const byBaseName = new Map<string, NonThreadGuildBasedChannel[]>()
  for (const channel of all) {
    if (channel.type === ChannelType.GuildCategory) continue
    const base = stripStylePrefix(channel.name)
    if (!byBaseName.has(base)) byBaseName.set(base, [])
    byBaseName.get(base)!.push(channel)
  }

  for (const [base, group] of byBaseName) {
    if (group.length === 1) {
      kept++
      continue
    }

    const def = Channels.find((c) => c.type !== 'category' && stripStylePrefix(c.name) === base)
    if (!def) {
      // Not ours (e.g. Discord's default #general): leave it alone.
      kept += group.length
      continue
    }

    const wantedParent = def.category ? categoryById(def.category)?.name.toUpperCase() : undefined
    let keeper =
      group.find((c) => c.name === def.name && (!wantedParent || categoryName(c.parentId) === wantedParent))
    if (!keeper) {
      for (const candidate of group) {
        if (await channelHasMessages(candidate)) {
          keeper = candidate
          break
        }
      }
    }
    keeper ??= group[0]

    for (const channel of group) {
      if (channel.id === keeper.id) continue
      if (await channelHasMessages(channel)) {
        logger.warn({ channel: channel.id, name: channel.name, guild: guild.id }, 'Duplicate kept: channel has messages')
        kept++
        continue
      }
      if (dryRun) {
        removed++
        logger.info({ channel: channel.id, name: channel.name, guild: guild.id }, 'Duplicate would be deleted (dry run)')
        continue
      }
      try {
        await channel.delete('Doublon supprimé — /setup cleanup')
        removed++
        logger.info({ channel: channel.id, name: channel.name, guild: guild.id }, 'Duplicate channel deleted')
      } catch (error) {
        logger.error({ channel: channel.id, name: channel.name, error: String(error) }, 'Failed to delete duplicate channel')
      }
    }
    kept++
  }

  // 2) Catégories en double (même nom à la casse près) : fusionner puis supprimer.
  const byCategory = new Map<string, NonThreadGuildBasedChannel[]>()
  for (const channel of all) {
    if (channel.type !== ChannelType.GuildCategory) continue
    const key = channel.name.toUpperCase()
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(channel)
  }

  for (const [key, group] of byCategory) {
    if (group.length === 1) {
      kept++
      continue
    }
    const def = Channels.find((c) => c.type === 'category' && c.name.toUpperCase() === key)
    if (!def) {
      kept += group.length
      continue
    }
    const keeper = group.find((c) => c.name === def.name) ?? group[0]
    for (const channel of group) {
      if (channel.id === keeper.id) continue
      if (!dryRun) {
        for (const child of all.filter((c) => c.parentId === channel.id)) {
          try {
            await (child as TextChannel).setParent(keeper.id, { reason: 'Catégorie en double — /setup cleanup' })
          } catch (error) {
            logger.error({ channel: child.id, name: child.name, error: String(error) }, 'Failed to move child out of duplicate category')
          }
        }
        try {
          await channel.delete('Catégorie en double — /setup cleanup')
        } catch (error) {
          logger.error({ channel: channel.id, name: channel.name, error: String(error) }, 'Failed to delete duplicate category')
          continue
        }
      }
      removed++
      logger.info({ category: channel.name, guild: guild.id }, dryRun ? 'Duplicate category would be deleted (dry run)' : 'Duplicate category deleted')
    }
    kept++
  }

  return { removed, kept }
}

/**
 * Supprime les salons en doublon (appel autonome pour /setup cleanup).
 * Avec dryRun, ne supprime rien et retourne seulement le nombre prévu.
 */
export async function cleanup(guild: Guild, dryRun = false): Promise<{ removed: number; kept: number }> {
  const existingChannels = await guild.channels.fetch()
  return cleanupDuplicateChannels(guild, existingChannels, dryRun)
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
  // STREAM = Go Live (screen share). Members can stream straight from any voice channel.
  return combine('VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD', 'USE_EXTERNAL_EMOJIS')
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

  // Stream rooms: members watch and may share their screen; streamers/hosts/director get the same plus the badge flow.
  if (channelId === 'ch_stream_room_01' || channelId === 'ch_stream_room_02') {
    return [
      ...addEntry(get('role_verified_streamer'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD']),
      ...addEntry(get('role_streamer'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD']),
      ...addEntry(get('role_live_host'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD']),
      ...addEntry(get('role_live_director'), ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD']),
      { role: everyoneRole!, allow: combine('VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD'), deny: 0n },
    ]
  }

  // Squad live: members play together.
  if (channelId === 'ch_squad_live') {
    return [{ role: everyoneRole!, allow: combine('VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD'), deny: 0n }]
  }

  // Default public channels.
  return [{ role: everyoneRole!, allow: everyoneAllowForChannelType(channelType), deny: 0n }]
}

/**
 * discord.js `PermissionOverwriteOptions` keys are its own PascalCase flags
 * (`ViewChannel`, `UseVAD`), not the API's SCREAMING_SNAKE names, so the
 * PermissionBits names must be translated before they reach edit().
 */
const flagNameByScreaming = new Map<string, string>()
for (const flag of Object.keys(PermissionFlagsBits)) {
  flagNameByScreaming.set(flag.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(), flag)
}

/** Converts allow/deny bitfields into the permission-name booleans edit() expects. */
export function overwriteOptions(allow: bigint, deny: bigint): Record<string, boolean> {
  const options: Record<string, boolean> = {}
  for (const [name, bit] of Object.entries(PermissionBits)) {
    const flag = flagNameByScreaming.get(name)
    if (!flag) continue
    if (allow & bit) options[flag] = true
    else if (deny & bit) options[flag] = false
  }
  return options
}

/** Network hiccups and Discord 5xx are worth retrying; permission errors are not. */
function isTransientError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  if (/BitFieldInvalid|Missing Permissions|Missing Access|50013|50024|50035|50001/.test(text)) return false
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ConnectTimeoutError|UND_ERR|socket hang up|DiscordAPIError\[5\d\d\]/i.test(text)
}

async function withRetries<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isTransientError(error) || attempt === attempts) throw error
      const waitMs = 500 * 2 ** (attempt - 1)
      logger.warn({ label, attempt, waitMs, error: String(error) }, 'Transient Discord error — retrying')
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }
  throw lastError
}

export async function applyOverwrites(channel: any, overwrites: OverwriteEntry[]): Promise<void> {
  // edit()/create() take permission booleans, not allow/deny bigints: passing
  // { allow, deny } there silently wrote zeroed overwrites, which left every
  // channel without permissions. set() accepts raw OverwriteData and replaces
  // the whole list, which is what the config describes.
  const payload = overwrites.map(({ role, allow, deny }) => ({ id: role.id, allow, deny }))
  try {
    await withRetries(`overwrites:${channel.name}`, () =>
      channel.permissionOverwrites.set(payload, 'GTA VI MADAGASCAR /setup apply'),
    )
  } catch (error) {
    logger.error({
      channel: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      error: String(error),
    }, 'Permission overwrites failed — retrying one entry at a time')
    // Retry entry by entry so one incompatible role cannot block the rest.
    for (const { role, allow, deny } of overwrites) {
      try {
        await withRetries(`overwrite:${channel.name}:${role.id}`, () =>
          channel.permissionOverwrites.edit(
            role,
            overwriteOptions(allow, deny),
            { reason: 'GTA VI MADAGASCAR /setup apply' },
          ),
        )
      } catch (entryError) {
        logger.error({
          channel: channel.id,
          channelName: channel.name,
          channelType: channel.type,
          role: role.id,
          error: String(entryError),
        }, 'Permission overwrite skipped — incompatible channel type')
      }
    }
  }
}

/** Channel order by position (used by tests and previews). */
export function channelsInPositionOrder(channels: ChannelDef[]): ChannelDef[] {
  return [...channels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}
