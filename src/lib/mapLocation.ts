import type { CityEvent } from '../types'
import { UNAVAILABLE } from './labels'

export type LocationPrecision = 'source' | 'geocoded'

export interface ResolvedLocation {
  lat: number
  lng: number
  precision: LocationPrecision
}

/**
 * Pins: source-published coordinates or a confirmed OSM match of the source venue name.
 * City centroids are never used.
 */
export function resolveEventLocation(e: CityEvent): ResolvedLocation | null {
  if (e.locationPrecision !== 'source' && e.locationPrecision !== 'geocoded') return null
  if (e.lat == null || e.lng == null) return null
  if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng)) return null
  return { lat: e.lat, lng: e.lng, precision: e.locationPrecision }
}

export const LOCATION_PRECISION_LABEL: Record<LocationPrecision, string> = {
  source: 'Kaynak koordinatı',
  geocoded: 'Doğrulanmış konum',
}

export function pinVenueTitle(events: CityEvent[]): string {
  const names = [...new Set(events.map((e) => e.venue).filter((v) => v && v !== UNAVAILABLE && v !== '—'))]
  if (names.length === 0) return events[0]?.venue ?? ''
  if (names.length === 1) return names[0]
  return names.join(' · ')
}

export interface MapPinGroup {
  key: string
  lat: number
  lng: number
  events: CityEvent[]
}

/** Same coordinates share one pin. */
export function groupEventsOnMap(events: CityEvent[]): MapPinGroup[] {
  const buckets = new Map<string, MapPinGroup>()
  for (const event of events) {
    const loc = resolveEventLocation(event)
    if (!loc) continue
    const key = `${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`
    const existing = buckets.get(key)
    if (existing) existing.events.push(event)
    else buckets.set(key, { key, lat: loc.lat, lng: loc.lng, events: [event] })
  }
  return [...buckets.values()]
}

export function pinPrecisionLabel(events: CityEvent[]): string {
  const kinds = new Set(
    events.map((e) => e.locationPrecision).filter((p): p is LocationPrecision => p === 'source' || p === 'geocoded'),
  )
  if (kinds.size === 1) return LOCATION_PRECISION_LABEL[[...kinds][0]]
  if (kinds.size > 1) return 'Konum'
  return LOCATION_PRECISION_LABEL.geocoded
}
