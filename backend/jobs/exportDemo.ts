import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Çalışan API'den salt okunur demo verisi üretir (public/demo-data).
 * Ham sayfa içeriği, kaynak notları ve görseller dışarı aktarılmaz.
 */
const API = process.env.DEMO_API_URL ?? 'http://localhost:3001'
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'demo-data')

type Row = Record<string, unknown>

async function get(path: string): Promise<Row[]> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  return (await res.json()) as Row[]
}

const PHONE_RE = /(?:\+?90[\s.-]?)?\(?0?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g

const shorten = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null
  const text = v.replace(PHONE_RE, '[iletişim bilgisi kaynakta]')
  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text
}

async function main(): Promise<void> {
  const [events, sources, runs] = await Promise.all([
    get('/api/events?verified=true'),
    get('/api/sources'),
    get('/api/scrape-runs?limit=500'),
  ])

  const activeSources = sources.filter((s) => s.enabled === 1)
  const activeIds = new Set(activeSources.map((s) => s.id))

  const write = (name: string, data: unknown) => writeFileSync(join(outDir, name), JSON.stringify(data))
  mkdirSync(outDir, { recursive: true })

  write(
    'events.json',
    events
      .filter((e) => e.source_status === 'ok')
      .map((e) => ({ ...e, description: shorten(e.description), image_url: null })),
  )
  write('sources.json', activeSources.map((s) => ({ ...s, notes: null })))
  write(
    'runs.json',
    runs
      .filter((r) => activeIds.has(r.source_id))
      .slice(0, 100)
      .map((r) => ({ ...r, message: null })),
  )
  write('meta.json', { snapshotAt: new Date().toISOString() })

  console.log(`[demo] ${events.length} etkinlik, ${activeSources.length} kaynak → ${outDir}`)
}

main().catch((e: Error) => {
  console.error(`[demo] dışa aktarma başarısız: ${e.message}. Önce "npm run server" çalıştırın.`)
  process.exit(1)
})
