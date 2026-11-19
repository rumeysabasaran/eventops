import { db } from '../database/db.js'

/**
 * Public holidays / national days for Türkiye.
 * Source: Nager.Date public holiday API (https://date.nager.at) — an open,
 * verifiable calendar source. Holidays are stored separately from physical
 * events and never mixed into the events table.
 */
const NATIONAL_DAY_RE = /ulusal|cumhuriyet|zafer|atatürk|çocuk bayramı|gençlik|demokrasi|national|republic|victory|sovereignty|youth|democracy/i

export async function ingestHolidays(): Promise<{ inserted: number; years: number[] }> {
  const years = [new Date().getFullYear(), new Date().getFullYear() + 1]
  let inserted = 0
  for (const year of years) {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/TR`
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`holiday source HTTP ${res.status} for ${year}`)
    const holidays = (await res.json()) as Array<{ date: string; localName: string; name: string; types?: string[] }>
    const insert = db.prepare(
      `INSERT OR IGNORE INTO holidays (source, date, name, type) VALUES (?, ?, ?, ?)`,
    )
    for (const h of holidays) {
      const type = NATIONAL_DAY_RE.test(`${h.localName} ${h.name}`) ? 'national_day' : 'public_holiday'
      const r = insert.run(url, h.date, h.localName, type)
      inserted += r.changes
    }
  }
  return { inserted, years }
}
