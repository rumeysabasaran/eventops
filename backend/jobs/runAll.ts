/**
 * Manual CLI runner:
 *   npm run scrape            → run every enabled source once
 *   npm run scrape -- biletix → run a single source by id
 *   npm run scrape -- biletix-antalya biletix-samsun → run several ids
 */
import { syncRegistry, ADAPTERS, adapterById } from '../registry.js'
import { runSource } from './runSource.js'
import { verifyEvents } from '../services/verification/verify.js'
import { ingestHolidays } from './holidays.js'
import { runVenueGeocoder } from '../plugins/venueGeocoder/index.js'
import { db } from '../database/db.js'

async function main(): Promise<void> {
  syncRegistry()
  const only = process.argv.slice(2)
  const adapters = only.length
    ? only.map((id) => adapterById(id)).filter((a) => a !== undefined)
    : ADAPTERS.filter((a) => a.config.enabled)
  if (only.length && adapters.length === 0) {
    console.error(`Unknown source id: ${only.join(', ')}`)
    console.error(`Known ids: ${ADAPTERS.map((a) => a.config.id).join(', ')}`)
    process.exit(1)
  }
  if (only.length && adapters.length !== only.length) {
    const found = new Set(adapters.map((a) => a.config.id))
    const missing = only.filter((id) => !found.has(id))
    console.error(`Unknown source id(s): ${missing.join(', ')}`)
    console.error(`Known ids: ${ADAPTERS.map((a) => a.config.id).join(', ')}`)
    process.exit(1)
  }

  for (const adapter of adapters) {
    console.log(`\n━━ ${adapter.config.id} (${adapter.config.url})`)
    const stats = await runSource(adapter)
    console.log(stats)
  }

  console.log('\n━━ verification sweep')
  console.log(await verifyEvents(25))

  try {
    console.log('\n━━ holidays')
    console.log(await ingestHolidays())
  } catch (e) {
    console.error('holiday ingest failed:', (e as Error).message)
  }

  try {
    console.log('\n━━ venue-geocoder')
    console.log(await runVenueGeocoder(40))
  } catch (e) {
    console.error('venue-geocoder failed:', (e as Error).message)
  }

  const totals = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM events) AS events,
              (SELECT COUNT(*) FROM raw_events) AS raw_events,
              (SELECT COUNT(*) FROM event_sources) AS event_sources,
              (SELECT COUNT(*) FROM holidays) AS holidays`,
    )
    .get()
  console.log('\n━━ database totals', totals)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
