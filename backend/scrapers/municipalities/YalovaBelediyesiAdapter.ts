import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument } from '../base/http.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

/**
 * Yalova Belediyesi event calendar — https://etkinlik.yalova.bel.tr/
 * List cards: `.modern-card` with date ("29 Ağustos 2026 - 09.00"), title,
 * venue and `/etkinlikler/<slug>/<id>`. Hero slides (`.modern-slider-item`)
 * fill gaps when a card is missing.
 */
export class YalovaBelediyesiAdapter extends EventSourceAdapter {
  readonly config: SourceConfig = {
    id: 'yalova-belediyesi',
    name: 'Yalova Belediyesi',
    city: 'Yalova',
    district: null,
    type: 'municipality',
    url: 'https://etkinlik.yalova.bel.tr/',
    enabled: true,
    scrapeIntervalMinutes: 360,
  }

  async fetch(): Promise<FetchedDocument[]> {
    return [await fetchDocument(this.config.url)]
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const events: ParsedEvent[] = []
    const seen = new Set<string>()

    const push = (parsed: ParsedEvent | null) => {
      if (!parsed || seen.has(parsed.externalKey)) return
      seen.add(parsed.externalKey)
      events.push(parsed)
    }

    for (const doc of docs) {
      const $ = cheerio.load(doc.content)

      $('.modern-card').each((_, el) => {
        const $el = $(el)
        const link = $el.find('.modern-card-title a[href*="/etkinlikler/"]').first()
        const title = link.text().replace(/\s+/g, ' ').trim()
        const href = link.attr('href')
        if (!title || !href) return
        const eventUrl = new URL(href, this.config.url).toString()
        const dateText = $el.find('.modern-card-date span').first().text().replace(/\s+/g, ' ').trim() || null
        const venueText = $el.find('.info-item').first().find('span').first().text().replace(/\s+/g, ' ').trim() || null
        const imageUrl = $el.find('.modern-card-thumb img').attr('src') ?? null
        push(this.toParsed(title, eventUrl, dateText, venueText, imageUrl, doc.finalUrl, $el.text()))
      })

      $('.modern-slider-item').each((_, el) => {
        const $el = $(el)
        const title = $el.find('h2').first().text().replace(/\s+/g, ' ').trim()
        const href = $el.find('a[href*="/etkinlikler/"]').first().attr('href')
        if (!title || !href) return
        const eventUrl = new URL(href, this.config.url).toString()
        const dateText = $el.find('.slider-badge').first().text().replace(/\s+/g, ' ').trim() || null
        let venueText: string | null = null
        $el.find('.d-flex.align-items-center.gap-2').each((_, row) => {
          const t = $(row).text().replace(/\s+/g, ' ').trim()
          if (t && !/mevcut koltuk|kalan/i.test(t)) venueText = t
        })
        const imageUrl = $el.find('img.etkinlik-photo, img.etkinlik-photo-small').first().attr('src') ?? null
        push(this.toParsed(title, eventUrl, dateText, venueText, imageUrl, doc.finalUrl, $el.text()))
      })
    }
    return events
  }

  private toParsed(
    title: string,
    eventUrl: string,
    dateText: string | null,
    venueText: string | null,
    imageUrl: string | null,
    sourceUrl: string,
    rawEl: string,
  ): ParsedEvent {
    const id = eventUrl.split('/').filter(Boolean).pop() ?? title
    return {
      externalKey: `yalova-${id}`,
      title,
      description: null,
      categoryText: null,
      dateText,
      startIso: null,
      endIso: null,
      venueText,
      addressText: null,
      district: null,
      latitude: null,
      longitude: null,
      city: 'Yalova',
      organizer: 'Yalova Belediyesi',
      imageUrl,
      eventUrl,
      ticketUrl: eventUrl,
      statusText: rawEl.slice(0, 400),
      sourceUrl,
      raw: { title, dateText, venueText, eventUrl },
    }
  }
}
