import type { CityEvent, DataSource, ScraperRun, EventCategory } from '../types'
import { analyzeRealEvent } from '../lib/impact'
import { UNAVAILABLE } from '../lib/labels'
import { isUpcomingStart } from '../lib/format'
import { setFrozenNow } from '../lib/clock'

/**
 * Client for the real ingestion backend (/api). Maps API rows into the
 * frontend event shape. Impact scores are computed client-side as an
 * ANALYSIS layer — factual fields (dates, venues, attendance) are never
 * invented; anything the sources did not provide stays null.
 */

interface ApiEventSource {
  sourceId: string
  sourceName: string
  sourceUrl: string | null
  priority: number
}

export interface ApiEvent {
  id: number
  title: string
  description: string | null
  category: string
  city: string
  district: string | null
  venue: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  start_time: string | null
  end_time: string | null
  date_precision: string | null
  status: 'scheduled' | 'cancelled' | 'postponed'
  organizer: string | null
  image_url: string | null
  event_url: string | null
  ticket_url: string | null
  source_confidence: number
  source_status: string
  source_conflict: number
  last_verified_at: string | null
  location_precision: string | null
  sources: ApiEventSource[]
}

interface ApiSource {
  id: string
  name: string
  city: string
  district: string | null
  type: string
  url: string
  enabled: number
  scrape_interval_minutes: number
  last_run: string | null
  status: string
  notes: string | null
  events_collected: number
  new_events_24h: number
  successful_runs: number
  total_runs: number
}

interface ApiRun {
  id: number
  source_id: string
  source_name: string
  started_at: string
  finished_at: string | null
  status: string
  events_found: number
  events_created: number
  events_updated: number
  events_removed: number
  events_unchanged: number
  duplicates: number
  errors: number
  message: string | null
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  municipality: 'Büyükşehir belediyesi',
  district_municipality: 'İlçe belediyesi',
  venue: 'Mekân takvimi',
  ticketing: 'Bilet platformu',
  sports: 'Spor federasyonu',
  organizer: 'Resmi organizatör',
  news: 'Yerel haber / etkinlik rehberi',
  political: 'Siyasi parti takvimi',
  education: 'Üniversite / eğitim',
  cultural: 'Kültür kurumu',
  other: 'Diğer kamu kaynağı',
}

export const IS_DEMO = import.meta.env.MODE === 'demo'

const DEMO_FILES: Record<string, string> = {
  '/api/events?verified=true': 'events.json',
  '/api/sources': 'sources.json',
  '/api/scrape-runs?limit=100': 'runs.json',
}

let demoClock: Promise<void> | null = null

/** Demo saatini veri anlık görüntüsünün tarihine sabitler. */
function ensureDemoClock(): Promise<void> {
  demoClock ??= fetch(`${import.meta.env.BASE_URL}demo-data/meta.json`, { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`demo verisi → HTTP ${r.status}`)
      return r.json() as Promise<{ snapshotAt: string }>
    })
    .then((m) => setFrozenNow(m.snapshotAt))
  return demoClock
}

async function getJson<T>(path: string): Promise<T> {
  if (IS_DEMO) await ensureDemoClock()
  const url = IS_DEMO ? `${import.meta.env.BASE_URL}demo-data/${DEMO_FILES[path]}` : path
  // Demo verisi yeniden yayınlandığında tarayıcı önbelleğindeki eski kopya gösterilmesin.
  const res = await fetch(url, { headers: { accept: 'application/json' }, cache: IS_DEMO ? 'no-cache' : 'default' })
  if (!res.ok) throw new Error(`API ${path} → HTTP ${res.status}`)
  return (await res.json()) as T
}

/** Bazı belediye sayfalarında açıklama yerine site menüsü geliyor; bunu göstermeyiz. */
const cleanDescription = (d: string | null): string | null =>
  d && !/e-?belediye|e-?işlem/i.test(d) ? d : null

