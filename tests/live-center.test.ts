import { describe, it, expect } from 'vitest'
import {
  resolveVoiceChannelByName,
  listEligibleVoiceChannels,
} from '@/src/services/live-center.js'

const voiceChannels = [
  { id: 'vc-1', name: '🎮・STREAM ROOM 01', type: 2, parentId: 'cat-live' },
  { id: 'vc-2', name: '🎮・STREAM ROOM 02', type: 2, parentId: 'cat-live' },
  { id: 'vc-3', name: '👥・SQUAD LIVE', type: 2, parentId: 'cat-live' },
  { id: 'vc-4', name: '🔴・CREATE YOUR LIVE ROOM', type: 2, parentId: 'cat-live' },
  { id: 'vc-5', name: 'general-voice', type: 2, parentId: null }, // no parent = not eligible
  { id: 'tc-1', name: 'text-channel', type: 0, parentId: 'cat-live' }, // text = not voice
]

describe('resolveVoiceChannelByName', () => {
  it('resolves a voice channel by exact name (case-insensitive)', () => {
    const found = resolveVoiceChannelByName('guild-1', '🎮・STREAM ROOM 01', voiceChannels)
    expect(found).toEqual({ id: 'vc-1', name: '🎮・STREAM ROOM 01' })
  })

  it('resolves voice channel by lowercase name', () => {
    const found = resolveVoiceChannelByName('guild-1', '🎮・stream room 02', voiceChannels)
    expect(found).toEqual({ id: 'vc-2', name: '🎮・STREAM ROOM 02' })
  })

  it('returns null for non-existent channel', () => {
    const found = resolveVoiceChannelByName('guild-1', 'nonexistent', voiceChannels)
    expect(found).toBeNull()
  })

  it('returns null for text channels', () => {
    const found = resolveVoiceChannelByName('guild-1', 'text-channel', voiceChannels)
    expect(found).toBeNull()
  })
})

describe('listEligibleVoiceChannels', () => {
  it('returns only voice channels with a parent category', () => {
    const eligible = listEligibleVoiceChannels(voiceChannels)
    expect(eligible.map((c) => c.id)).toEqual(['vc-1', 'vc-2', 'vc-3', 'vc-4'])
  })

  it('excludes voice channels without a parent', () => {
    const eligible = listEligibleVoiceChannels(voiceChannels)
    expect(eligible.find((c) => c.id === 'vc-5')).toBeUndefined()
  })

  it('excludes non-voice channels', () => {
    const eligible = listEligibleVoiceChannels(voiceChannels)
    expect(eligible.find((c) => c.id === 'tc-1')).toBeUndefined()
  })
})
