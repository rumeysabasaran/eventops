import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument } from '../base/http.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

/**
 * İnegöl Belediyesi — https://www.inegol.bel.tr/etkinlikler
 * Cards: .event-card (past events carry the "past" class) with .event-title,
 * .event-date, .event-category and .event-location.
 */
export class InegolAdapter extends EventSourceAdapter {
  readonly config: SourceConfig = {
    id: 'inegol-belediyesi',
    name: 'İnegöl Belediyesi',
    city: 'Bursa',
    district: 'İnegöl',
    type: 'district_municipality',
    url: 'https://www.inegol.bel.tr/etkinlikler',
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
      $('.event-card').each((_, el) => {
        const $el = $(el)
        if (($el.attr('class') ?? '').includes('past')) return
        const title = $el.find('.event-title').first().text().trim() || null
        if (!title) return
        // Meta rows: [Tarih] "06 Eylül 2026" · [Saat] "10:00" · [Konum] "Heykel Meydanı" · [Ücret]
        const metaByAlt = new Map<string, string>()
        $el.find('.meta-item').each((_, mi) => {
          const alt = $(mi).find('img').attr('alt')?.trim().toLocaleLowerCase('tr-TR')
          const text = $(mi).find('.meta-text, .event-price').first().text().trim()
          if (alt && text) metaByAlt.set(alt, text)
        })
        const datePart = metaByAlt.get('tarih') ?? null
        const timePart = metaByAlt.get('saat') ?? null
        const dateText = datePart ? `${datePart}${timePart ? ` ${timePart}` : ''}` : null
        const categoryText = $el.find('.event-category').first().text().trim() || null
        const venueText = metaByAlt.get('konum') ?? $el.find('.event-location').first().text().trim() ?? null
        const href = $el.find('a[href*="/etkinlik/"]').first().attr('href') ?? $el.closest('a').attr('href') ?? null
        const eventUrl = href ? new URL(href, 'https://www.inegol.bel.tr/').toString() : null
        const imageUrl = $el.find('img').attr('src') ?? null
        const slug = eventUrl ? eventUrl.split('/').filter(Boolean).pop()! : `${title}-${dateText}`

        events.push({
          externalKey: `inegol-${slug}`,
          title,
          description: null,
          categoryText,
          dateText,
          startIso: null,
          endIso: null,
          venueText,
          addressText: null,
          district: 'İnegöl',
          latitude: null,
          longitude: null,
          organizer: 'İnegöl Belediyesi',
          imageUrl,
          eventUrl,
          ticketUrl: null,
          statusText: $el.text().slice(0, 400),
          sourceUrl: doc.finalUrl,
          raw: { title, dateText, categoryText, venueText, eventUrl },
        })
      })
    }
    return events
  }
}
