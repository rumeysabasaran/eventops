/**
 * Place fields come only from source event text (labelled Yer/Mekan/Konum/Adres
 * or the adapter's venue/address fields copied from the page). Nothing is invented.
 */

const PLACE_LABEL = /(?:Yer|Mekân|Mekan|Konum|Adres|Salon(?:u)?)\s*[:：]\s*(.+)/gi

const MONTH =
  'ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik'

const NOT_A_PLACE = new RegExp(
  [
    `^\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}`,
    `^\\d{1,2}\\s+(?:${MONTH})\\b`,
    `^\\d{1,2}[.:]\\d{2}\\s*$`,
    'mevcut koltuk',
    'kalan koltuk',
    'bilet al',
    'detay',
    '^ücretsiz$',
    '^ücretli$',
    '^kaynakta yok$',
    '^https?://',
  ].join('|'),
  'i',
)

function fold(s: string): string {
  return s.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()
}

function stripPlacePrefix(s: string): string {
  return s.replace(/^(?:yer|mekân|mekan|konum|adres|salon(?:u)?)\s*[:：]?\s*/i, '').trim()
}

/** True only when the string can reasonably be a published place, not a date/price/cta. */
export function looksLikeSourcePlace(raw: string | null | undefined, city?: string | null): raw is string {
  if (!raw) return false
  const t = stripPlacePrefix(raw.replace(/\s+/g, ' ').trim())
  if (t.length < 3 || t.length > 160) return false
  if (NOT_A_PLACE.test(t)) return false
  if (city && fold(t) === fold(city)) return false
  return true
}

export function extractLabeledPlaces(text: string | null | undefined): { venue: string | null; address: string | null } {
  let venue: string | null = null
  let address: string | null = null
  if (!text) return { venue, address }
  const re = new RegExp(PLACE_LABEL.source, PLACE_LABEL.flags)
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const label = m[0].split(/[:：]/)[0]?.trim() ?? ''
    const value = m[1]?.replace(/\s+/g, ' ').trim() ?? ''
    const cut = value.split(/\s{2,}|(?:\s+[-–]\s+)|(?:\s+\|\s+)/)[0]?.trim() ?? value
    if (!looksLikeSourcePlace(cut)) continue
    if (/adres/i.test(label)) {
      if (!address) address = cut
    } else if (!venue) {
      venue = cut
    }
  }
  return { venue, address }
}

export function resolveSourcePlace(input: {
  venue: string | null
  address: string | null
  city: string | null
  texts: Array<string | null | undefined>
}): { venue: string | null; address: string | null } {
  let venue = looksLikeSourcePlace(input.venue, input.city) ? stripPlacePrefix(input.venue!.replace(/\s+/g, ' ').trim()) : null
  let address = looksLikeSourcePlace(input.address, input.city)
    ? stripPlacePrefix(input.address!.replace(/\s+/g, ' ').trim())
    : null

  if (!venue || !address) {
    const blob = input.texts.filter(Boolean).join('\n')
    const labeled = extractLabeledPlaces(blob)
    if (!venue && labeled.venue && looksLikeSourcePlace(labeled.venue, input.city)) venue = labeled.venue
    if (!address && labeled.address && looksLikeSourcePlace(labeled.address, input.city)) address = labeled.address
  }

  if (venue && address && fold(venue) === fold(address)) address = null
  return { venue, address }
}
