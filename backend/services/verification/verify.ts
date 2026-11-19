import { db, nowIso } from '../../database/db.js'
import { assertAllowedByRobots } from '../../scrapers/base/http.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 CityEventIntelligence/1.0'

interface VerifiableEvent {
  id: number
  event_url: string | null
  source_confidence: number
}

/**
 * Verify that stored events still exist at their source URL.
 * Sets source_status ('ok' | 'not_found' | 'unreachable') and last_verified_at.
 * Events that disappear are never deleted here — they are rechecked next crawl.
 */
export async function verifyEvents(limit = 15): Promise<{ checked: number; ok: number; notFound: number; unreachable: number }> {
  const rows = db
    .prepare(
      `SELECT id, event_url, source_confidence FROM events
       WHERE event_url IS NOT NULL
         AND (start_time IS NULL OR start_time >= datetime('now', '-1 day'))
       ORDER BY last_verified_at IS NOT NULL, last_verified_at ASC
       LIMIT ?`,
    )
    .all(limit) as VerifiableEvent[]

  let ok = 0
  let notFound = 0
  let unreachable = 0

  for (const row of rows) {
    let status: string
    let confidenceDelta = 0
    try {
      await assertAllowedByRobots(row.event_url!)
      const res = await fetch(row.event_url!, {
        method: 'GET',
        headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 403 || res.status === 429) {
        await res.arrayBuffer().catch(() => undefined)
        continue
      }
      if (res.ok) {
        status = 'ok'
        confidenceDelta = 0.05
        ok++
      } else if (res.status === 404 || res.status === 410) {
        status = 'not_found'
        confidenceDelta = -0.2
        notFound++
      } else {
        status = 'unreachable'
        unreachable++
      }
      // drain body to free the socket
      await res.arrayBuffer().catch(() => undefined)
    } catch {
      status = 'unreachable'
      unreachable++
    }
    db.prepare(
      `UPDATE events SET source_status=?, last_verified_at=?,
         source_confidence=MIN(1.0, MAX(0.05, source_confidence + ?))
       WHERE id=?`,
    ).run(status, nowIso(), confidenceDelta, row.id)
  }

  return { checked: rows.length, ok, notFound, unreachable }
}
