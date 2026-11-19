/**
 *   npm run geocode
 *   npx tsx backend/jobs/geocode.ts 80
 */
import { runVenueGeocoder } from '../plugins/venueGeocoder/index.js'

const limit = Number(process.argv[2] ?? 80)
console.log('[venue-geocoder]', await runVenueGeocoder(limit))
