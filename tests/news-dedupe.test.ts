import { describe, it, expect } from 'vitest'
import { normalizeUrl, normalizeTitle, newsFingerprint } from '@/src/lib/dedupe.js'

describe('normalizeUrl', () => {
  it('lowercases host and strips www', () => {
    expect(normalizeUrl('https://WWW.Example.Com/News/')).toBe('https://example.com/News')
  })

  it('strips tracking parameters', () => {
    expect(normalizeUrl('https://example.com/news?utm_source=twitter&id=123')).toBe('https://example.com/news?id=123')
  })

  it('removes fragment', () => {
    expect(normalizeUrl('https://example.com/news#section')).toBe('https://example.com/news')
  })
})

describe('normalizeTitle', () => {
  it('lowercases, trims and removes punctuation', () => {
    expect(normalizeTitle('  GTA VI : Date de sortie !  ')).toBe('gta vi date de sortie')
    expect(normalizeTitle('GTA VI...  date de sortie!!')).toBe('gta vi date de sortie')
  })
})

describe('newsFingerprint', () => {
  it('is stable for the same article with different tracking params', () => {
    const a = newsFingerprint('GTA VI annoncé', 'https://example.com/news?utm_source=twitter')
    const b = newsFingerprint('GTA VI annoncé', 'https://example.com/news?utm_source=facebook')
    expect(a).toBe(b)
  })

  it('differs for different titles', () => {
    expect(newsFingerprint('Titre A')).not.toBe(newsFingerprint('Titre B'))
  })

  it('works without a source URL', () => {
    expect(typeof newsFingerprint('Seul un titre')).toBe('string')
  })
})
