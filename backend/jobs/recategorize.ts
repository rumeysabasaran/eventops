import { db } from '../database/db.js'
import { normalizeCategory } from '../services/normalization/normalize.js'

function categoryTextFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const parts = [o.category, o.subcategory, o.categoryText].filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  return parts.length ? parts.join(' ') : null
}

/** Re-apply category rules to stored events (Biletix MUSIC → Concert, etc.). */
export function recategorizeStoredEvents(): { checked: number; updated: number } {
  const rows = db
    .prepare(
      `SELECT e.id, e.title, e.category,
         (SELECT r.parsed_json FROM event_sources es
          JOIN raw_events r ON r.id = es.raw_event_id
          WHERE es.event_id = e.id
          ORDER BY r.fetched_at DESC LIMIT 1) AS parsed_json
       FROM events e`,
    )
    .all() as Array<{ id: number; title: string; category: string; parsed_json: string | null }>

  const update = db.prepare(`UPDATE events SET category=? WHERE id=?`)
  let updated = 0
  const tx = db.transaction(() => {
    for (const row of rows) {
      let raw: unknown = null
      if (row.parsed_json) {
        try {
          raw = JSON.parse(row.parsed_json)
        } catch {
          raw = null
        }
      }
      const next = normalizeCategory(categoryTextFromRaw(raw), row.title)
      if (next !== row.category) {
        update.run(next, row.id)
        updated++
      }
    }
  })
  tx()
  return { checked: rows.length, updated }
}

const invoked = process.argv[1]?.replace(/\\/g, '/').includes('/recategorize.ts')
if (invoked) {
  console.log('[category]', recategorizeStoredEvents())
}
