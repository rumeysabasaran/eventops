export type SourceType =
  | 'municipality'
  | 'district_municipality'
  | 'venue'
  | 'ticketing'
  | 'sports'
  | 'organizer'
  | 'news'
  | 'political'
  | 'cultural'
  | 'education'
  | 'other'

export type SourceStatus = 'active' | 'error' | 'blocked' | 'disabled'

export type EventStatus = 'scheduled' | 'cancelled' | 'postponed'

export type DatePrecision = 'datetime' | 'date' | 'range'

export interface SourceConfig {
  id: string
  name: string
  city: string
  district: string | null
  type: SourceType
  url: string
  enabled: boolean
  scrapeIntervalMinutes: number
  notes?: string
}

export interface FetchedDocument {
  url: string
  finalUrl: string
  httpStatus: number
  contentType: 'html' | 'json'
  content: string
}

/** Raw extraction result — values exactly as found in the source, no interpretation. */
export interface ParsedEvent {
  externalKey: string
  title: string | null
  description: string | null
  categoryText: string | null
  /** Raw date string exactly as printed by the source (e.g. "30.08.2026 19:30", "03 - 05 Eylül 2026"). */
  dateText: string | null
  /** ISO timestamps when the source itself provides machine-readable dates. */
  startIso: string | null
  endIso: string | null
  venueText: string | null
  addressText: string | null
  district: string | null
  latitude: number | null
  longitude: number | null
  /** When the source itself names a city (e.g. Biletix city field). */
  city?: string | null
  organizer: string | null
  imageUrl: string | null
  eventUrl: string | null
  ticketUrl: string | null
  /** Raw text that may indicate cancellation/postponement. */
  statusText: string | null
  sourceUrl: string
  raw: unknown
}

export interface NormalizedEvent {
  externalKey: string
  title: string
  description: string | null
  category: string
  startTime: string | null
  endTime: string | null
  datePrecision: DatePrecision | null
  venue: string | null
  address: string | null
  city: string
  district: string | null
  latitude: number | null
  longitude: number | null
  /** Set only when the source document itself published coordinates. Geocoded coords are written by the venue-geocoder plugin, not here. */
  locationPrecision: 'source' | null
  organizer: string | null
  imageUrl: string | null
  eventUrl: string | null
  ticketUrl: string | null
  status: EventStatus
  sourceUrl: string
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export interface RunStats {
  eventsFound: number
  eventsCreated: number
  eventsUpdated: number
  eventsRemoved: number
  eventsUnchanged: number
  duplicates: number
  errors: number
}
