import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument } from '../base/http.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

/**
 * Merinos Atatürk Kültür Kongre Merkezi (venue calendar).
 * https://www.merinosakkm.com/etkinlikler — cards (.card-popular) inside
 * links to /etkinlik-detay/<id>/<slug>, with .card-title and a date row.
 */
export class MerinosAkkmAdapter extends EventSourceAdapter {
  readonly config: SourceConfig = {
    id: 'merinos-akkm',
    name: 'Merinos AKKM',
    city: 'Bursa',
    district: 'Osmangazi',
    type: 'venue',
    url: 'https://www.merinosakkm.com/etkinlikler',
    enabled: true,
    scrapeIntervalMinutes: 720,
  }

  async fetch(): Promise<FetchedDocument[]> {
    return [await fetchDocument(this.config.url)]
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const events: ParsedEvent[] = []
    for (const doc of docs) {
      const $ = cheerio.load(doc.content)
      $('a[href*="/etkinlik-detay/"]').each((_, a) => {
        const $a = $(a)
        const card = $a.find('.card-popular')
        if (card.length === 0) return
        const eventUrl = $a.attr('href') ?? null
        const title = card.find('.card-title').first().text().trim() || null
        if (!eventUrl || !title) return
        // date text sits in the info rows below the title (e.g. "30 Ağustos 2026 - 20:00")
        const infoText = card.find('.card-info').text().replace(/\s+/g, ' ').trim()
        const dateText = infoText.replace(title, '').trim() || null
        const imageUrl = card.find('img').attr('src') ?? null
        const idMatch = eventUrl.match(/etkinlik-detay\/(\d+)/)
        const externalKey = idMatch ? `merinos-${idMatch[1]}` : eventUrl

        events.push({
          externalKey,
          title,
          description: null,
          categoryText: null,
          dateText,
          startIso: null,
          endIso: null,
          venueText: 'Merinos Atatürk Kültür Kongre Merkezi',
          addressText: null,
          district: 'Osmangazi',
          latitude: null,
          longitude: null,
          organizer: null,
          imageUrl,
          eventUrl,
          ticketUrl: null,
          statusText: infoText,
          sourceUrl: doc.finalUrl,
          raw: { title, dateText, eventUrl },
        })
      })
    }
    return events
  }
}
