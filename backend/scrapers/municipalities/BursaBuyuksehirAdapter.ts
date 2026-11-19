import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument } from '../base/http.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

/**
 * Bursa Büyükşehir Belediyesi event calendar.
 * Server-rendered cards at https://www.bursa.bel.tr/etkinlik
 * Card format: <div class="post-item"> with title link (/etkinlik/<slug>),
 * category text, "30.08.2026 19:30" date and venue text.
 */
export class BursaBuyuksehirAdapter extends EventSourceAdapter {
  readonly config: SourceConfig = {
    id: 'bursa-buyuksehir',
    name: 'Bursa Büyükşehir Belediyesi',
    city: 'Bursa',
    district: null,
    type: 'municipality',
    url: 'https://www.bursa.bel.tr/etkinlik',
    enabled: true,
    scrapeIntervalMinutes: 360,
  }

  async fetch(): Promise<FetchedDocument[]> {
    return [await fetchDocument(this.config.url)]
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const events: ParsedEvent[] = []
    for (const doc of docs) {
      const $ = cheerio.load(doc.content)
      $('.post-item').each((_, el) => {
        const $el = $(el)
        const link = $el.find('h5 a').first()
        const eventUrl = link.attr('href') ?? null
        const title = link.text().trim() || null
        if (!eventUrl || !title) return

        const listItems = $el.find('ul.list-inline li')
        const categoryText = listItems.eq(0).text().trim() || null
        const dateText = listItems.eq(1).text().trim() || null
        const venueText = listItems.eq(2).text().trim() || null
        const imageUrl = $el.find('img').attr('src') ?? null

        const slug = eventUrl.split('/').filter(Boolean).pop() ?? eventUrl
        events.push({
          externalKey: slug,
          title,
          description: null,
          categoryText,
          dateText,
          startIso: null,
          endIso: null,
          venueText,
          addressText: null,
          district: null,
          latitude: null,
          longitude: null,
          organizer: 'Bursa Büyükşehir Belediyesi',
          imageUrl,
          eventUrl,
          ticketUrl: null,
          statusText: $el.text().slice(0, 500),
          sourceUrl: doc.finalUrl,
          raw: { title, categoryText, dateText, venueText, eventUrl },
        })
      })
    }
    return events
  }
}
