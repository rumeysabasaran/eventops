import { createHash } from 'node:crypto'
import { db, nowIso } from '../database/db.js'
import type { EventSourceAdapter } from '../scrapers/base/EventSourceAdapter.js'
import { SOURCE_TYPE_PRIORITY, SOURCE_TYPE_CONFIDENCE } from '../scrapers/base/EventSourceAdapter.js'
import { BlockedError } from '../scrapers/base/http.js'
import { canonicalKey, findDuplicate, type ExistingEventRow } from '../services/deduplication/dedupe.js'
import type { NormalizedEvent, RunStats } from '../types.js'

const CHANGE_FIELDS = [
  'title',
  'start_time',
  'end_time',
  'venue',
  'address',
  'status',
  'event_url',
] as const

interface EventRow {
  [key: string]: unknown
  id: number
  canonical_key: string
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
  status: string
  organizer: string | null
  image_url: string | null
  event_url: string | null
  ticket_url: string | null
  source_conflict: number
}

const toRowValues = (e: NormalizedEvent) => ({
  title: e.title,
  description: e.description,
  category: e.category,
  city: e.city,
  district: e.district,
  venue: e.venue,
  address: e.address,
  latitude: e.latitude,
  longitude: e.longitude,
  location_precision: e.locationPrecision,
  start_time: e.startTime,
  end_time: e.endTime,
  date_precision: e.datePrecision,
  status: e.status,
  organizer: e.organizer,
  image_url: e.imageUrl,
  event_url: e.eventUrl,
  ticket_url: e.ticketUrl,
})