export function mapApiEvent(e: ApiEvent): CityEvent {
  const analysis = analyzeRealEvent({
    category: e.category,
    title: e.title,
    venue: e.venue,
    startTime: e.start_time,
    sourceCount: e.sources.length,
    city: e.city,
  })
  const primarySource = [...e.sources].sort((a, b) => a.priority - b.priority)[0]
  return {
    id: String(e.id),
    name: e.title,
    category: (e.category as EventCategory) ?? 'Community',
    city: e.city,
    district: e.district ?? '—',
    venue: e.venue ?? UNAVAILABLE,
    address: e.address ?? UNAVAILABLE,
    date: e.start_time ? e.start_time.slice(0, 10) : '',
    startTime: e.start_time && e.date_precision === 'datetime' ? e.start_time.slice(11, 16) : '—',
    endTime: e.end_time && e.end_time !== e.start_time ? e.end_time.slice(11, 16) : null,
    attendance: null, // never estimated at ingestion; only real source-provided values
    ticketed: e.ticket_url ? true : null,
    price: null,
    organizer: e.organizer ?? UNAVAILABLE,
    source: primarySource?.sourceName ?? 'Bilinmeyen kaynak',
    sourceUrl: e.event_url ?? primarySource?.sourceUrl ?? '',
    impactScore: analysis.impactScore,
    parkingImpact: analysis.parkingImpact,
    scooterDemand: analysis.scooterDemand,
    lat: e.location_precision === 'source' || e.location_precision === 'geocoded' ? e.latitude : null,
    lng: e.location_precision === 'source' || e.location_precision === 'geocoded' ? e.longitude : null,
    locationPrecision:
      e.location_precision === 'source' || e.location_precision === 'geocoded' ? e.location_precision : undefined,
    description: cleanDescription(e.description) ?? 'Kaynak açıklama yayımlamamış.',
    eventStatus: e.status,
    sourceStatus: e.source_status,
    sourceConfidence: e.source_confidence,
    sourceConflict: e.source_conflict === 1,
    lastVerifiedAt: e.last_verified_at,
    sourceCount: e.sources.length,
  }
}

function mapApiSource(s: ApiSource): DataSource {
  const reliability = s.total_runs > 0 ? (s.successful_runs / s.total_runs) * 100 : 0
  return {
    id: s.id,
    name: s.name,
    type: SOURCE_TYPE_LABEL[s.type] ?? s.type,
    url: s.url,
    status: (s.status as DataSource['status']) ?? 'inactive',
    lastRun: s.last_run ?? '',
    nextRun: '',
    eventsCollected: s.events_collected,
    newEventsLast24h: s.new_events_24h,
    coverage: [s.district ? `${s.city} / ${s.district}` : s.city],
    interval: s.enabled
      ? s.scrape_interval_minutes >= 60
        ? `Her ${s.scrape_interval_minutes / 60} saatte`
        : `Her ${s.scrape_interval_minutes} dakikada`
      : 'Duraklatıldı',
    reliability,
  }
}

function mapApiRun(r: ApiRun): ScraperRun {
  return {
    id: `run-${r.id}`,
    sourceId: r.source_id,
    sourceName: r.source_name,
    startedAt: r.started_at,
    durationSec: r.finished_at ? Math.max(0, Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)) : 0,
    status: (['success', 'partial', 'failed', 'running'].includes(r.status) ? r.status : 'failed') as ScraperRun['status'],
    eventsFound: r.events_found,
    newEvents: r.events_created,
    updatedEvents: r.events_updated,
    message:
      r.message ??
      `${r.events_found} bulundu · ${r.events_created} yeni · ${r.events_updated} güncellendi · ${r.duplicates} yinelenen birleştirildi · ${r.errors} hata`,
  }
}

export async function fetchEvents(): Promise<CityEvent[]> {
  const rows = await getJson<ApiEvent[]>('/api/events?verified=true')
  return rows
    .filter((e) => e.start_time && e.source_status === 'ok' && e.last_verified_at)
    .filter((e) => e.start_time ? isUpcomingStart(e.start_time) : false)
    .map(mapApiEvent)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

export async function fetchSources(): Promise<DataSource[]> {
  return (await getJson<ApiSource[]>('/api/sources')).map(mapApiSource)
}

export async function fetchRuns(): Promise<ScraperRun[]> {
  return (await getJson<ApiRun[]>('/api/scrape-runs?limit=100')).map(mapApiRun)
}

export async function triggerRun(sourceId: string): Promise<void> {
  const res = await fetch(`/api/scrapers/${sourceId}/run`, { method: 'POST' })
  if (!res.ok) throw new Error(`çalıştırma başarısız: HTTP ${res.status}`)
}
