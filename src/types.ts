export type ServiceType = 'parking' | 'scooter'

export type EventCategory =
  | 'Concert'
  | 'Festival'
  | 'Sports'
  | 'Theater'
  | 'Fair & Expo'
  | 'Conference'
  | 'Marathon'
  | 'Cultural'
  | 'Community'

export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical'

export interface City {
  id: string
  name: string
  services: ServiceType[]
  lat: number
  lng: number
  population: string
}

export interface CityEvent {
  id: string
  name: string
  category: EventCategory
  city: string
  district: string
  venue: string
  address: string
  /** ISO date string */
  date: string
  startTime: string
  endTime: string | null
  /** Only present when explicitly provided by a real source; never estimated at ingestion. */
  attendance: number | null
  ticketed: boolean | null
  price: string | null
  organizer: string
  source: string
  sourceUrl: string
  impactScore: number
  parkingImpact: ImpactLevel
  scooterDemand: ImpactLevel
  lat: number | null
  lng: number | null
  /** 'source' = origin published lat/lng; 'geocoded' = venue text matched on OSM. */
  locationPrecision?: 'source' | 'geocoded'
  description: string
  /** Kaynak doğrulaması (yalnızca doğrulanmış API kayıtları) */
  eventStatus?: 'scheduled' | 'cancelled' | 'postponed'
  sourceStatus?: string
  sourceConfidence?: number
  sourceConflict?: boolean
  lastVerifiedAt?: string | null
  sourceCount?: number
}

export interface DataSource {
  id: string
  name: string
  type: string
  url: string
  status: 'active' | 'inactive' | 'error' | 'blocked' | 'disabled'
  lastRun: string
  nextRun: string
  eventsCollected: number
  newEventsLast24h: number
  coverage: string[]
  interval: string
  reliability: number
}

export interface ScraperRun {
  id: string
  sourceId: string
  sourceName: string
  startedAt: string
  durationSec: number
  status: 'success' | 'partial' | 'failed' | 'running'
  eventsFound: number
  newEvents: number
  updatedEvents: number
  message: string
}
