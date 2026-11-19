import { cityCentroid } from '../../cities.js'
import { sleep } from '../../scrapers/base/http.js'

const UA =
  'CityEventIntelligence/1.0 venue-geocoder (https://www.openstreetmap.org/copyright)'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

const STOP = new Set([
  'salon',
  'salonu',
  'salonlari',
  'salonları',
  'hall',
  'merkez',
  'merkezi',
  'etkinlik',
  'etkinligi',
  'etkinliği',
  've',
  'ile',
  'icin',
  'için',
  'the',
  'and',
  'binasi',
  'binası',
])

const PLACE_REJECT = new Set([
  'city',
  'town',
  'village',
  'municipality',
  'administrative',
  'state',
  'province',
  'county',
  'island',
  'suburb',
  'neighbourhood',
  'quarter',
])

const CLASS_OK = new Set(['amenity', 'tourism', 'leisure', 'building', 'office', 'club', 'historic', 'sport', 'craft'])

const TYPE_REJECT = new Set([
  'bank',
  'atm',
  'pharmacy',
  'fuel',
  'parking',
  'parking_space',
  'fast_food',
  'telephone',
  'university',
  'fire_station',
  'peak',
  'nature_reserve',
  'national_park',
  'bus_stop',
  'station',
  'stop',
  'post_office',
  'clinic',
  'doctors',
  'hospital',
  'dentist',
  'veterinary',
])

const OPTIONAL_TOKEN = new Set([
  'kultur',
  'kongre',
  'sanat',
  'park',
  'cafe',
  'hotel',
  'tiyatro',
  'acikhava',
  'spor',
  'sahne',
  'mahal',
  'podyum',
  'meydan',
  'meydani',
  'yasam',
  'eglence',
  'merkez',
  'merkezi',
  'otel',
  'uludag',
  'merinos',
])

export interface NominatimHit {
  lat: string
  lon: string
  display_name?: string
  class?: string
  type?: string
  importance?: number
  address?: Record<string, string>
}

export interface GeocodeHit {
  lat: number
  lng: number
  displayName: string
}

export function foldTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isOptionalToken(t: string): boolean {
  if (OPTIONAL_TOKEN.has(t)) return true
  for (const stem of OPTIONAL_TOKEN) {
    if (stem.length >= 4 && t.startsWith(stem)) return true
  }
  return false
}

/** Same building, different source spelling (Biletix “Merinos AKKM - salon”). */
function venueForMatch(venue: string): string {
  const expanded = venue.replace(/\bAKKM\b/gi, 'Atatürk Kongre ve Kültür Merkezi')
  const beforeDash = expanded.split(/\s[-–]\s/)[0]?.trim()
  return beforeDash && beforeDash.length >= 3 ? beforeDash : expanded
}

export function venueTokens(venue: string, city = ''): string[] {
  const extra = new Set(STOP)
  for (const t of foldTr(city).split(/\s+/)) {
    if (t.length >= 2) extra.add(t)
  }
  extra.add('turkiye')
  extra.add('turkey')
  return foldTr(venueForMatch(venue))
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !extra.has(t))
}

function cityInAddress(city: string, hit: NominatimHit): boolean {
  const needle = foldTr(city)
  const addr = hit.address ?? {}
  const fields = [
    addr.province,
    addr.state,
    addr.city,
    addr.town,
    addr.county,
    addr.region,
    addr['ISO3166-2-lvl4'],
    hit.display_name,
  ]
  return fields.some((f) => f && (foldTr(f) === needle || foldTr(f).includes(needle)))
}

function isCityCentroidHit(hit: NominatimHit): boolean {
  const cls = hit.class ?? ''
  const type = hit.type ?? ''
  if (cls === 'boundary' || cls === 'highway' || cls === 'railway' || cls === 'waterway' || cls === 'landuse') {
    return true
  }
  if (cls === 'place' && type !== 'square') return true
  if (PLACE_REJECT.has(type)) return true
  return false
}

