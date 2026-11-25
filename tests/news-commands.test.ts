import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/db.js', () => ({
  db: {
    newsSubmission: {
      create: vi.fn().mockResolvedValue({ id: 'sub-1', status: 'PENDING' }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    newsArticle: {
      create: vi.fn().mockResolvedValue({ id: 'art-1', status: 'APPROVED' }),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    newsRevision: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    newsApproval: {
      create: vi.fn().mockResolvedValue({}),
    },
    newsPublication: {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    newsSource: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation((calls) => Promise.all(calls)),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}))
import {
  data as newsData,
  execute as newsExecute,
} from '@/src/commands/news.js'
import { buildNewsPublishEmbed, buildNewsReviewEmbed } from '@/src/services/news-announcements.js'
import { channelCache, guildRoleCache, memberRoleCache } from './helpers/discord.js'

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Mock helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function makeMember(roleIds: string[] = []) {
  return {
    id: 'user-1',
    guild: { id: 'guild-1' },
    roles: { cache: memberRoleCache(roleIds) },
  } as any
}

function makeGuild(roleIds: string[] = [], channelNames: string[] = []) {
  void roleIds
  return {
    id: 'guild-1',
    roles: { cache: guildRoleCache() },
    channels: {
      cache: channelCache(channelNames),
    },
    members: { cache: new Map() },
  } as any
}

function makeInteraction(subcommand: string, memberRoles: string[] = [], options: Record<string, any> = {}) {
  const guild = makeGuild(memberRoles)
  const member = makeMember(memberRoles)
  member.guild = guild
  return {
    inGuild: () => true,
    guild,
    member,
    user: { id: 'user-1' },
    options: {
      getSubcommand: () => subcommand,
      getString: (name: string) => options[name] || null,
      getChannel: (name: string) => options[name] || null,
      getUser: (name: string) => options[name] || null,
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined),
    followedUp: false,
    replied: false,
    deferred: false,
    followUp: vi.fn().mockResolvedValue(undefined),
  } as any
}

function makeModalSubmit(customId: string, fieldValues: Record<string, string>) {
  return {
    customId,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    fields: {
      getTextInputValue: (id: string) => fieldValues[id] || '',
    },
    guildId: 'guild-1',
    user: { id: 'user-1' },
  } as any
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news command registration
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news command', () => {
  it('is registered with the correct name and subcommands', () => {
    expect(newsData.name).toBe('news')
    const json = newsData.toJSON() as any
    const subcommandNames = json.options?.map((o: any) => o.name) || []
    expect(subcommandNames).toContain('submit')
    expect(subcommandNames).toContain('review')
    expect(subcommandNames).toContain('approve')
    expect(subcommandNames).toContain('reject')
    expect(subcommandNames).toContain('publish')
    expect(subcommandNames).toContain('edit')
    expect(subcommandNames).toContain('sources')
    expect(subcommandNames).toContain('history')
    expect(subcommandNames).toContain('archive')
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news submit — permission check
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news submit', () => {
  it('requires a submit role', async () => {
    const interaction = makeInteraction('submit', [])
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('rôle requis'),
        ephemeral: true,
      })
    )
  })

  it('opens a modal for authorized users', async () => {
    const interaction = makeInteraction('submit', ['role_member'])
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.showModal).toHaveBeenCalled()
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news review
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news review', () => {
  it('requires a mod role', async () => {
    const interaction = makeInteraction('review', [], { id: 'sub-1' })
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('rôle requis'),
        ephemeral: true,
      })
    )
  })

  it('shows submission not found when missing', async () => {
    const interaction = makeInteraction('review', ['role_news_approver'], { id: 'missing' })
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('introuvable') })
    )
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news approve
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news approve', () => {
  it('requires a mod role', async () => {
    const interaction = makeInteraction('approve', [], { id: 'sub-1' })
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('rôle requis'),
        ephemeral: true,
      })
    )
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news reject
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news reject', () => {
  it('requires a mod role', async () => {
    const interaction = makeInteraction('reject', [], { id: 'sub-1' })
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('rôle requis'),
        ephemeral: true,
      })
    )
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news publish
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news publish', () => {
  it('requires a publish role', async () => {
    const interaction = makeInteraction('publish', [], { id: 'art-1' })
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('rôle requis'),
        ephemeral: true,
      })
    )
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news edit
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news edit', () => {
  it('requires an edit role', async () => {
    const interaction = makeInteraction('edit', [], { id: 'art-1' })
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('rôle requis'),
        ephemeral: true,
      })
    )
  })

  it('opens a modal for authorized users', async () => {
    const interaction = makeInteraction('edit', ['role_news_editor'], { id: 'art-1' })
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.showModal).toHaveBeenCalled()
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news sources
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news sources', () => {
  it('requires a mod role', async () => {
    const interaction = makeInteraction('sources', [])
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('rôle requis'),
        ephemeral: true,
      })
    )
  })

  it('lists sources (empty)', async () => {
    const interaction = makeInteraction('sources', ['role_news_approver'])
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalled()
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news history
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news history', () => {
  it('shows article not found when missing', async () => {
    const interaction = makeInteraction('history', ['role_member'], { id: 'missing' })
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('introuvable') })
    )
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /news archive
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/news archive', () => {
  it('requires a mod role', async () => {
    const interaction = makeInteraction('archive', [], { id: 'art-1' })
    await newsExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('rôle requis'),
        ephemeral: true,
      })
    )
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Embed builders
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('news embed builders', () => {
  it('builds a publish embed', () => {
    const embed = buildNewsPublishEmbed({
      id: 'art-1',
      title: 'GTA VI annoncé',
      summary: 'Résumé de la news',
      category: 'GTA_VI',
      confirmationStatus: 'CONFIRMED',
      authorId: 'user-1',
      publishedAt: new Date(),
    })
    expect(embed.data.title).toContain('GTA VI annoncé')
  })

  it('builds a review embed', () => {
    const embed = buildNewsReviewEmbed({
      id: 'sub-1',
      title: 'Soumission test',
      summary: 'Résumé',
      category: 'GTA_VI',
      submittedBy: 'user-1',
      createdAt: new Date(),
    })
    expect(embed.data.title).toContain('Nouvelle soumission de news')
  })
})
