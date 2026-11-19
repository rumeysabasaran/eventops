import type { DatePrecision } from '../../types.js'

/**
 * Turkish date parsing. Dates are NEVER generated — this module only interprets
 * date strings that were extracted verbatim from a source page.
 * All output is ISO 8601 with the Europe/Istanbul offset (+03:00, no DST since 2016).
 */

const MONTHS: Record<string, number> = {
  ocak: 1,
  şubat: 2,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  ağustos: 8,
  agustos: 8,
  eylül: 9,
  eylul: 9,
  ekim: 10,
  kasım: 11,
  kasim: 11,
  aralık: 12,
  aralik: 12,
}

const MONTH_RE = Object.keys(MONTHS).join('|')

const p2 = (n: number): string => String(n).padStart(2, '0')

const isValidYmd = (y: number, m: number, d: number): boolean =>
  y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31

export const toIso = (y: number, m: number, d: number, hh = 0, mm = 0): string =>
  `${y}-${p2(m)}-${p2(d)}T${p2(hh)}:${p2(mm)}:00+03:00`

export interface ParsedDates {
  start: string | null
  end: string | null
  precision: DatePrecision | null
}

const NONE: ParsedDates = { start: null, end: null, precision: null }

/**
 * When a source omits the year ("28 Ağustos Cuma"), assume the occurrence
 * closest to now that is not more than 45 days in the past.
 */
const inferYear = (m: number, d: number): number => {
  const now = new Date()
  const y = now.getFullYear()
  const candidate = new Date(Date.UTC(y, m - 1, d))
  const diffDays = (candidate.getTime() - now.getTime()) / 86_400_000
  return diffDays < -45 ? y + 1 : y
}

const TIME_RE = /(\d{1,2})[:.](\d{2})/

const extractTime = (text: string): { hh: number; mm: number } | null => {
  const m = text.match(TIME_RE)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (hh > 23 || mm > 59) return null
  return { hh, mm }
}

