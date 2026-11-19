import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument } from '../base/http.js'
import { istanbulCalendarDate, parseTurkishDate, sourceWallTimeToIstanbul } from '../../services/normalization/dates.js'
import type { FetchedDocument, ParsedEvent, SourceConfig, SourceType } from '../../types.js'
import { parseJsonLdEvents } from './jsonLdEvents.js'

export interface LocalGuideOptions {
  id: string
  name: string
  city: string
  url: string
  type: Extract<SourceType, 'news' | 'political'>
  organizer?: string
}

interface TribeEvent {
  id?: number | string
  title?: string
  url?: string
  start_date?: string
  end_date?: string
  excerpt?: string
  image?: { url?: string } | boolean
  venue?: { venue?: string; address?: string; city?: string } | Array<{ venue?: string; address?: string; city?: string }>
  categories?: Array<{ name?: string }>
  organizer?: Array<{ organizer?: string }>
}

/**
 * Local event guides and party pages that publish The Events Calendar JSON
 * and/or schema.org Event markup. Article publish dates are never treated as
 * event dates.
 */
export class LocalGuideAdapter extends EventSourceAdapter {
  readonly config: SourceConfig
  private readonly organizer: string

  constructor(opts: LocalGuideOptions) {
    super()
    this.organizer = opts.organizer ?? opts.name
    this.config = {
      id: opts.id,
      name: opts.name,
      city: opts.city,
      district: null,
      type: opts.type,
      url: opts.url,
      enabled: true,
      scrapeIntervalMinutes: 360,
    }
  }

  async fetch(): Promise<FetchedDocument[]> {
    const docs: FetchedDocument[] = []
    const origin = new URL(this.config.url).origin
    const today = istanbulCalendarDate()
    const tribe = `${origin}/wp-json/tribe/events/v1/events?start_date=${today}&per_page=50&status=publish`
    try {
      docs.push(await fetchDocument(tribe, { json: true }))
    } catch {
      // Tribe REST is optional
    }
    try {
      docs.push(await fetchDocument(this.config.url))
    } catch {
      // list page optional if Tribe succeeded
    }
    if (this.config.type === 'news') {
      for (const path of ['/etkinlikler', '/events']) {
        try {
          docs.push(await fetchDocument(`${origin}${path}`))
        } catch {
          // optional calendar paths
        }
      }
    }
    if (docs.length === 0) throw new Error(`no documents from ${this.config.url}`)
    return docs
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const events: ParsedEvent[] = []
    const seen = new Set<string>()
    const today = istanbulCalendarDate()

    const push = (parsed: ParsedEvent) => {
      if (seen.has(parsed.externalKey)) return
      const start = parsed.startIso ?? parseTurkishDate(parsed.dateText).start
      if (start && start.slice(0, 10) < today) return
      seen.add(parsed.externalKey)
      events.push(parsed)
    }

    for (const doc of docs) {
      if (doc.contentType === 'json' || doc.url.includes('/wp-json/tribe/')) {
        for (const parsed of this.fromTribe(doc)) push(parsed)
        continue
      }
      for (const ld of parseJsonLdEvents(doc.content, doc.finalUrl)) {
        if (!ld.startIso) continue
        push({
          externalKey: `ld-${ld.eventUrl ?? ld.name}`,
          title: ld.name,
          description: ld.description,
          categoryText: ld.categoryText,
          dateText: null,
          startIso: ld.startIso,
          endIso: ld.endIso,
          venueText: ld.venueText,
          addressText: ld.addressText,
          district: null,
          latitude: null,
          longitude: null,
          city: this.config.city,
          organizer: ld.organizer ?? this.organizer,
          imageUrl: ld.imageUrl,
          eventUrl: ld.eventUrl,
          ticketUrl: ld.eventUrl,
          statusText: null,
          sourceUrl: doc.finalUrl,
          raw: ld,
        })
      }
      for (const parsed of this.fromHtmlCards(doc)) push(parsed)
      for (const parsed of this.fromMecCards(doc)) push(parsed)
      if (this.config.type === 'news') {
        for (const parsed of this.fromDatedHeadings(doc)) push(parsed)
      }
    }
    return events
  }

