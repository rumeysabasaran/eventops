import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument, sleep } from '../base/http.js'
import { extractLabeledPlaces } from '../../services/normalization/location.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

/**
 * Nilüfer Belediyesi events — https://www.nilufer.bel.tr/etkinlikler
 * List cards: <div class="event"> with <time>28.08.2026 | 20:00</time> and
 * <h3><a href="/etkinlik/<slug>">title</a></h3>. Venue lives on detail pages,
 * so a limited number of detail pages are crawled per run.
 */
export class NiluferAdapter extends EventSourceAdapter {
  readonly config: SourceConfig = {
    id: 'nilufer-belediyesi',
    name: 'Nilüfer Belediyesi',
    city: 'Bursa',
    district: 'Nilüfer',
    type: 'district_municipality',
    url: 'https://www.nilufer.bel.tr/etkinlikler',
    enabled: true,
    scrapeIntervalMinutes: 360,
  }

  private static readonly DETAIL_LIMIT = 12

  async fetch(): Promise<FetchedDocument[]> {
    const docs: FetchedDocument[] = [await fetchDocument(this.config.url)]

    // Crawl a bounded set of detail pages for venue/description enrichment.
    const $ = cheerio.load(docs[0].content)
    const detailUrls = new Set<string>()
    $('.event h3 a').each((_, a) => {
      const href = $(a).attr('href')
      if (href && detailUrls.size < NiluferAdapter.DETAIL_LIMIT) detailUrls.add(href)
    })
    for (const url of detailUrls) {
      try {
        docs.push(await fetchDocument(url))
        await sleep(400)
      } catch {
        // detail enrichment is best-effort; the list card already carries title+date
      }
    }
    return docs
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const [list, ...details] = docs
    const detailByUrl = new Map(details.map((d) => [d.url, d]))
    const events: ParsedEvent[] = []
    const $ = cheerio.load(list.content)

    $('.event').each((_, el) => {
      const $el = $(el)
      const link = $el.find('h3 a').first()
      const eventUrl = link.attr('href') ?? null
      const title = link.text().trim() || null
      if (!eventUrl || !title) return
      const dateText = $el.find('time').first().text().trim() || null
      const imageUrl = $el.find('img').attr('src') ?? null
      const slug = eventUrl.split('/').filter(Boolean).pop() ?? eventUrl

      let venueText: string | null = null
      let addressText: string | null = null
      let description: string | null = null
      let statusText: string | null = null
      const detail = detailByUrl.get(eventUrl)
      if (detail) {
        const $d = cheerio.load(detail.content)
        // Detail page renders venue/location rows as labelled info items.
        const bodyText = $d('main, article, .event-detail, body').first().text()
        const labeled = extractLabeledPlaces(bodyText)
        venueText = labeled.venue
        addressText = labeled.address
        description =
          $d('meta[name="description"]').attr('content')?.trim() ||
          $d('.event-detail p, article p').first().text().trim() ||
          null
        statusText = bodyText.slice(0, 800)
      }

      events.push({
        externalKey: slug,
        title,
        description,
        categoryText: null,
        dateText,
        startIso: null,
        endIso: null,
        venueText,
        addressText,
        district: 'Nilüfer',
        latitude: null,
        longitude: null,
        organizer: 'Nilüfer Belediyesi',
        imageUrl,
        eventUrl,
        ticketUrl: null,
        statusText,
        sourceUrl: list.finalUrl,
        raw: { title, dateText, eventUrl, venueText },
      })
    })
    return events
  }
}
