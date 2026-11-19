import * as cheerio from 'cheerio'
import { EventSourceAdapter } from '../base/EventSourceAdapter.js'
import { fetchDocument, sleep } from '../base/http.js'
import { istanbulCalendarDate, parseTurkishDate } from '../../services/normalization/dates.js'
import type { FetchedDocument, ParsedEvent, SourceConfig } from '../../types.js'

export interface TffLeagueOptions {
  id: string
  name: string
  city: string
  district: string | null
  /** Official TFF fixtures page (server-rendered, windows-1254). */
  url: string
  /** Home-team needle matched against TFF's uppercase display name (tr-TR). */
  teamNeedle: string
  leagueLabel: string
}

/**
 * TFF league fixture list. Rows: tr.haftaninMaclariTr with lblTarih / lblSaat,
 * home (.haftaninMaclariEv) and away (.haftaninMaclariDeplasman).
 * Only home matches of `teamNeedle` become events for that city.
 * The default page is the current week; upcoming weeks are fetched via `?hafta=`.
 */
export class TffLeagueAdapter extends EventSourceAdapter {
  readonly config: SourceConfig
  private readonly teamNeedle: string
  private readonly leagueLabel: string

  constructor(opts: TffLeagueOptions) {
    super()
    this.teamNeedle = opts.teamNeedle
    this.leagueLabel = opts.leagueLabel
    this.config = {
      id: opts.id,
      name: opts.name,
      city: opts.city,
      district: opts.district,
      type: 'sports',
      url: opts.url,
      enabled: true,
      scrapeIntervalMinutes: 360,
    }
  }

  private static readonly FUTURE_WEEKS = 8

  async fetch(): Promise<FetchedDocument[]> {
    const docs = [await fetchDocument(this.config.url)]
    const $ = cheerio.load(docs[0].content)
    const active = Number($('.haftaNoActive a').attr('href')?.match(/hafta=(\d+)/i)?.[1] ?? 0)
    const weekUrls = new Set<string>()
    if (active > 0) {
      $('a[href*="hafta="]').each((_, a) => {
        const href = ($(a).attr('href') ?? '').replace(/#.*$/, '')
        const n = Number(href.match(/hafta=(\d+)/i)?.[1])
        if (!n || n <= active || n > active + TffLeagueAdapter.FUTURE_WEEKS) return
        weekUrls.add(new URL(href, 'https://www.tff.org/').toString())
      })
    }

    for (const url of weekUrls) {
      try {
        docs.push(await fetchDocument(url))
        await sleep(350)
      } catch {
        // week pages are best-effort
      }
    }

    const detailUrls = new Set<string>()
    for (const doc of docs) {
      const $d = cheerio.load(doc.content)
      $d('tr.haftaninMaclariTr').each((_, el) => {
        const home = $d(el).find('.haftaninMaclariEv').text().trim()
        if (!home.toLocaleUpperCase('tr-TR').includes(this.teamNeedle)) return
        const href = $d(el).find('a[href*="macId"]').first().attr('href')
        if (href && detailUrls.size < 6) detailUrls.add(new URL(href, 'https://www.tff.org/').toString())
      })
    }
    for (const url of detailUrls) {
      try {
        docs.push(await fetchDocument(url))
        await sleep(400)
      } catch {
        // stadium enrichment is optional
      }
    }
    return docs
  }

  parse(docs: FetchedDocument[]): ParsedEvent[] {
    const listDocs = docs.filter((d) => !/macId=/i.test(d.url) && !/macId=/i.test(d.finalUrl))
    const details = docs.filter((d) => /macId=/i.test(d.url) || /macId=/i.test(d.finalUrl))
    const events: ParsedEvent[] = []
    const seen = new Set<string>()
    const today = istanbulCalendarDate()

    const stadiumByMacId = new Map<string, string>()
    for (const d of details) {
      const macId = d.url.match(/macId=(\d+)/i)?.[1] ?? d.finalUrl.match(/macId=(\d+)/i)?.[1]
      if (!macId) continue
      const $d = cheerio.load(d.content)
      const text = $d('body').text()
      const stad = text.match(/Stad[:\s]+([^\n\r]{3,80})/i)?.[1]?.trim()
      if (stad) stadiumByMacId.set(macId, stad)
    }

    for (const list of listDocs) {
      const $ = cheerio.load(list.content)
      $('tr.haftaninMaclariTr').each((_, el) => {
        const $el = $(el)
        const home = $el.find('.haftaninMaclariEv').text().trim()
        const away = $el.find('.haftaninMaclariDeplasman').text().trim()
        if (!home.toLocaleUpperCase('tr-TR').includes(this.teamNeedle)) return

        const dateCell = $el.find('.haftaninMaclariTarih')
        const spans = dateCell.find('span')
        const date = spans.eq(0).text().trim()
        const time = spans.eq(1).text().trim()
        if (!date) return

        const scoreText = $el.find('.haftaninMaclariSkor').text().replace(/\s+/g, '')
        const played = /\d-\d/.test(scoreText)
        if (played) return

        const dateText = `${date} ${time}`.trim()
        const parsed = parseTurkishDate(dateText)
        if (parsed.start && parsed.start.slice(0, 10) < today) return

        const detailHref = $el.find('a[href*="macId"]').first().attr('href')
        const macId = detailHref?.match(/macId=(\d+)/i)?.[1] ?? `${date}-${home}-${away}`
        const externalKey = `mac-${macId}`
        if (seen.has(externalKey)) return
        seen.add(externalKey)
        const eventUrl = detailHref ? new URL(detailHref, 'https://www.tff.org/').toString() : list.finalUrl

        events.push({
          externalKey,
          title: `${home} - ${away} (${this.leagueLabel})`,
          description: null,
          categoryText: 'Futbol Maçı',
          dateText,
          startIso: null,
          endIso: null,
          venueText: stadiumByMacId.get(macId) ?? null,
          addressText: null,
          district: null,
          latitude: null,
          longitude: null,
          city: this.config.city,
          organizer: 'Türkiye Futbol Federasyonu',
          imageUrl: null,
          eventUrl,
          ticketUrl: null,
          statusText: null,
          sourceUrl: list.finalUrl,
          raw: { date, time, home, away, macId },
        })
      })
    }
    return events
  }
}
