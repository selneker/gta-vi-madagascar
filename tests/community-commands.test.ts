import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/db.js', () => ({
  db: {
    memberProfile: {
      upsert: vi.fn().mockResolvedValue({ userId: 'user-1', xp: 100, level: 1 }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    xPTransaction: {
      create: vi.fn().mockResolvedValue({}),
    },
    event: {
      create: vi.fn().mockResolvedValue({ id: 'evt-1', title: 'Test Event' }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    eventParticipant: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    ticket: {
      create: vi.fn().mockResolvedValue({ id: 'tk-1' }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}))
import { db } from '@/src/lib/db.js'
import {
  data as communityData,
  execute as communityExecute,
} from '@/src/commands/community.js'
import {
  awardXp,
  getProfile,
  createEvent,
  listEvents,
  registerEvent,
  createTicket,
  closeTicket,
  submitSuggestion,
} from '@/src/services/community-center.js'

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Mock helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function makeMember(roleIds: string[] = []) {
  return {
    id: 'user-1',
    roles: { cache: new Map(roleIds.map((id) => [id, { id }])) },
  } as any
}

function makeGuild(roleIds: string[] = [], channelNames: string[] = []) {
  return {
    id: 'guild-1',
    roles: { cache: new Map(roleIds.map((id) => [id, { id }])) },
    channels: {
      cache: new Map(
        channelNames.map((name) => [name, { id: `ch-${name}`, name, type: 0, isTextBased: () => true }])
      ),
    },
    members: { cache: new Map() },
  } as any
}

function makeInteraction(subcommand: string, memberRoles: string[] = [], options: Record<string, any> = {}) {
  return {
    inGuild: () => true,
    guild: makeGuild(memberRoles),
    member: makeMember(memberRoles),
    user: { id: 'user-1', username: 'testuser', displayAvatarURL: () => 'https://example.com/avatar.png' },
    options: {
      getSubcommand: () => subcommand,
      getString: (name: string) => options[name] || null,
      getUser: (name: string) => options[name] || null,
      getChannel: (name: string) => options[name] || null,
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined),
    followedUp: false,
    replied: false,
    deferred: false,
    followUp: vi.fn().mockResolvedValue(undefined),
    channelId: 'ch-1',
  } as any
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /community command registration
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/community command', () => {
  it('is registered with the correct name and subcommands', () => {
    expect(communityData.name).toBe('community')
    const json = communityData.toJSON() as any
    const subcommandNames = json.options?.map((o: any) => o.name) || []
    expect(subcommandNames).toContain('profile')
    expect(subcommandNames).toContain('event')
    expect(subcommandNames).toContain('ticket')
    expect(subcommandNames).toContain('suggest')
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /community profile
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/community profile', () => {
  it('shows profile with default level when none exists', async () => {
    const interaction = makeInteraction('profile', ['role_member'])
    await communityExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalled()
    const embedArg = interaction.editReply.mock.calls[0][0]
    expect(embedArg.embeds).toBeDefined()
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /community event
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/community event', () => {
  it('lists events (empty)', async () => {
    const interaction = makeInteraction('event', ['role_member'], { action: 'list' })
    await communityExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalled()
  })

  it('create requires start and end dates', async () => {
    const interaction = makeInteraction('event', ['role_member'], {
      action: 'create',
      titre: 'Test Event',
      type: 'COMMUNITY_NIGHT',
    })
    await communityExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('dates') })
    )
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /community ticket
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/community ticket', () => {
  it('open creates a ticket', async () => {
    const interaction = makeInteraction('ticket', ['role_member'], { action: 'open' })
    await communityExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalled()
  })

  it('close closes a ticket', async () => {
    const interaction = makeInteraction('ticket', ['role_member'], { action: 'close' })
    await communityExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalled()
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /community suggest
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('/community suggest', () => {
  it('submits a suggestion', async () => {
    const interaction = makeInteraction('suggest', ['role_member'], {
      titre: 'Test suggestion',
      description: 'This is a test suggestion.',
    })
    await communityExecute(interaction, { db: {} as any, logger: console })
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('soumise') })
    )
  })
})

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Community service
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe('community service', () => {
  it('awardXp creates a profile and transaction', async () => {
    const result = await awardXp('user-1', 'guild-1', 100, 'Test reason', 'test')
    expect(result.profile.xp).toBe(100)
    expect(result.profile.level).toBe(1)
  })

  it('getProfile returns null for non-matching guild', async () => {
    const profile = await getProfile('user-1', 'wrong-guild')
    expect(profile).toBeNull()
  })

  it('createEvent creates an event', async () => {
    const event = await createEvent('guild-1', 'user-1', {
      title: 'Test Event',
      type: 'COMMUNITY_NIGHT',
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 3600000),
    })
    expect(event.title).toBe('Test Event')
  })

  it('listEvents returns events', async () => {
    const events = await listEvents('guild-1')
    expect(Array.isArray(events)).toBe(true)
  })

  it('registerEvent registers a participant', async () => {
    vi.mocked(db.event.findUnique).mockResolvedValueOnce({ id: 'evt-1' } as any)
    const result = await registerEvent('evt-1', 'user-1')
    expect(result).toBeDefined()
  })

  it('createTicket creates a ticket', async () => {
    const ticket = await createTicket('guild-1', 'user-1', 'ch-1', 'SUPPORT')
    expect(ticket.id).toBe('tk-1')
  })

  it('closeTicket closes a ticket', async () => {
    vi.mocked(db.ticket.findUnique).mockResolvedValueOnce({ id: 'tk-1', status: 'OPEN' } as any)
    vi.mocked(db.ticket.update).mockResolvedValueOnce({ status: 'CLOSED' } as any)
    const result = await closeTicket('ch-1', 'user-1')
    expect(result.status).toBe('CLOSED')
  })

  it('submitSuggestion returns a suggestion', async () => {
    const sugg = await submitSuggestion('guild-1', 'user-1', 'Title', 'Description')
    expect(sugg.title).toBe('Title')
    expect(sugg.status).toBe('OPEN')
  })
})
