import { sourceWallTimeToIstanbul } from '../../services/normalization/dates.js'

const EVENT_TYPE = /(?:^|\/)(?:Event|Festival)$|Event$/i

export interface JsonLdEvent {
  name: string
  startIso: string | null
  endIso: string | null
  eventUrl: string | null
  venueText: string | null
  addressText: string | null
  imageUrl: string | null
  description: string | null
  organizer: string | null
  categoryText: string | null
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function typeNames(node: { '@type'?: string | string[] }): string[] {
  return asArray(node['@type']).map(String)
}

function isEventNode(node: Record<string, unknown>): boolean {
  return typeNames(node as { '@type'?: string | string[] }).some((t) => EVENT_TYPE.test(t) || t === 'Festival')
}

function imageUrl(image: unknown): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image)) return imageUrl(image[0])
  if (typeof image === 'object' && image && 'url' in image && typeof (image as { url: unknown }).url === 'string') {
    return (image as { url: string }).url
  }
  return null
}

function placeFields(location: unknown): { venue: string | null; address: string | null } {
  if (!location) return { venue: null, address: null }
  if (typeof location === 'string') return { venue: location, address: null }
  if (typeof location !== 'object') return { venue: null, address: null }
  const loc = location as Record<string, unknown>
  const venue = typeof loc.name === 'string' ? loc.name : null
  const addr = loc.address
  if (typeof addr === 'string') return { venue, address: addr }
  if (addr && typeof addr === 'object') {
    const a = addr as Record<string, string>
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion].filter(Boolean)
    return { venue, address: parts.join(', ') || null }
  }
  return { venue, address: null }
}

function organizerName(org: unknown): string | null {
  if (!org) return null
  if (typeof org === 'string') return org
  if (typeof org === 'object' && org && 'name' in org && typeof (org as { name: unknown }).name === 'string') {
    return (org as { name: string }).name
  }
  return null
}

function flattenGraph(data: unknown): Record<string, unknown>[] {
  if (data == null) return []
  if (Array.isArray(data)) return data.flatMap(flattenGraph)
  if (typeof data !== 'object') return []
  const o = data as Record<string, unknown>
  if (Array.isArray(o['@graph'])) return o['@graph'].flatMap((n) => flattenGraph(n))
  return [o]
}

export function parseJsonLdEvents(html: string, pageUrl: string): JsonLdEvent[] {
  const events: JsonLdEvent[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const data: unknown = JSON.parse(m[1]!)
      for (const node of flattenGraph(data)) {
        if (!isEventNode(node)) continue
        const name = typeof node.name === 'string' ? node.name.trim() : ''
        if (!name) continue
        const startIso = sourceWallTimeToIstanbul(typeof node.startDate === 'string' ? node.startDate : null)
        const endIso = sourceWallTimeToIstanbul(typeof node.endDate === 'string' ? node.endDate : null)
        const url = typeof node.url === 'string' ? node.url : pageUrl
        const place = placeFields(node.location)
        events.push({
          name,
          startIso,
          endIso: endIso && endIso !== startIso ? endIso : null,
          eventUrl: url,
          venueText: place.venue,
          addressText: place.address,
          imageUrl: imageUrl(node.image),
          description: typeof node.description === 'string' ? node.description : null,
          organizer: organizerName(node.organizer),
          categoryText: typeNames(node as { '@type'?: string | string[] }).join(' '),
        })
      }
    } catch {
      // malformed JSON-LD block
    }
  }
  return events
}
