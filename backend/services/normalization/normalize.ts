import type { EventStatus, NormalizedEvent, ParsedEvent, SourceConfig } from '../../types.js'
import { parseTurkishDate, isoInstantToIstanbul } from './dates.js'
import { resolveSourcePlace } from './location.js'

/** Canonical categories shared with the frontend. */
export const CATEGORIES = [
  'Concert',
  'Festival',
  'Sports',
  'Theater',
  'Fair & Expo',
  'Conference',
  'Marathon',
  'Cultural',
  'Community',
] as const

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/maraton|koşu|kosu|yarış|yaris|\brun\b|bisiklet|triatlon/i, 'Marathon'],
  [/festival|şenlik|senlik|\bfest\b/i, 'Festival'],
  [/tiyatro|theatre|theater|opera|bale|müzikal|muzikal|stand-?up/i, 'Theater'],
  [
    /konser|\bmüzik\b|\bmuzik\b|\bmusic\b|\bconcerts?\b|orkestra|senfoni|dinleti|resital|recital|\blive\b|\bpop\b|\brock\b|\bjazz\b|\bmetal\b|\brap\b|hip-?hop/i,
    'Concert',
  ],
  [/fuar|\bexpo\b/i, 'Fair & Expo'],
  [/kongre|konferans|panel|söyleşi|soylesi|seminer|zirve|sempozyum|çalıştay|calistay|eğitim|egitim|atölye|atolye/i, 'Conference'],
  [/spor|maç|mac\b|turnuva|futbol|basketbol|voleybol|güreş|gures|şampiyona|sampiyona|\blig\b|\bsports?\b/i, 'Sports'],
  [/miting|yürüyüş|yuruyus|mitinge|seçim bürosu|secim burosu|parti program/i, 'Community'],
  [/sergi|müze|muze|sanat|sinema|film|kültür|kultur|okuma|kitap|anma|gösteri|gosteri/i, 'Cultural'],
]

/** Source facet codes (Biletix MUSIC/CONCERT, etc.) before falling back to title keywords. */
const SOURCE_CATEGORY_RULES: Array<[RegExp, string]> = [
  [/\b(music|concerts?|konser|müzik|muzik)\b/i, 'Concert'],
  [/\b(pop|rock|jazz|metal|rap|hip-?hop|r&b|rnb|classical|soundtrack|electronic|dj)\b/i, 'Concert'],
  [/\b(theatre|theater|tiyatro|müzikal|muzikal|musical|opera|ballet|bale)\b/i, 'Theater'],
  [/\b(festival|fest)\b/i, 'Festival'],
  [/\b(sports?|futbol|basketbol|voleybol|maç|mac)\b/i, 'Sports'],
  [/\b(marathon|maraton|koşu|run)\b/i, 'Marathon'],
  [/\b(fair|expo|fuar)\b/i, 'Fair & Expo'],
  [/\b(conference|kongre|konferans|seminar)\b/i, 'Conference'],
  [/\b(art|exhibition|sergi|müze|muze|sinema|cinema)\b/i, 'Cultural'],
  [/\b(miting|yürüyüş|yuruyus|siyasi|political)\b/i, 'Community'],
]

export function normalizeCategory(categoryText: string | null, title: string | null): string {
  if (categoryText) {
    for (const [re, cat] of SOURCE_CATEGORY_RULES) {
      if (re.test(categoryText)) return cat
    }
  }
  const haystacks = [categoryText, title].filter(Boolean) as string[]
  for (const hay of haystacks) {
    for (const [re, cat] of CATEGORY_RULES) {
      if (re.test(hay)) return cat
    }
  }
  return 'Community'
}

const CANCELLED_RE = /iptal edildi|iptal\b|gerçekleşmeyecek|gerceklesmeyecek/i
const POSTPONED_RE = /ertelendi|ertelenmiştir|ertelenmistir|yeni tarih|tarih değişikliği|tarih degisikligi|ileri bir tarihe/i

export function detectStatus(...texts: Array<string | null | undefined>): EventStatus {
  const joined = texts.filter(Boolean).join(' ')
  if (POSTPONED_RE.test(joined)) return 'postponed'
  if (CANCELLED_RE.test(joined)) return 'cancelled'
  return 'scheduled'
}

export function cleanText(t: string | null | undefined): string | null {
  if (!t) return null
  const cleaned = t
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || null
}

/** Default normalization used by adapters. Only interprets what the source provided. */
export function normalizeEvent(parsed: ParsedEvent, source: SourceConfig): NormalizedEvent | null {
  const title = cleanText(parsed.title)
  if (!title) return null

  let startTime: string | null = null
  let endTime: string | null = null
  let precision: NormalizedEvent['datePrecision'] = null

  if (parsed.startIso) {
    startTime = isoInstantToIstanbul(parsed.startIso)
    endTime = parsed.endIso && parsed.endIso !== parsed.startIso ? isoInstantToIstanbul(parsed.endIso) : null
    precision = 'datetime'
  } else {
    const dates = parseTurkishDate(parsed.dateText)
    startTime = dates.start
    endTime = dates.end
    precision = dates.precision
  }

  const place = resolveSourcePlace({
    venue: cleanText(parsed.venueText),
    address: cleanText(parsed.addressText),
    city: parsed.city ?? source.city,
    texts: [parsed.description, parsed.statusText, parsed.venueText, parsed.addressText],
  })

  return {
    externalKey: parsed.externalKey,
    title,
    description: cleanText(parsed.description),
    category: normalizeCategory(parsed.categoryText, title),
    startTime,
    endTime,
    datePrecision: precision,
    venue: place.venue,
    address: place.address,
    city: parsed.city ?? source.city,
    district: parsed.district ?? source.district,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    locationPrecision: parsed.latitude != null && parsed.longitude != null ? 'source' : null,
    organizer: cleanText(parsed.organizer) ?? source.name,
    imageUrl: parsed.imageUrl,
    eventUrl: parsed.eventUrl,
    ticketUrl: parsed.ticketUrl,
    status: detectStatus(parsed.statusText, parsed.title, parsed.description),
    sourceUrl: parsed.sourceUrl,
  }
}
