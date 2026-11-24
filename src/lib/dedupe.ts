import { createHash } from 'crypto'

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'igsc', 'mc_cid', 'mc_eid',
])

export function normalizeUrl(url: string): string {
  const u = new URL(url)
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
  u.hash = ''
  const kept = [...u.searchParams.entries()].filter(([key]) => !TRACKING_PARAMS.has(key))
  u.search = kept.length ? '?' + kept.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&') : ''
  let pathname = u.pathname.replace(/\/+$/, '') || '/'
  return `${u.origin}${pathname}${u.search}`
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[.,:;!?«»"'“”()\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function newsFingerprint(title: string, sourceUrl?: string): string {
  const parts = [normalizeTitle(title)]
  if (sourceUrl) parts.push(normalizeUrl(sourceUrl))
  return createHash('sha1').update(parts.join('|')).digest('hex')
}
