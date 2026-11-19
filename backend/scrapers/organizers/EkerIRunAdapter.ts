import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument } from '../base/http.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

/**
 * Eker I Run (Bursa road race) — official organizer site https://www.ekerkosu.com/
 * The homepage links to the official timing/registration page on plustimer.com,
 * which carries the race date ("04-10-2026 - 04-10-2026") and location
 * ("Bursa-Nilüfer"). Only the registration link explicitly published by the
 * organizer is followed — no arbitrary external crawling.
 */
export class EkerIRunAdapter extends EventSourceAdapter {
  readonly config: SourceConfig = {
    id: 'eker-i-run',
    name: 'Eker I Run (Macera Akademisi)',
    city: 'Bursa',
    district: 'Nilüfer',
    type: 'organizer',
    url: 'https://www.ekerkosu.com/',
    enabled: true,
    scrapeIntervalMinutes: 720,
  }

  async fetch(): Promise<FetchedDocument[]> {
    const home = await fetchDocument(this.config.url)
    const docs: FetchedDocument[] = [home]
    const $ = cheerio.load(home.content)
    const raceLink = $('a[href*="plustimer.com"][href*="yaris"]').first().attr('href')
    if (raceLink) {
      try {
        docs.push(await fetchDocument(raceLink))
      } catch {
        // organizer homepage alone is not enough for a dated event; parse() will yield nothing
      }
    }
    return docs
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const race = docs.find((d) => d.url.includes('plustimer.com'))
    if (!race) return []
    const $ = cheerio.load(race.content)

    const meta = $('.dz-meta').first()
    if (meta.length === 0) return []
    const metaText = meta.text().replace(/\s+/g, ' ').trim()

    const title =
      meta.find('img[alt]').first().attr('alt')?.trim() ||
      $('h1').first().text().trim() ||
      null
    if (!title) return []

    const dateText = metaText.match(/\d{1,2}-\d{1,2}-\d{4}(?:\s+-\s+\d{1,2}-\d{1,2}-\d{4})?/)?.[0] ?? null
    const locationText = metaText.match(/Bursa[-\s][^\s]+/i)?.[0] ?? null
    const district = locationText?.split(/[-\s]/)[1] ?? null

    return [
      {
        externalKey: race.url.split('/').filter(Boolean).pop() ?? 'eker-i-run',
        title,
        description: null,
        categoryText: 'Yol Koşusu / Maraton',
        dateText,
        startIso: null,
        endIso: null,
        venueText: null,
        addressText: locationText,
        district,
        latitude: null,
        longitude: null,
        organizer: 'Macera Akademisi / Eker',
        imageUrl: null,
        eventUrl: race.url,
        ticketUrl: race.url,
        statusText: metaText.slice(0, 400),
        sourceUrl: this.config.url,
        raw: { title, dateText, locationText, metaText: metaText.slice(0, 600) },
      },
    ]
  }
}
