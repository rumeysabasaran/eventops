import type { NormalizedEvent } from '../../types.js'

/**
 * Canonical identity & similarity for cross-source deduplication.
 * Identity never relies on source IDs alone: normalized title + date + city.
 */

const TR_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
}

export function slugifyTitle(title: string): string {
  return title
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşüâîû]/g, (c) => TR_MAP[c] ?? c)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOPWORDS = new Set([
  've', 'ile', 'bir', 'the', 'of', 'and', 'in', 'da', 'de', 'ft', 'feat',
])

export function titleTokens(title: string): Set<string> {
  return new Set(
    slugifyTitle(title)
      .split(' ')
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  )
}

export function canonicalKey(e: NormalizedEvent): string {
  const day = e.startTime ? e.startTime.slice(0, 10) : 'undated'
  const slug = slugifyTitle(e.title).replace(/\s/g, '-').slice(0, 80)
  return `${e.city.toLocaleLowerCase('tr-TR')}|${day}|${slug}`
}

/** Jaccard similarity of title token sets. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a)
  const tb = titleTokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = ta.size + tb.size - inter
  const jaccard = inter / union
  // containment handles "X Konseri" vs "X" cases
  const containment = inter / Math.min(ta.size, tb.size)
  return Math.max(jaccard, containment * 0.9)
}

export interface ExistingEventRow {
  id: number
  title: string
  venue: string | null
  start_time: string | null
  city: string
}

/**
 * Decide whether a normalized event matches an existing event on the same day/city.
 * Threshold tuned to merge "Duman Konseri" / "Duman" but keep distinct events apart.
 */
export function findDuplicate(e: NormalizedEvent, candidates: ExistingEventRow[]): ExistingEventRow | null {
  let best: { row: ExistingEventRow; score: number } | null = null
  for (const row of candidates) {
    const sim = titleSimilarity(e.title, row.title)
    if (sim < 0.62) continue
    // If both have venues and they are clearly different places, require near-identical titles.
    if (e.venue && row.venue) {
      const venueSim = titleSimilarity(e.venue, row.venue)
      if (venueSim < 0.3 && sim < 0.92) continue
    }
    if (!best || sim > best.score) best = { row, score: sim }
  }
  return best?.row ?? null
}
