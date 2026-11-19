/**
 * Cities the dashboard monitors. Every ingestion target below was chosen
 * because the product operates parking and/or scooter services there.
 * Centroids bias Nominatim search (viewbox) only. They are never written
 * as event pins — a city-center marker is worse than no marker.
 */
export const TARGET_CITIES = [
  { id: 'bursa', name: 'Bursa', lat: 40.1885, lng: 29.061 },
  { id: 'antalya', name: 'Antalya', lat: 36.8969, lng: 30.7133 },
  { id: 'samsun', name: 'Samsun', lat: 41.2867, lng: 36.33 },
  { id: 'balikesir', name: 'Balıkesir', lat: 39.6484, lng: 27.8826 },
  { id: 'mugla', name: 'Muğla', lat: 37.2153, lng: 28.3636 },
  { id: 'ordu', name: 'Ordu', lat: 40.9839, lng: 37.8764 },
  { id: 'kutahya', name: 'Kütahya', lat: 39.4167, lng: 29.9833 },
  { id: 'zonguldak', name: 'Zonguldak', lat: 41.4564, lng: 31.7987 },
  { id: 'nevsehir', name: 'Nevşehir', lat: 38.6244, lng: 34.7144 },
  { id: 'yalova', name: 'Yalova', lat: 40.655, lng: 29.2769 },
] as const

export type TargetCityName = (typeof TARGET_CITIES)[number]['name']

export function cityCentroid(name: string): { lat: number; lng: number } | null {
  const row = TARGET_CITIES.find((c) => c.name === name)
  return row ? { lat: row.lat, lng: row.lng } : null
}