function recordChanges(eventId: number, sourceId: string, before: EventRow, after: Record<string, unknown>): number {
  let changes = 0
  const insert = db.prepare(
    `INSERT INTO event_changes (event_id, source_id, changed_at, field, previous_value, current_value)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  for (const field of CHANGE_FIELDS) {
    const prev = (before as Record<string, unknown>)[field] ?? null
    const next = after[field] ?? null
    if (next !== null && prev !== next) {
      insert.run(eventId, sourceId, nowIso(), field, prev === null ? null : String(prev), String(next))
      changes++
    }
  }
  return changes
}

/** Execute the full pipeline for one source adapter. */
export async function runSource(adapter: EventSourceAdapter): Promise<RunStats> {
  const source = adapter.config
  const priority = SOURCE_TYPE_PRIORITY[source.type] ?? 6
  const baseConfidence = SOURCE_TYPE_CONFIDENCE[source.type] ?? 0.6
  const startedAt = nowIso()

  const runId = db
    .prepare(`INSERT INTO scrape_runs (source_id, started_at, status) VALUES (?, ?, 'running')`)
    .run(source.id, startedAt).lastInsertRowid as number

  const stats: RunStats = {
    eventsFound: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsRemoved: 0,
    eventsUnchanged: 0,
    duplicates: 0,
    errors: 0,
  }

  const logError = (message: string, context?: string) => {
    stats.errors++
    db.prepare(
      `INSERT INTO scrape_errors (run_id, source_id, occurred_at, message, context) VALUES (?, ?, ?, ?, ?)`,
    ).run(runId, source.id, nowIso(), message.slice(0, 500), context?.slice(0, 1000) ?? null)
  }

  try {
    const docs = await adapter.fetch()
    const parsedEvents = await adapter.parse(docs)
    stats.eventsFound = parsedEvents.length

    const seenKeys: string[] = []

    for (const parsed of parsedEvents) {
      try {
        // 1. RAW preservation (original payload before normalization)
        const rawJson = JSON.stringify(parsed.raw ?? {})
        const contentHash = createHash('sha1').update(`${parsed.externalKey}|${rawJson}`).digest('hex')
        const sourceDoc = docs.find((d) => d.finalUrl === parsed.sourceUrl || d.url === parsed.sourceUrl)
        const rawEventId = db
          .prepare(
            `INSERT INTO raw_events (source_id, external_key, fetched_at, source_url, raw_content, parsed_json, content_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            source.id,
            parsed.externalKey,
            nowIso(),
            parsed.eventUrl ?? parsed.sourceUrl,
            sourceDoc ? sourceDoc.content.slice(0, 60_000) : null,
            rawJson,
            contentHash,
          ).lastInsertRowid as number

        // 2. NORMALIZE
        const normalized = adapter.normalize(parsed)
        if (!normalized) {
          logError(`normalization produced no event for ${parsed.externalKey}`)
          continue
        }

        // 3. VALIDATE
        const validation = adapter.validate(normalized)
        if (!validation.ok) {
          const archiveOnly =
            validation.errors.length > 0 &&
            validation.errors.every((err) => err.includes('more than 400 days in the past'))
          if (archiveOnly) continue
          logError(`validation failed for "${normalized.title}": ${validation.errors.join('; ')}`, parsed.dateText ?? undefined)
          continue
        }

        seenKeys.push(parsed.externalKey)

        // 4. DEDUPLICATE / UPSERT
        const existingRef = db
          .prepare(`SELECT event_id FROM event_sources WHERE source_id=? AND external_key=?`)
          .get(source.id, parsed.externalKey) as { event_id: number } | undefined

        let eventRow: EventRow | undefined
        if (existingRef) {
          eventRow = db.prepare(`SELECT * FROM events WHERE id=?`).get(existingRef.event_id) as EventRow | undefined
        } else {
          // cross-source duplicate search: same city + same start date
          const day = normalized.startTime?.slice(0, 10)
          if (day) {
            const candidates = db
              .prepare(
                `SELECT id, title, venue, start_time, city FROM events
                 WHERE city=? AND start_time IS NOT NULL AND substr(start_time,1,10)=?`,
              )
              .all(normalized.city, day) as ExistingEventRow[]
            const dup = findDuplicate(normalized, candidates)
            if (dup) {
              eventRow = db.prepare(`SELECT * FROM events WHERE id=?`).get(dup.id) as EventRow
              stats.duplicates++
            }
          }
        }

        const values = toRowValues(normalized)

        if (!eventRow) {
          // INSERT new canonical event
          const id = db
            .prepare(
              `INSERT INTO events (canonical_key, title, description, category, city, district, venue, address,
                 latitude, longitude, location_precision, start_time, end_time, date_precision, status, organizer, image_url,
                 event_url, ticket_url, source_confidence, source_status, created_at, updated_at, last_verified_at)
               VALUES (@canonical_key, @title, @description, @category, @city, @district, @venue, @address,
                 @latitude, @longitude, @location_precision, @start_time, @end_time, @date_precision, @status, @organizer, @image_url,
                 @event_url, @ticket_url, @confidence, 'ok', @now, @now, @now)`,
            )
            .run({
              ...values,
              canonical_key: canonicalKey(normalized),
              confidence: baseConfidence,
              now: nowIso(),
            }).lastInsertRowid as number

          db.prepare(
            `INSERT INTO event_sources (event_id, source_id, raw_event_id, external_key, source_url, priority, first_seen_at, last_seen_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(id, source.id, rawEventId, parsed.externalKey, normalized.eventUrl ?? normalized.sourceUrl, priority, nowIso(), nowIso())
          stats.eventsCreated++
        } else {
          // MERGE into existing canonical event
          db.prepare(
            `INSERT INTO event_sources (event_id, source_id, raw_event_id, external_key, source_url, priority, first_seen_at, last_seen_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(source_id, external_key) DO UPDATE SET last_seen_at=excluded.last_seen_at, raw_event_id=excluded.raw_event_id`,
          ).run(eventRow.id, source.id, rawEventId, parsed.externalKey, normalized.eventUrl ?? normalized.sourceUrl, priority, nowIso(), nowIso())

          const bestPriority = (
            db
              .prepare(`SELECT MIN(priority) AS p FROM event_sources WHERE event_id=?`)
              .get(eventRow.id) as { p: number }
          ).p

          // Conflict detection on core facts against what is stored.
          const conflictingFields = (['start_time', 'venue'] as const).filter((f) => {
            const next = values[f]
            const prev = (eventRow as Record<string, unknown>)[f]
            return next !== null && prev !== null && next !== prev
          })
          const hasConflict = conflictingFields.length > 0 && priority > bestPriority

          if (priority <= bestPriority) {
            // This source is authoritative (or tied) → update fields, record changes.
            const changed = recordChanges(eventRow.id, source.id, eventRow, values)
            // Authoritative source: core facts (title/date/status/venue/address) mirror the
            // source's CURRENT state — a value the source no longer publishes is dropped,
            // so stale extractions self-heal on re-scrape. Enrichment fields keep COALESCE.
            db.prepare(
              `UPDATE events SET title=@title, description=COALESCE(@description, description),
                 category=@category, district=COALESCE(@district, district), venue=@venue,
                 address=COALESCE(@address, address),
                 latitude=CASE WHEN @latitude IS NOT NULL THEN @latitude
                   WHEN @venue IS NOT venue AND location_precision='geocoded' THEN NULL
                   ELSE latitude END,
                 longitude=CASE WHEN @longitude IS NOT NULL THEN @longitude
                   WHEN @venue IS NOT venue AND location_precision='geocoded' THEN NULL
                   ELSE longitude END,
                 location_precision=CASE WHEN @latitude IS NOT NULL THEN 'source'
                   WHEN @venue IS NOT venue AND location_precision='geocoded' THEN NULL
                   ELSE location_precision END,
                 start_time=@start_time,
                 end_time=COALESCE(@end_time, end_time), date_precision=COALESCE(@date_precision, date_precision),
                 status=@status, organizer=COALESCE(@organizer, organizer), image_url=COALESCE(@image_url, image_url),
                 event_url=COALESCE(@event_url, event_url), ticket_url=COALESCE(@ticket_url, ticket_url),
                 source_conflict=@conflict, updated_at=@now, last_verified_at=@now, source_status='ok',
                 source_confidence=MIN(1.0, source_confidence + 0.03)
               WHERE id=@id`,
            ).run({ ...values, id: eventRow.id, now: nowIso(), conflict: hasConflict ? 1 : eventRow.source_conflict })
            if (changed > 0) stats.eventsUpdated++
            else stats.eventsUnchanged++
          } else {
            // Lower-priority source: fill gaps only; flag conflicts, never overwrite silently.
            if (hasConflict) {
              db.prepare(`UPDATE events SET source_conflict=1, updated_at=? WHERE id=?`).run(nowIso(), eventRow.id)
              for (const f of conflictingFields) {
                db.prepare(
                  `INSERT INTO event_changes (event_id, source_id, changed_at, field, previous_value, current_value)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                ).run(
                  eventRow.id,
                  source.id,
                  nowIso(),
                  `conflict:${f}`,
                  String((eventRow as Record<string, unknown>)[f]),
                  String(values[f]),
                )
              }
            }
            db.prepare(
              `UPDATE events SET description=COALESCE(description, @description), venue=COALESCE(venue, @venue),
                 address=COALESCE(address, @address), end_time=COALESCE(end_time, @end_time),
                 image_url=COALESCE(image_url, @image_url), ticket_url=COALESCE(ticket_url, @ticket_url),
                 source_confidence=MIN(1.0, source_confidence + 0.05), updated_at=@now
               WHERE id=@id`,
            ).run({ ...values, id: eventRow.id, now: nowIso() })
            stats.eventsUnchanged++
          }
        }
      } catch (e) {
        logError(`event processing failed: ${(e as Error).message}`, parsed.externalKey)
      }
    }

    // 5. DISAPPEARANCE: future events from this source not seen in this run.
    if (stats.eventsFound > 0) {
      const placeholders = seenKeys.map(() => '?').join(',')
      const missing = db
        .prepare(
          `SELECT es.event_id FROM event_sources es
           JOIN events e ON e.id = es.event_id
           WHERE es.source_id = ?
             AND e.start_time >= datetime('now')
             AND e.source_status != 'not_found'
             ${seenKeys.length ? `AND es.external_key NOT IN (${placeholders})` : ''}`,
        )
        .all(source.id, ...seenKeys) as Array<{ event_id: number }>
      for (const m of missing) {
        db.prepare(`UPDATE events SET source_status='not_found', updated_at=? WHERE id=?`).run(nowIso(), m.event_id)
        stats.eventsRemoved++
      }
    }

    db.prepare(
      `UPDATE scrape_runs SET finished_at=?, status=?, events_found=?, events_created=?, events_updated=?,
         events_removed=?, events_unchanged=?, duplicates=?, errors=?, message=? WHERE id=?`,
    ).run(
      nowIso(),
      stats.errors > 0 && stats.eventsFound === 0 ? 'failed' : stats.errors > 0 ? 'partial' : 'success',
      stats.eventsFound,
      stats.eventsCreated,
      stats.eventsUpdated,
      stats.eventsRemoved,
      stats.eventsUnchanged,
      stats.duplicates,
      stats.errors,
      null,
      runId,
    )
    db.prepare(`UPDATE sources SET last_run=?, status='active' WHERE id=?`).run(nowIso(), source.id)
  } catch (e) {
    const blocked = e instanceof BlockedError
    logError((e as Error).message)
    db.prepare(`UPDATE scrape_runs SET finished_at=?, status=?, errors=?, message=? WHERE id=?`).run(
      nowIso(),
      blocked ? 'blocked' : 'failed',
      stats.errors,
      (e as Error).message.slice(0, 500),
      runId,
    )
    db.prepare(`UPDATE sources SET last_run=?, status=? WHERE id=?`).run(nowIso(), blocked ? 'blocked' : 'error', source.id)
  }

  return stats
}
