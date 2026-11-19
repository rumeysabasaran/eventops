import { db, nowIso } from '../database/db.js'
import { ADAPTERS } from '../registry.js'
import { runSource } from './runSource.js'
import { verifyEvents } from '../services/verification/verify.js'
import { istanbulCalendarDate } from '../services/normalization/dates.js'
import type { EventSourceAdapter } from '../scrapers/base/EventSourceAdapter.js'
import { runVenueGeocoder } from '../plugins/venueGeocoder/index.js'

const DAILY_KEY = 'last_daily_scrape_date'

let running = false

function sourceRow(id: string): { enabled: number; scrape_interval_minutes: number; last_run: string | null } | undefined {
  return db
    .prepare(`SELECT enabled, scrape_interval_minutes, last_run FROM sources WHERE id=?`)
    .get(id) as { enabled: number; scrape_interval_minutes: number; last_run: string | null } | undefined
}

async function runAdapter(adapter: EventSourceAdapter, reason: string): Promise<void> {
  console.log(`[scheduler] ${reason} ${adapter.config.id} at ${nowIso()}`)
  try {
    const stats = await runSource(adapter)
    console.log(`[scheduler] ${adapter.config.id} done:`, stats)
  } catch (e) {
    console.error(`[scheduler] ${adapter.config.id} crashed:`, (e as Error).message)
  }
}

/**
 * Interval-based scheduler. Every minute, sources whose per-source interval
 * has elapsed are run sequentially. A failing source never stops the others.
 */
async function tick(): Promise<void> {
  if (running) return
  running = true
  try {
    for (const adapter of ADAPTERS) {
      const src = sourceRow(adapter.config.id)
      if (!src || !src.enabled) continue
      const due =
        !src.last_run ||
        Date.now() - Date.parse(src.last_run) >= src.scrape_interval_minutes * 60_000
      if (!due) continue
      await runAdapter(adapter, 'interval')
    }
  } finally {
    running = false
  }
}

/**
 * Once per Istanbul calendar day, scrape every enabled source even if its
 * shorter interval already ran — catches cancellations, time changes, and new events.
 */
async function dailySweep(): Promise<void> {
  const today = istanbulCalendarDate()
  const prev = db.prepare(`SELECT value FROM scheduler_state WHERE key=?`).get(DAILY_KEY) as { value: string } | undefined
  if (prev?.value === today) return
  if (running) return
  running = true
  try {
    console.log(`[scheduler] daily full scrape ${today}`)
    for (const adapter of ADAPTERS) {
      const src = sourceRow(adapter.config.id)
      if (!src || !src.enabled) continue
      await runAdapter(adapter, 'daily')
    }
    db.prepare(
      `INSERT INTO scheduler_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    ).run(DAILY_KEY, today, nowIso())
    console.log(`[scheduler] daily full scrape finished ${today}`)
  } finally {
    running = false
  }
}

let verifying = false

async function verificationSweep(): Promise<void> {
  if (verifying) return
  verifying = true
  try {
    const result = await verifyEvents(15)
    console.log(`[verify] sweep:`, result)
  } catch (e) {
    console.error('[verify] sweep failed:', (e as Error).message)
  } finally {
    verifying = false
  }
}

export function startScheduler(): void {
  console.log('[scheduler] started — due sources every 60s, full scrape once per day, verify every 30min, venue-geocoder every 3min')
  void boot()
  void geocodeSweep()
  setInterval(() => void dailySweep(), 60_000)
  setInterval(() => void tick(), 60_000)
  setInterval(() => void verificationSweep(), 30 * 60_000)
  setTimeout(() => void verificationSweep(), 90_000)
  setInterval(() => void geocodeSweep(), 3 * 60_000)
}

let geocoding = false

async function geocodeSweep(): Promise<void> {
  if (geocoding) return
  geocoding = true
  try {
    const result = await runVenueGeocoder(25)
    if (result.queried > 0 || result.applied > 0) console.log('[venue-geocoder] sweep:', result)
  } catch (e) {
    console.error('[venue-geocoder] sweep failed:', (e as Error).message)
  } finally {
    geocoding = false
  }
}

async function boot(): Promise<void> {
  await dailySweep()
  await tick()
}