  private fromTribe(doc: FetchedDocument): ParsedEvent[] {
    let json: { events?: TribeEvent[] }
    try {
      json = JSON.parse(doc.content) as { events?: TribeEvent[] }
    } catch {
      return []
    }
    const out: ParsedEvent[] = []
    for (const e of json.events ?? []) {
      const title = (e.title ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const startIso = sourceWallTimeToIstanbul(e.start_date ?? null)
      if (!title || !startIso) continue
      const venues = e.venue ? (Array.isArray(e.venue) ? e.venue : [e.venue]) : []
      const venue = venues[0]
      const id = e.id != null ? String(e.id) : e.url ?? title
      out.push({
        externalKey: `tribe-${id}`,
        title,
        description: e.excerpt ? e.excerpt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null,
        categoryText: e.categories?.map((c) => c.name).filter(Boolean).join(' ') ?? null,
        dateText: null,
        startIso,
        endIso: sourceWallTimeToIstanbul(e.end_date ?? null),
        venueText: venue?.venue ?? null,
        addressText: venue?.address ?? null,
        district: null,
        latitude: null,
        longitude: null,
        city: this.config.city,
        organizer: e.organizer?.[0]?.organizer ?? this.organizer,
        imageUrl: e.image && typeof e.image === 'object' ? e.image.url ?? null : null,
        eventUrl: e.url ?? null,
        ticketUrl: e.url ?? null,
        statusText: null,
        sourceUrl: doc.url,
        raw: e,
      })
    }
    return out
  }

  /** Modern Events Calendar cards: article.mec-event-article[data-start]. */
  private fromMecCards(doc: FetchedDocument): ParsedEvent[] {
    const $ = cheerio.load(doc.content)
    const out: ParsedEvent[] = []
    $('.mec-event-article[data-start], article.mec-event-article[data-start]').each((_, el) => {
      const $el = $(el)
      const startRaw = $el.attr('data-start') ?? null
      const startIso = sourceWallTimeToIstanbul(startRaw)
      const title = $el.find('.mec-event-title a, .mec-event-title, h4 a, h5 a').first().text().replace(/\s+/g, ' ').trim()
      if (!title || !startIso) return
      const href = $el.find('.mec-event-title a, a[href]').first().attr('href')
      const eventUrl = href ? new URL(href, this.config.url).toString() : doc.finalUrl
      const venueText =
        $el.find('.mec-event-loc-place, .mec-venue-title, .mec-event-venue').first().text().replace(/\s+/g, ' ').trim() || null
      const endIso = sourceWallTimeToIstanbul($el.attr('data-end') ?? null)
      const id = $el.attr('data-event-id') ?? eventUrl
      out.push({
        externalKey: `mec-${id}`,
        title,
        description: null,
        categoryText: $el.find('.mec-event-category, .mec-color').first().text().replace(/\s+/g, ' ').trim() || null,
        dateText: null,
        startIso,
        endIso: endIso && endIso !== startIso ? endIso : null,
        venueText,
        addressText: null,
        district: null,
        latitude: null,
        longitude: null,
        city: this.config.city,
        organizer: this.organizer,
        imageUrl: $el.find('img').attr('src') ?? $el.find('img').attr('data-src') ?? null,
        eventUrl,
        ticketUrl: eventUrl,
        statusText: $el.text().slice(0, 400),
        sourceUrl: doc.finalUrl,
        raw: { title, startRaw, eventUrl, venueText },
      })
    })
    return out
  }

  private fromHtmlCards(doc: FetchedDocument): ParsedEvent[] {
    const $ = cheerio.load(doc.content)
    const out: ParsedEvent[] = []
    $('[itemtype*="Event"], .tribe-events-calendar-list__event, article.tribe-events-pro-photo__event-wrapper, .event-item, article.event, .etkinlik-card').each(
      (_, el) => {
        const $el = $(el)
        const title =
          $el.find('.tribe-events-calendar-list__event-title, .tribe-events-pro-photo__event-title, [itemprop="name"]').first().text().replace(/\s+/g, ' ').trim() ||
          $el.find('h2 a, h3 a').first().text().replace(/\s+/g, ' ').trim()
        const href = $el.find('a[href]').first().attr('href')
        const datetime = $el.find('time[datetime]').attr('datetime') ?? $el.find('[itemprop="startDate"]').attr('content')
        const startIso = sourceWallTimeToIstanbul(datetime ?? null)
        const dateText = $el.find('time').first().text().replace(/\s+/g, ' ').trim() || null
        if (!title || (!startIso && !parseTurkishDate(dateText).start)) return
        const eventUrl = href ? new URL(href, this.config.url).toString() : doc.finalUrl
        out.push({
          externalKey: `html-${eventUrl}`,
          title,
          description: null,
          categoryText: this.config.type === 'political' ? 'Siyasi etkinlik' : null,
          dateText: startIso ? null : dateText,
          startIso,
          endIso: null,
          venueText: $el.find('[itemprop="location"], .tribe-events-venue-details').first().text().replace(/\s+/g, ' ').trim() || null,
          addressText: null,
          district: null,
          latitude: null,
          longitude: null,
          city: this.config.city,
          organizer: this.organizer,
          imageUrl: $el.find('img').attr('src') ?? null,
          eventUrl,
          ticketUrl: eventUrl,
          statusText: $el.text().slice(0, 400),
          sourceUrl: doc.finalUrl,
          raw: { title, datetime, dateText, eventUrl },
        })
      },
    )
    return out
  }

  /** Event-guide cards: title heading plus "Eylül 18 @ 20:00" / "4 Eylül 15:00" in the same block. */
  private fromDatedHeadings(doc: FetchedDocument): ParsedEvent[] {
    const $ = cheerio.load(doc.content)
    const skipTitle = /^(tiyatro|konser|stand.?up|workshop|festival|clup party|club party|gösteri|gosteri|bursa'daki|bursa'da öne|öne çıkan)/i
    const out: ParsedEvent[] = []
    $('h5, h4, h3, .elementor-heading-title').each((_, h) => {
      const $h = $(h)
      const title = $h.text().replace(/\s+/g, ' ').trim()
      if (!title || title.length < 3 || title.length > 160 || skipTitle.test(title)) return
      if (/etkinlikleri$|oyunları$|gösterileri$|konserler$|partileri$/i.test(title)) return
      let $box = $h.parent()
      let blob = $box.text().replace(/\s+/g, ' ').trim()
      if (!parseTurkishDate(blob).start || blob.length > 900) {
        let node = $h
        $box = $h
        blob = title
        for (let i = 0; i < 6; i++) {
          node = node.parent()
          if (!node.length) break
          const t = node.text().replace(/\s+/g, ' ').trim()
          if (t.length > 900) break
          if (parseTurkishDate(t).start) {
            $box = node
            blob = t
            break
          }
        }
      }
      if (blob.length < 8 || blob.length > 900) return
      const dates = parseTurkishDate(blob)
      if (!dates.start) return
      const href = $h.find('a[href]').attr('href') ?? $h.closest('a').attr('href') ?? $box.find('a[href]').first().attr('href')
      const eventUrl = href ? new URL(href, this.config.url).toString() : doc.finalUrl
      const venueGuess = blob
        .replace(title, ' ')
        .replace(/(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)\s+\d{1,2}\s*@\s*\d{1,2}[:.]\d{2}/gi, ' ')
        .replace(/\d{1,2}\s+(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)[^,]{0,24}/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      out.push({
        externalKey: `guide-${title}-${dates.start.slice(0, 16)}`,
        title,
        description: null,
        categoryText: null,
        dateText: blob.slice(0, 180),
        startIso: dates.start,
        endIso: dates.end,
        venueText: venueGuess.length >= 3 && venueGuess.length <= 80 ? venueGuess : null,
        addressText: null,
        district: null,
        latitude: null,
        longitude: null,
        city: this.config.city,
        organizer: this.organizer,
        imageUrl: $box.find('img').attr('src') ?? null,
        eventUrl,
        ticketUrl: eventUrl,
        statusText: blob.slice(0, 400),
        sourceUrl: doc.finalUrl,
        raw: { title, blob: blob.slice(0, 300), eventUrl },
      })
    })
    return out
  }
}
