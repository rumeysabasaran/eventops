import { db, nowIso } from '../../database/db.js'
import { lookupVenue } from './nominatim.js'
import { sleep } from '../../scrapers/base/http.js'

export const VENUE_GEOCODER_ID = 'venue-geocoder'

const CACHE_PREFIX = 'v8|'
const RULE_VERSION = 'v8'

function migrateRuleVersion(): void {
  const row = db.prepare(`SELECT precision FROM geocode_cache WHERE query='__plugin_version'`).get() as
    | { precision: string }
    | undefined
  if (row?.precision === RULE_VERSION) return
  db.prepare(
    `INSERT OR REPLACE INTO geocode_cache (query, city, venue, latitude, longitude, precision, display_name, fetched_at)
     VALUES ('__plugin_version', '', '', NULL, NULL, ?, NULL, ?)`,
  ).run(RULE_VERSION, nowIso())
}

function usableVenue(venue: string | null): venue is string {
  if (!venue) return false
  const t = venue.trim()
  if (t.length < 3) return false
  if (/^kaynakta yok$/i.test(t)) return false
  if (t === '—' || t === '-') return false
  return true
}

const cacheKey = (city: string, venue: string): string =>
  `${CACHE_PREFIX}${city}|${venue}`.toLocaleLowerCase('tr-TR')

/**
 * Plugin: turn source venue/address text into OSM coordinates.
 * City centroids and unmatched names are stored as misses — never written to events.
 */
export async function runVenueGeocoder(limit = 40): Promise<{
  plugin: string
  queried: number
  hit: number
  miss: number
  applied: number
}> {
  migrateRuleVersion()
  const rows = db
    .prepare(
      `SELECT venue, city, MAX(address) AS address
       FROM events
       WHERE latitude IS NULL
         AND (location_precision IS NULL OR location_precision != 'source')
         AND venue IS NOT NULL AND trim(venue) != ''
         AND (start_time IS NULL OR start_time >= datetime('now', '-1 day'))
       GROUP BY venue, city
       ORDER BY COUNT(*) DESC, city, venue
       LIMIT ?`,
    )
    .all(limit) as Array<{ venue: string; city: string; address: string | null }>

  let queried = 0
  let hit = 0
  let miss = 0
  let applied = 0

  const updateEvents = db.prepare(
    `UPDATE events SET latitude=?, longitude=?, location_precision='geocoded', updated_at=?
     WHERE city=? AND venue=? AND latitude IS NULL
       AND (location_precision IS NULL OR location_precision != 'source')`,
  )

  for (const row of rows) {
    if (!usableVenue(row.venue)) continue
    const key = cacheKey(row.city, row.venue)
    const cached = db
      .prepare(`SELECT latitude, longitude, precision FROM geocode_cache WHERE query=?`)
      .get(key) as { latitude: number | null; longitude: number | null; precision: string } | undefined

    if (cached) {
      if (cached.precision === 'geocoded' && cached.latitude != null && cached.longitude != null) {
        applied += updateEvents.run(cached.latitude, cached.longitude, nowIso(), row.city, row.venue).changes
      }
      continue
    }

    queried++
    let result: { lat: number; lng: number; displayName: string } | null = null
    try {
      result = await lookupVenue(row.venue, row.city, row.address)
    } catch (e) {
      console.error(`[${VENUE_GEOCODER_ID}] ${row.city} / ${row.venue}:`, (e as Error).message)
      await sleep(1100)
      continue
    }

    if (result) {
      hit++
      db.prepare(
        `INSERT OR REPLACE INTO geocode_cache (query, city, venue, latitude, longitude, precision, display_name, fetched_at)
         VALUES (?, ?, ?, ?, ?, 'geocoded', ?, ?)`,
      ).run(key, row.city, row.venue, result.lat, result.lng, result.displayName, nowIso())
      applied += updateEvents.run(result.lat, result.lng, nowIso(), row.city, row.venue).changes
    } else {
      miss++
      db.prepare(
        `INSERT OR REPLACE INTO geocode_cache (query, city, venue, latitude, longitude, precision, display_name, fetched_at)
         VALUES (?, ?, ?, NULL, NULL, 'miss', NULL, ?)`,
      ).run(key, row.city, row.venue, nowIso())
    }

    await sleep(1100)
  }

  // Same OSM building as “Merinos Atatürk…”, Biletix names the halls “Merinos AKKM - …”.
  applied += db
    .prepare(
      `UPDATE events
       SET latitude = (
             SELECT e2.latitude FROM events e2
             WHERE e2.city = events.city
               AND e2.venue = 'Merinos Atatürk Kültür Kongre Merkezi'
               AND e2.latitude IS NOT NULL
             LIMIT 1
           ),
           longitude = (
             SELECT e2.longitude FROM events e2
             WHERE e2.city = events.city
               AND e2.venue = 'Merinos Atatürk Kültür Kongre Merkezi'
               AND e2.longitude IS NOT NULL
             LIMIT 1
           ),
           location_precision = 'geocoded',
           updated_at = ?
       WHERE latitude IS NULL
         AND venue LIKE 'Merinos AKKM%'
         AND EXISTS (
           SELECT 1 FROM events e2
           WHERE e2.city = events.city
             AND e2.venue = 'Merinos Atatürk Kültür Kongre Merkezi'
             AND e2.latitude IS NOT NULL
         )`,
    )
    .run(nowIso()).changes

  return { plugin: VENUE_GEOCODER_ID, queried, hit, miss, applied }
}
