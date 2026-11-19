import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument } from '../base/http.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

/**
 * Biletix public Solr search endpoint (JSON), allowed by robots.txt.
 * Returns machine-readable events with ISO instants, venue, city and status.
 * One adapter instance per dashboard city — Solr `city` facet uses Turkish names.
 */
interface BiletixDoc {
  id: string
  type: string
  sname?: string
  name?: string[]
  venue?: string[]
  svenue?: string
  city?: string[]
  start?: string
  end?: string
  status?: string
  category?: string
  subcategory?: string
  description?: string[]
  promoter?: string[]
  artist?: string[]
  image_url?: string
  link_url?: string
}

export class BiletixAdapter extends EventSourceAdapter {
  readonly config: SourceConfig

  constructor(city: string, slug?: string) {
    super()
    this.config = {
      id: slug ? `biletix-${slug}` : 'biletix',
      name: slug ? `Biletix (${city})` : 'Biletix',
      city,
      district: null,
      type: 'ticketing',
      url: 'https://www.biletix.com/solr/tr/select/',
      enabled: true,
      scrapeIntervalMinutes: 120,
    }
  }

  private buildUrl(start: number, rows: number): string {
    const params = new URLSearchParams({
      fl: '*',
      start: String(start),
      rows: String(rows),
      q: '*:*',
      wt: 'json',
    })
    return `${this.config.url}?${params.toString()}&fq=city:%22${encodeURIComponent(this.config.city)}%22&fq=type:%22event%22`
  }

  async fetch(): Promise<FetchedDocument[]> {
    const docs: FetchedDocument[] = []
    const pageSize = 100
    let start = 0
    let total = Infinity
    while (start < total && start < 500) {
      const doc = await fetchDocument(this.buildUrl(start, pageSize), { json: true })
      docs.push(doc)
      try {
        const json = JSON.parse(doc.content) as { response: { numFound: number } }
        total = json.response.numFound
      } catch {
        break
      }
      start += pageSize
    }
    return docs
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const events: ParsedEvent[] = []
    for (const doc of docs) {
      let json: { response: { docs: BiletixDoc[] } }
      try {
        json = JSON.parse(doc.content)
      } catch {
        continue
      }
      for (const d of json.response.docs) {
        if (d.type !== 'event') continue
        const title = d.sname || d.name?.[0]
        if (!title || !d.start) continue
        const eventUrl = `https://www.biletix.com/etkinlik/${d.id}/TURKIYE/tr`
        events.push({
          externalKey: d.id,
          title,
          description: d.description?.[0] ?? null,
          categoryText: [d.category, d.subcategory].filter(Boolean).join(' ') || null,
          dateText: null,
          startIso: d.start,
          endIso: d.end && d.end !== d.start ? d.end : null,
          venueText: d.svenue || d.venue?.[0] || null,
          addressText: null,
          district: null,
          latitude: null,
          longitude: null,
          city: this.config.city,
          organizer: d.promoter?.filter(Boolean)[0] ?? null,
          imageUrl: d.image_url || null,
          eventUrl,
          ticketUrl: eventUrl,
          statusText: d.status ?? null,
          sourceUrl: doc.url,
          raw: d,
        })
      }
    }
    return events
  }
}