/** Parse a raw Turkish date string into ISO start/end. Returns nulls when the text is not a date. */
export function parseTurkishDate(input: string | null | undefined): ParsedDates {
  if (!input) return NONE
  const text = input.replace(/\s+/g, ' ').trim()
  if (!text) return NONE
  const lower = text.toLocaleLowerCase('tr-TR')

  // ── Dash-separated numeric range: "04-10-2026 - 04-10-2026" ─────────
  let m = lower.match(/(\d{1,2})-(\d{1,2})-(\d{4})\s+-\s+(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (m) {
    const d1 = Number(m[1])
    const mo1 = Number(m[2])
    const y1 = Number(m[3])
    const d2 = Number(m[4])
    const mo2 = Number(m[5])
    const y2 = Number(m[6])
    if (isValidYmd(y1, mo1, d1) && isValidYmd(y2, mo2, d2)) {
      if (y1 === y2 && mo1 === mo2 && d1 === d2) return { start: toIso(y1, mo1, d1), end: null, precision: 'date' }
      return { start: toIso(y1, mo1, d1), end: toIso(y2, mo2, d2, 23, 59), precision: 'range' }
    }
  }

  // ── Dash-separated numeric single: "04-10-2026" ─────────────────────
  m = lower.match(/(?<![\d-])(\d{1,2})-(\d{1,2})-(\d{4})(?![\d-])/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = Number(m[3])
    if (isValidYmd(y, mo, d)) {
      const time = extractTime(lower.slice((m.index ?? 0) + m[0].length))
      if (time) return { start: toIso(y, mo, d, time.hh, time.mm), end: null, precision: 'datetime' }
      return { start: toIso(y, mo, d), end: null, precision: 'date' }
    }
  }

  // ── Numeric range: 01.09.2026 - 05.09.2026 ───────────────────────────
  m = lower.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})\s*[-–]\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (m) {
    const [, d1, mo1, y1, d2, mo2, y2] = m.map(Number) as unknown as number[]
    if (isValidYmd(y1, mo1, d1) && isValidYmd(y2, mo2, d2)) {
      return { start: toIso(y1, mo1, d1), end: toIso(y2, mo2, d2, 23, 59), precision: 'range' }
    }
  }

  // ── Numeric single: 30.08.2026 [19:30] / 28/08/2026 / "28.08.2026 | 10:00" ──
  m = lower.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = Number(m[3])
    if (isValidYmd(y, mo, d)) {
      const time = extractTime(lower.slice((m.index ?? 0) + m[0].length))
      if (time) return { start: toIso(y, mo, d, time.hh, time.mm), end: null, precision: 'datetime' }
      return { start: toIso(y, mo, d), end: null, precision: 'date' }
    }
  }

  // ── Full named range with years: "27 Ağustos 2026 - 10 Eylül 2026" ──
  m = lower.match(
    new RegExp(`(\\d{1,2})\\s+(${MONTH_RE})\\s+(\\d{4})\\s*[-–]\\s*(\\d{1,2})\\s+(${MONTH_RE})\\s+(\\d{4})`),
  )
  if (m) {
    const d1 = Number(m[1])
    const mo1 = MONTHS[m[2]]
    const y1 = Number(m[3])
    const d2 = Number(m[4])
    const mo2 = MONTHS[m[5]]
    const y2 = Number(m[6])
    if (isValidYmd(y1, mo1, d1) && isValidYmd(y2, mo2, d2)) {
      return { start: toIso(y1, mo1, d1), end: toIso(y2, mo2, d2, 23, 59), precision: 'range' }
    }
  }

  // ── Named-month range, same month: "03 - 05 Eylül 2026" ─────────────
  m = lower.match(new RegExp(`(?<!\\d)(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`))
  if (m) {
    const d1 = Number(m[1])
    const d2 = Number(m[2])
    const mo = MONTHS[m[3]]
    const y = m[4] ? Number(m[4]) : inferYear(mo, d1)
    if (isValidYmd(y, mo, d1) && isValidYmd(y, mo, d2)) {
      return { start: toIso(y, mo, d1), end: toIso(y, mo, d2, 23, 59), precision: 'range' }
    }
  }

  // ── Named-month range, different months: "30 Ağustos - 2 Eylül 2026" ──
  m = lower.match(
    new RegExp(`(\\d{1,2})\\s+(${MONTH_RE})\\s*[-–]\\s*(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`),
  )
  if (m) {
    const d1 = Number(m[1])
    const mo1 = MONTHS[m[2]]
    const d2 = Number(m[3])
    const mo2 = MONTHS[m[4]]
    const y = m[5] ? Number(m[5]) : inferYear(mo1, d1)
    const y2 = mo2 < mo1 ? y + 1 : y
    if (isValidYmd(y, mo1, d1) && isValidYmd(y2, mo2, d2)) {
      return { start: toIso(y, mo1, d1), end: toIso(y2, mo2, d2, 23, 59), precision: 'range' }
    }
  }

  // ── Month-first (event guides): "Eylül 18 @ 20:00" / "Ekim 2, 2026" ──
  m = lower.match(new RegExp(`(${MONTH_RE})\\s+(\\d{1,2})(?:\\s*@\\s*|[,\\s]+)?(?:(\\d{4})\\b)?`))
  if (m && !/^\d{1,2}\s/.test(lower.trim())) {
    const mo = MONTHS[m[1]]
    const d = Number(m[2])
    const y = m[3] ? Number(m[3]) : inferYear(mo, d)
    if (isValidYmd(y, mo, d)) {
      const time = extractTime(lower.slice((m.index ?? 0) + m[0].length)) ?? extractTime(lower)
      if (time) return { start: toIso(y, mo, d, time.hh, time.mm), end: null, precision: 'datetime' }
      return { start: toIso(y, mo, d), end: null, precision: 'date' }
    }
  }

  // ── Named-month single: "28 Ağustos 2026 [Cuma] [20:00]" / "28 Ağustos Cuma" ──
  m = lower.match(new RegExp(`(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`))
  if (m) {
    const d = Number(m[1])
    const mo = MONTHS[m[2]]
    const y = m[3] ? Number(m[3]) : inferYear(mo, d)
    if (isValidYmd(y, mo, d)) {
      const time = extractTime(lower.slice((m.index ?? 0) + m[0].length))
      if (time) return { start: toIso(y, mo, d, time.hh, time.mm), end: null, precision: 'datetime' }
      return { start: toIso(y, mo, d), end: null, precision: 'date' }
    }
  }

  // ── ISO passthrough: 2026-08-28 or 2026-08-28T20:00 ────────────────
  m = lower.match(/(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{2}):(\d{2}))?/)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    if (isValidYmd(y, mo, d)) {
      if (m[4]) return { start: toIso(y, mo, d, Number(m[4]), Number(m[5])), end: null, precision: 'datetime' }
      return { start: toIso(y, mo, d), end: null, precision: 'date' }
    }
  }

  return NONE
}

/**
 * Source wall-clock timestamps without an offset (WordPress / The Events Calendar
 * "2026-09-06 20:00:00") are Europe/Istanbul. Offset/Z timestamps pass through
 * isoInstantToIstanbul.
 */
export function sourceWallTimeToIstanbul(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) return isoInstantToIstanbul(trimmed)
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!isValidYmd(y, mo, d)) return null
  return toIso(y, mo, d, Number(m[4] ?? 0), Number(m[5] ?? 0))
}

/** Convert an ISO instant provided by the source itself (e.g. Biletix "2026-11-26T17:00:00Z"). */
export function isoInstantToIstanbul(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const local = new Date(t + 3 * 3600_000) // UTC+3, Turkey has no DST
  return `${local.getUTCFullYear()}-${p2(local.getUTCMonth() + 1)}-${p2(local.getUTCDate())}T${p2(local.getUTCHours())}:${p2(local.getUTCMinutes())}:00+03:00`
}

/** Calendar date in Europe/Istanbul (YYYY-MM-DD). Listing uses this, not UTC. */
export function istanbulCalendarDate(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}
