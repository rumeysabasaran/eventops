import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument } from '../base/http.js'
import { istanbulCalendarDate, parseTurkishDate } from '../../services/normalization/dates.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

/**
 * Ordu Büyükşehir Belediyesi — https://www.ordu.bel.tr/etkinlikler
 * Cards: `.activity-card` with title link `/etkinlik/<slug>`, category, and one
 * or more `.marker-item` blocks (venue + "5 Mayıs 2026" + "20:00").
 * The list page mixes archive performances with current ones; past dates are skipped.
 */
export class OrduBuyuksehirAdapter extends EventSourceAdapter {
  readonly config: SourceConfig = {
    id: 'ordu-buyuksehir',
    name: 'Ordu Büyükşehir Belediyesi',
    city: 'Ordu',
    district: null,
    type: 'municipality',
    url: 'https://www.ordu.bel.tr/etkinlikler',
    enabled: true,
    scrapeIntervalMinutes: 360,
  }

  async fetch(): Promise<FetchedDocument[]> {
    return [await fetchDocument(this.config.url)]
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const events: ParsedEvent[] = []
    const seen = new Set<string>()
    const today = istanbulCalendarDate()

    for (const doc of docs) {
      const $ = cheerio.load(doc.content)
      $('.activity-card').each((_, el) => {
        const $el = $(el)
        const link = $el.find('h3.title a[href*="/etkinlik/"]').first()
        const title = link.text().trim() || null
        const href = link.attr('href')
        if (!title || !href) return

        const eventUrl = new URL(href, 'https://www.ordu.bel.tr/').toString()
        const slug = eventUrl.split('/').filter(Boolean).pop() ?? title
        const categoryText = $el.find('a.text[href*="/etkinlikler/konu/"]').first().text().trim() || null
        const imageUrl = $el.find('.activity-photo img').attr('src') ?? null

        const markers = $el.find('.marker-item')
        const blocks = markers.length ? markers.toArray() : [el]
        blocks.forEach((block, i) => {
          const $b = $(block)
          const venueText = $b.find('a.heading').first().text().trim() || null
          let datePart: string | null = null
          let timePart: string | null = null
          $b.find('.item').each((_, item) => {
            const icon = $(item).find('i').attr('class') ?? ''
            const text = $(item).find('.text').first().text().replace(/\s+/g, ' ').trim()
            if (!text) return
            if (icon.includes('calendar')) datePart = text
            else if (icon.includes('clock')) timePart = text
          })
          const dateText = [datePart, timePart].filter(Boolean).join(' ') || null
          const dates = parseTurkishDate(dateText)
          if (dates.start && dates.start.slice(0, 10) < today) return

          const externalKey = `${slug}-${datePart ?? i}`
          if (seen.has(externalKey)) return
          seen.add(externalKey)

          events.push({
            externalKey,
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
            city: 'Ordu',
            organizer: 'Ordu Büyükşehir Belediyesi',
            imageUrl,
            eventUrl,
            ticketUrl: null,
            statusText: $el.text().slice(0, 400),
            sourceUrl: doc.finalUrl,
            raw: { title, dateText, venueText, categoryText, eventUrl },
          })
        })
      })
    }
    return events
  }
}
