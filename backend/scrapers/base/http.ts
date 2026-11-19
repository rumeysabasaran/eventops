import type { FetchedDocument } from '../../types.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 CityEventIntelligence/1.0'

export class BlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockedError'
  }
}

/* ── robots.txt (User-agent: *) ──────────────────────────────────────── */

const robotsCache = new Map<string, string[]>()

async function disallowedPrefixes(origin: string): Promise<string[]> {
  const cached = robotsCache.get(origin)
  if (cached) return cached
  let prefixes: string[] = []
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const text = await res.text()
      let applies = false
      for (const line of text.split(/\r?\n/)) {
        const [rawKey, ...rest] = line.split(':')
        const key = rawKey?.trim().toLowerCase()
        const value = rest.join(':').trim()
        if (key === 'user-agent') applies = value === '*'
        else if (applies && key === 'disallow' && value) prefixes.push(value)
      }
    }
  } catch {
    prefixes = [] // robots unavailable → no restrictions recorded
  }
  robotsCache.set(origin, prefixes)
  return prefixes
}

export async function assertAllowedByRobots(url: string): Promise<void> {
  const u = new URL(url)
  const prefixes = await disallowedPrefixes(u.origin)
  for (const p of prefixes) {
    if (p === '/') throw new BlockedError(`robots.txt disallows all paths on ${u.origin}`)
    if (u.pathname.startsWith(p)) throw new BlockedError(`robots.txt disallows ${p} on ${u.origin}`)
  }
}

/* ── charset-aware fetch ─────────────────────────────────────────────── */

function detectCharset(contentTypeHeader: string | null, bytes: Uint8Array): string {
  const fromHeader = contentTypeHeader?.match(/charset=([\w-]+)/i)?.[1]
  if (fromHeader) return fromHeader.toLowerCase()
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 2048))
  const fromMeta =
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    head.match(/content=["'][^"']*charset=([\w-]+)/i)?.[1]
  return (fromMeta ?? 'utf-8').toLowerCase()
}

export async function fetchDocument(url: string, opts?: { json?: boolean }): Promise<FetchedDocument> {
  await assertAllowedByRobots(url)
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: opts?.json ? 'application/json,*/*;q=0.8' : 'text/html,application/xhtml+xml,*/*;q=0.8',
      'accept-language': 'tr-TR,tr;q=0.9,en;q=0.6',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  })

  if (res.status === 403 || res.status === 429) {
    throw new BlockedError(`HTTP ${res.status} from ${url} — treating as blocked (no bypass attempted)`)
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`)
  }

  const buf = new Uint8Array(await res.arrayBuffer())
  let charset = detectCharset(res.headers.get('content-type'), buf)
  if (charset === 'iso-8859-9') charset = 'windows-1254'
  let content: string
  try {
    content = new TextDecoder(charset).decode(buf)
  } catch {
    content = new TextDecoder('utf-8').decode(buf)
  }

  return {
    url,
    finalUrl: res.url || url,
    httpStatus: res.status,
    contentType: opts?.json ? 'json' : 'html',
    content,
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
