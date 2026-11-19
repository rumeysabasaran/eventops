import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument, sleep } from '../base/http.js'
import { extractLabeledPlaces } from '../../services/normalization/location.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

/**
 * Osmangazi Belediyesi — https://www.osmangazi.bel.tr/etkinlikler
 * Cards: .isotope-item with category (.thumb-info-inner), date range
 * "03 - 05 Eylül 2026" (.thumb-info-type) and detail link /etkinlik/<slug>.
 * Titles are only on detail pages, so a bounded detail crawl resolves them.
 */
export class OsmangaziAdapter extends EventSourceAdapter {
  readonly config: SourceConfig = {
    id: 'osmangazi-belediyesi',
    name: 'Osmangazi Belediyesi',
    city: 'Bursa',
    district: 'Osmangazi',
    type: 'district_municipality',
    url: 'https://www.osmangazi.bel.tr/etkinlikler',
    enabled: true,
    scrapeIntervalMinutes: 360,
  }

  private static readonly DETAIL_LIMIT = 24

  async fetch(): Promise<FetchedDocument[]> {
    const docs: FetchedDocument[] = [await fetchDocument(this.config.url)]
    const $ = cheerio.load(docs[0].content)
    const urls = new Set<string>()
    $('.isotope-item a[href*="/etkinlik/"]').each((_, a) => {
      const href = $(a).attr('href')
      if (href && urls.size < OsmangaziAdapter.DETAIL_LIMIT) urls.add(href)
    })
    for (const url of urls) {
      try {
        docs.push(await fetchDocument(url))
        await sleep(400)
      } catch {
        // best-effort detail crawl
      }
    }
    return docs
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const [list, ...details] = docs
    const detailByUrl = new Map(details.map((d) => [d.url, d]))
    const events: ParsedEvent[] = []
    const $ = cheerio.load(list.content)

    $('.isotope-item').each((_, el) => {
      const $el = $(el)
      const link = $el.find('a[href*="/etkinlik/"]').first()
      const eventUrl = link.attr('href') ?? null
      if (!eventUrl) return
      const categoryText = $el.find('.thumb-info-inner').first().text().trim() || null
      const dateText = $el.find('.thumb-info-type').first().text().trim() || null
      const imageUrl = $el.find('img').attr('src') ?? null
      const slug = eventUrl.split('/').filter(Boolean).pop() ?? eventUrl

      // Title: prefer detail page <title>/<h*>; fall back to the slug text.
      let title: string | null = null
      let description: string | null = null
      let statusText: string | null = null
      let venueText: string | null = null
      let addressText: string | null = null
      const detail = detailByUrl.get(eventUrl)
      if (detail) {
        const $d = cheerio.load(detail.content)
        title =
          $d('meta[property="og:title"]').attr('content')?.split('|')[0].trim() ||
          $d('h1').first().text().trim() ||
          $d('h2').first().text().trim() ||
          $d('title').text().split('|')[0].trim() ||
          null
        description = $d('meta[name="description"]').attr('content')?.trim() || null
        const bodyText = $d('main, article, .event-detail, body').first().text()
        const labeled = extractLabeledPlaces(bodyText)
        venueText = labeled.venue
        addressText = labeled.address
        statusText = bodyText.slice(0, 800)
      }
      if (!title) {
        // Slug like "osmangazi-belediyesi-dunya-muzikleri-orkestrasi-...-2026-08-28-1"
        title = slug
          .replace(/-\d{4}-\d{2}-\d{2}(-\d+)?$/, '')
          .split('-')
          .filter(Boolean)
          .map((w) => w[0]?.toUpperCase() + w.slice(1))
          .join(' ')
      }
      if (!title) return

      events.push({
        externalKey: slug,
        title,
        description,
        categoryText,
        dateText,
        startIso: null,
        endIso: null,
        venueText,
        addressText,
        district: 'Osmangazi',
        latitude: null,
        longitude: null,
        organizer: 'Osmangazi Belediyesi',
        imageUrl,
        eventUrl,
        ticketUrl: null,
        statusText,
        sourceUrl: list.finalUrl,
        raw: { slug, categoryText, dateText, eventUrl },
      })
    })
    return events
  }
}