function venueOverlaps(venue: string, displayName: string, city: string): boolean {
  const tokens = venueTokens(venue, city)
  if (tokens.length === 0) return false
  const hay = foldTr(displayName)
  const hits = tokens.filter((t) => hay.includes(t))
  if (hits.length === 0) return false
  const distinctive = tokens.filter((t) => t.length >= 5 && !isOptionalToken(t))
  if (distinctive.length > 0) return distinctive.some((t) => hay.includes(t))
  const strong = hits.filter((t) => !isOptionalToken(t) && t.length >= 4)
  return strong.length > 0
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function acceptHit(hit: NominatimHit, venue: string, city: string): GeocodeHit | null {
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (isCityCentroidHit(hit)) return null
  if (TYPE_REJECT.has(hit.type ?? '')) return null
  if (!cityInAddress(city, hit)) return null
  const centroid = cityCentroid(city)
  // Province-sized cap: reject another city's venue even if the name leaked into display_name.
  if (centroid && haversineKm(centroid.lat, centroid.lng, lat, lng) > 140) return null
  const displayName = hit.display_name ?? ''
  if (!venueOverlaps(venue, displayName, city)) return null
  const namePart = foldTr(displayName.split(',')[0] ?? '')
  const strong = venueTokens(venue, city).filter((t) => !isOptionalToken(t))
  if (strong.length === 0) return null
  const maxLen = Math.max(...strong.map((t) => t.length))
  const required = strong.filter((t) => t.length === maxLen || t.length >= 7)
  if (!required.every((t) => namePart.includes(t))) return null
  const foldedVenue = foldTr(venue)
  if (/\bmeydan/.test(foldedVenue) && !namePart.includes('meydan')) return null
  return { lat, lng, displayName }
}

function queryVariants(venue: string, city: string, address: string | null): string[] {
  const expanded = venue.replace(/\bAKKM\b/gi, 'Kongre ve Kültür Merkezi')
  const out = [`${venue}, ${city}, Türkiye`, `${expanded}, ${city}, Türkiye`]
  if (address && address.length >= 5 && !/^kaynakta yok$/i.test(address)) {
    out.unshift(`${venue}, ${address}, ${city}, Türkiye`)
  }
  const beforeDash = venue.split(/\s[-–]\s/)[0]?.trim()
  if (beforeDash && beforeDash.length >= 3 && beforeDash !== venue) {
    out.push(`${beforeDash}, ${city}, Türkiye`)
  }
  const words = venue.split(/[\s/,-]+/).filter((w) => w.length > 2)
  if (words.length > 2) out.push(`${words.slice(0, 2).join(' ')}, ${city}, Türkiye`)
  return [...new Set(out)]
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string
    city?: string
    state?: string
    district?: string
    street?: string
    countrycode?: string
    osm_key?: string
    osm_value?: string
  }
}

function photonToHit(f: PhotonFeature): NominatimHit | null {
  const coords = f.geometry?.coordinates
  if (!coords || coords.length < 2) return null
  const p = f.properties ?? {}
  if (p.countrycode && p.countrycode.toUpperCase() !== 'TR') return null
  const display = [p.name, p.street, p.district, p.city, p.state, 'Türkiye'].filter(Boolean).join(', ')
  return {
    lat: String(coords[1]),
    lon: String(coords[0]),
    display_name: display,
    class: p.osm_key,
    type: p.osm_value,
    address: { city: p.city ?? '', state: p.state ?? '', town: p.district ?? '' },
  }
}

async function searchPhoton(q: string, centroid: { lat: number; lng: number } | null): Promise<NominatimHit[]> {
  const params = new URLSearchParams({ q, limit: '8' })
  if (centroid) {
    params.set('lat', String(centroid.lat))
    params.set('lon', String(centroid.lng))
  }
  try {
    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { accept: 'application/json', 'user-agent': UA },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { features?: PhotonFeature[] }
    return (json.features ?? []).map(photonToHit).filter((h): h is NominatimHit => h != null)
  } catch {
    return []
  }
}

async function searchNominatim(q: string, centroid: { lat: number; lng: number } | null): Promise<NominatimHit[]> {
  const params = new URLSearchParams({
    format: 'json',
    limit: '8',
    countrycodes: 'tr',
    addressdetails: '1',
    q,
  })
  if (centroid) {
    params.set('viewbox', `${centroid.lng - 1.2},${centroid.lat + 1.2},${centroid.lng + 1.2},${centroid.lat - 1.2}`)
  }
  const res = await fetch(`${NOMINATIM}?${params.toString()}`, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const hits = (await res.json()) as NominatimHit[]
  return Array.isArray(hits) ? hits : []
}

function pickAccepted(hits: NominatimHit[], venue: string, city: string): GeocodeHit | null {
  const ranked = [...hits].sort((a, b) => Number(CLASS_OK.has(b.class ?? '')) - Number(CLASS_OK.has(a.class ?? '')))
  for (const hit of ranked) {
    const accepted = acceptHit(hit, venue, city)
    if (accepted) return accepted
  }
  return null
}

export async function lookupVenue(venue: string, city: string, address: string | null): Promise<GeocodeHit | null> {
  const centroid = cityCentroid(city)
  const queries = queryVariants(venue, city, address)
  for (const q of queries) {
    const accepted = pickAccepted(await searchPhoton(q, centroid), venue, city)
    if (accepted) return accepted
    await sleep(1100)
  }
  for (const q of queries) {
    const accepted = pickAccepted(await searchNominatim(q, centroid), venue, city)
    if (accepted) return accepted
    await sleep(1100)
  }
  return null
}
