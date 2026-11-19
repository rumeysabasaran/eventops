import express from 'express'
import cors from 'cors'
import { db } from './database/db.js'
import { syncRegistry, adapterById, ADAPTERS } from './registry.js'
import { runSource } from './jobs/runSource.js'
import { startScheduler } from './jobs/scheduler.js'
import { ingestHolidays } from './jobs/holidays.js'
import { istanbulCalendarDate } from './services/normalization/dates.js'
import { recategorizeStoredEvents } from './jobs/recategorize.js'
import { runVenueGeocoder } from './plugins/venueGeocoder/index.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = Number(process.env.PORT ?? 3001)

/* ── events ──────────────────────────────────────────────────────────── */

interface EventQueryRow {
  [key: string]: unknown
  id: number
  sources_json: string | null
}

app.get('/api/events', (req, res) => {
  const { city, verified, status, from, to, upcoming } = req.query as Record<string, string | undefined>
  const where: string[] = []
  const params: unknown[] = []

  if (city) {
    where.push('e.city = ?')
    params.push(city)
  }
  if (verified === 'true') {
    where.push(`e.source_status = 'ok' AND e.last_verified_at IS NOT NULL`)
  }
  if (status) {
    where.push('e.status = ?')
    params.push(status)
  }
  if (from) {
    where.push('e.start_time >= ?')
    params.push(from)
  }
  if (to) {
    where.push('e.start_time <= ?')
    params.push(to)
  }
  if (upcoming !== 'false') {
    const today = istanbulCalendarDate()
    where.push(`substr(e.start_time, 1, 10) >= ?`)
    params.push(today)
  }

  const rows = db
    .prepare(
      `SELECT e.*,
         (SELECT json_group_array(json_object(
            'sourceId', es.source_id, 'sourceName', s.name, 'sourceUrl', es.source_url,
            'priority', es.priority, 'firstSeenAt', es.first_seen_at, 'lastSeenAt', es.last_seen_at))
          FROM event_sources es JOIN sources s ON s.id = es.source_id
          WHERE es.event_id = e.id) AS sources_json
       FROM events e
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY e.start_time ASC
       LIMIT 1000`,
    )
    .all(...params) as EventQueryRow[]

  res.json(
    rows.map((r) => ({
      ...r,
      sources: r.sources_json ? JSON.parse(r.sources_json) : [],
      sources_json: undefined,
    })),
  )
})

app.get('/api/events/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM events WHERE id=?`).get(req.params.id) as EventQueryRow | undefined
  if (!row) {
    res.status(404).json({ error: 'event not found' })
    return
  }
  const sources = db
    .prepare(
      `SELECT es.source_id AS sourceId, s.name AS sourceName, es.source_url AS sourceUrl,
              es.priority, es.first_seen_at AS firstSeenAt, es.last_seen_at AS lastSeenAt
       FROM event_sources es JOIN sources s ON s.id = es.source_id WHERE es.event_id = ?`,
    )
    .all(row.id)
  const changes = db
    .prepare(`SELECT changed_at, field, previous_value, current_value, source_id FROM event_changes WHERE event_id=? ORDER BY changed_at DESC LIMIT 50`)
    .all(row.id)
  res.json({ ...row, sources, changes })
})

/* ── sources & runs ──────────────────────────────────────────────────── */

app.get('/api/sources', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*,
         (SELECT COUNT(*) FROM event_sources es WHERE es.source_id = s.id) AS events_collected,
         (SELECT COUNT(*) FROM event_sources es WHERE es.source_id = s.id AND es.first_seen_at >= datetime('now','-1 day')) AS new_events_24h,
         (SELECT COUNT(*) FROM scrape_runs r WHERE r.source_id = s.id AND r.status = 'success') AS successful_runs,
         (SELECT COUNT(*) FROM scrape_runs r WHERE r.source_id = s.id) AS total_runs
       FROM sources s ORDER BY s.enabled DESC, s.name`,
    )
    .all()
  res.json(rows)
})

app.get('/api/scrape-runs', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500)
  const rows = db
    .prepare(
      `SELECT r.*, s.name AS source_name FROM scrape_runs r
       JOIN sources s ON s.id = r.source_id
       ORDER BY r.started_at DESC LIMIT ?`,
    )
    .all(limit)
  res.json(rows)
})

app.get('/api/scrape-errors', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500)
  res.json(db.prepare(`SELECT * FROM scrape_errors ORDER BY occurred_at DESC LIMIT ?`).all(limit))
})

app.post('/api/scrapers/:sourceId/run', (req, res) => {
  const adapter = adapterById(req.params.sourceId)
  if (!adapter) {
    res.status(404).json({ error: `no adapter for source '${req.params.sourceId}'`, known: ADAPTERS.map((a) => a.config.id) })
    return
  }
  // fire-and-report: run synchronously so the caller gets real stats
  runSource(adapter)
    .then((stats) => res.json({ sourceId: adapter.config.id, ...stats }))
    .catch((e) => res.status(500).json({ error: (e as Error).message }))
})

/* ── plugins ─────────────────────────────────────────────────────────── */

app.post('/api/plugins/venue-geocoder/run', (req, res) => {
  const raw = Number((req.body as { limit?: number } | undefined)?.limit ?? 40)
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 80) : 40
  runVenueGeocoder(limit)
    .then((r) => res.json(r))
    .catch((e) => res.status(500).json({ error: (e as Error).message }))
})

/* ── holidays ────────────────────────────────────────────────────────── */

app.get('/api/holidays', (_req, res) => {
  res.json(db.prepare(`SELECT * FROM holidays ORDER BY date`).all())
})

app.post('/api/holidays/refresh', (_req, res) => {
  ingestHolidays()
    .then((r) => res.json(r))
    .catch((e) => res.status(500).json({ error: (e as Error).message }))
})

/* ── boot ────────────────────────────────────────────────────────────── */

syncRegistry()
{
  const r = recategorizeStoredEvents()
  if (r.updated > 0) console.log(`[category] recategorized ${r.updated}/${r.checked} events`)
}
app.listen(PORT, () => {
  console.log(`[api] City Event Intelligence backend listening on http://localhost:${PORT}`)
  startScheduler()
})
