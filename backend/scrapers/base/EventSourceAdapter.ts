import type {
  FetchedDocument,
  NormalizedEvent,
  ParsedEvent,
  SourceConfig,
  ValidationResult,
} from '../../types.js'
import { normalizeEvent } from '../../services/normalization/normalize.js'
import { validateEvent } from '../../services/validation/validate.js'

/**
 * Base class for all event source adapters.
 *
 * Adding a new source only requires implementing `fetch()` and `parse()`
 * (plus source metadata). Normalization and validation have shared default
 * implementations that adapters may override for source-specific quirks.
 */
export abstract class EventSourceAdapter {
  abstract readonly config: SourceConfig

  /** Fetch current public documents (list pages, JSON endpoints, detail pages). */
  abstract fetch(): Promise<FetchedDocument[]>

  /** Extract raw event data from fetched documents. No interpretation, values verbatim. */
  abstract parse(docs: FetchedDocument[]): Promise<ParsedEvent[]> | ParsedEvent[]

  /** Turn raw parsed values into a normalized event (dates → ISO, category mapping, status detection). */
  normalize(parsed: ParsedEvent): NormalizedEvent | null {
    return normalizeEvent(parsed, this.config)
  }

  /** Validate a normalized event before persistence. */
  validate(event: NormalizedEvent): ValidationResult {
    return validateEvent(event)
  }
}

/** Priority for cross-source conflict resolution (lower number wins). */
export const SOURCE_TYPE_PRIORITY: Record<string, number> = {
  municipality: 1,
  district_municipality: 1,
  organizer: 2,
  venue: 3,
  sports: 4,
  political: 4,
  news: 5,
  education: 4,
  cultural: 4,
  ticketing: 5,
  other: 6,
}

/** Base confidence by source type. */
export const SOURCE_TYPE_CONFIDENCE: Record<string, number> = {
  municipality: 0.9,
  district_municipality: 0.88,
  organizer: 0.85,
  venue: 0.8,
  sports: 0.9,
  political: 0.75,
  news: 0.62,
  education: 0.75,
  cultural: 0.75,
  ticketing: 0.78,
  other: 0.6,
}
