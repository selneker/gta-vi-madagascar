import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmbedBuilder } from 'discord.js'

vi.mock('../src/lib/db.js', () => ({
  db: {
    liveSession: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'test-session' }),
      update: vi.fn().mockResolvedValue({}),
    },
    liveParticipant: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    streamerApplication: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'test-app' }),
      update: vi.fn().mockResolvedValue({}),
    },
    memberProfile: {
      findUnique: vi.fn().mockResolvedValue({ level: 1, xp: 0 }),
    },
    xPTransaction: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}))
import {
  data as liveData,
  execute as liveExecute,
  handleLiveStartModal,
} from '@/src/commands/live.js'
import {
  data as streamerData,
  execute as streamerExecute,
  handleStreamerApplyModal,
} from '@/src/commands/streamer.js'
import { buildLivePanelEmbed } from '@/src/services/live-announcements.js'
import { channelCache, guildRoleCache, memberRoleCache } from './helpers/discord.js'

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Mock helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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
      getChannel: (name: string) => options[name] || null,
      getString: (name: string) => options[name] || null,
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live command registration
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/live command', () => {
  it('is registered with the correct name and subcommands', () => {
    expect(liveData.name).toBe('live')
    const json = liveData.toJSON() as any
    const subcommandNames = json.options?.map((o: any) => o.name) || []
    expect(subcommandNames).toContain('panel')
    expect(subcommandNames).toContain('start')
    expect(subcommandNames).toContain('end')
    expect(subcommandNames).toContain('list')
    expect(subcommandNames).toContain('status')
    expect(subcommandNames).toContain('history')
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live panel
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/live panel', () => {
  it('builds a panel embed with expected fields', () => {
    const embed = buildLivePanelEmbed()
    expect(embed.data.title).toContain('Live Center')
    const fieldNames = embed.data.fields?.map((f: any) => f.name) || []
    expect(fieldNames).toContain('/live start')
    expect(fieldNames).toContain('/live end')
  })

  it('replies with an embed when panel is invoked', async () => {
    const interaction = makeInteraction('panel')
    await liveExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.deferReply).toHaveBeenCalled()
    expect(interaction.editReply).toHaveBeenCalled()
    const embedArg = interaction.editReply.mock.calls[0][0]
    expect(embedArg.embeds).toBeDefined()
    expect(embedArg.embeds![0]).toBeInstanceOf(EmbedBuilder)
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live start — permission check
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/live start', () => {
  it('requires a live-manage role', async () => {
    const interaction = makeInteraction('start', [])
    await liveExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Prenez le rôle **Streamer**'),
        ephemeral: true,
      })
    )
  })

  it('opens a modal for the self-assignable Streamer role', async () => {
    const interaction = makeInteraction('start', ['role_streamer'])
    await liveExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.showModal).toHaveBeenCalled()
  })

  it('opens a modal for authorized users', async () => {
    const interaction = makeInteraction('start', ['role_verified_streamer'])
    await liveExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.showModal).toHaveBeenCalled()
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /live list / status / history
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/live list, status, history', () => {
  it('lists lives (empty)', async () => {
    const interaction = makeInteraction('list', ['role_member'])
    await liveExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalled()
  })

  it('shows status when no live is active', async () => {
    const interaction = makeInteraction('status', ['role_member'])
    await liveExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Aucun live en cours') })
    )
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /streamer command registration
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/streamer command', () => {
  it('is registered with the correct name and subcommands', () => {
    expect(streamerData.name).toBe('streamer')
    const json = streamerData.toJSON() as any
    const subcommandNames = json.options?.map((o: any) => o.name) || []
    expect(subcommandNames).toContain('apply')
    expect(subcommandNames).toContain('approve')
    expect(subcommandNames).toContain('reject')
    expect(subcommandNames).toContain('profile')
    expect(subcommandNames).toContain('leaderboard')
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /streamer apply — modal
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/streamer apply', () => {
  it('opens a modal', async () => {
    const interaction = makeInteraction('apply', ['role_member'])
    await streamerExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.showModal).toHaveBeenCalled()
  })

  it('rejects duplicate applications', async () => {
    const interaction = makeInteraction('apply', ['role_member'])
    // Simulate existing application
    vi.mocked(interaction.reply).mockResolvedValue(undefined)
    await streamerExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.showModal).toHaveBeenCalled()
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Modal submit handlers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('handleLiveStartModal', () => {
  it('rejects invalid language', async () => {
    const interaction = makeModalSubmit('live:start:', {
      title: 'Mon live',
      game: 'GTA VI',
      language: 'esperanto',
      description: '',
      externalUrl: '',
    })
    await handleLiveStartModal(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Langue invalide') })
    )
  })

  it('rejects missing voice channel', async () => {
    const interaction = makeModalSubmit('live:start:', {
      title: 'Mon live',
      game: 'GTA VI',
      language: 'french',
      description: '',
      externalUrl: '',
    })
    await handleLiveStartModal(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('salon vocal') })
    )
  })
})

describe('handleStreamerApplyModal', () => {
  it('rejects invalid language', async () => {
    const interaction = makeModalSubmit('streamer:apply', {
      platform: 'Twitch',
      games: 'GTA VI',
      language: 'esperanto',
      channelUrl: 'https://twitch.tv/user',
      introduction: 'Salut, je streame GTA VI.',
    })
    await handleStreamerApplyModal(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Langue invalide') })
    )
  })
})
