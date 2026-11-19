import { db, nowIso } from './database/db.js'
import { TARGET_CITIES } from './cities.js'
import type { EventSourceAdapter } from './scrapers/base/EventSourceAdapter.js'
import type { SourceConfig } from './types.js'
import { BursaBuyuksehirAdapter } from './scrapers/municipalities/BursaBuyuksehirAdapter.js'
import { NiluferAdapter } from './scrapers/municipalities/NiluferAdapter.js'
import { OsmangaziAdapter } from './scrapers/municipalities/OsmangaziAdapter.js'
import { InegolAdapter } from './scrapers/municipalities/InegolAdapter.js'
import { MerinosAkkmAdapter } from './scrapers/venues/MerinosAkkmAdapter.js'
import { BiletixAdapter } from './scrapers/ticketing/BiletixAdapter.js'
import { TffTrendyol1LigAdapter } from './scrapers/sports/TffTrendyol1LigAdapter.js'
import { TffLeagueAdapter } from './scrapers/sports/TffLeagueAdapter.js'
import { EkerIRunAdapter } from './scrapers/organizers/EkerIRunAdapter.js'
import { OrduBuyuksehirAdapter } from './scrapers/municipalities/OrduBuyuksehirAdapter.js'
import { YalovaBelediyesiAdapter } from './scrapers/municipalities/YalovaBelediyesiAdapter.js'
import { LocalGuideAdapter } from './scrapers/news/LocalGuideAdapter.js'

function biletixAdapters(): BiletixAdapter[] {
  return TARGET_CITIES.map((c) =>
    c.id === 'bursa' ? new BiletixAdapter(c.name) : new BiletixAdapter(c.name, c.id),
  )
}

/** Active adapters — every entry was manually verified against the live site before being added. */
export const ADAPTERS: EventSourceAdapter[] = [
  new BursaBuyuksehirAdapter(),
  new NiluferAdapter(),
  new OsmangaziAdapter(),
  new InegolAdapter(),
  new MerinosAkkmAdapter(),
  ...biletixAdapters(),
  new TffTrendyol1LigAdapter(),
  new TffLeagueAdapter({
    id: 'tff-super-lig-antalya',
    name: 'TFF Trendyol Süper Lig (Antalyaspor)',
    city: 'Antalya',
    district: null,
    url: 'https://www.tff.org/default.aspx?pageID=198',
    teamNeedle: 'ANTALYASPOR',
    leagueLabel: 'Trendyol Süper Lig',
  }),
  new TffLeagueAdapter({
    id: 'tff-super-lig-samsun',
    name: 'TFF Trendyol Süper Lig (Samsunspor)',
    city: 'Samsun',
    district: null,
    url: 'https://www.tff.org/default.aspx?pageID=198',
    teamNeedle: 'SAMSUNSPOR',
    leagueLabel: 'Trendyol Süper Lig',
  }),
  new EkerIRunAdapter(),
  new OrduBuyuksehirAdapter(),
  new YalovaBelediyesiAdapter(),
  new LocalGuideAdapter({
    id: 'bursaetkinlikleri',
    name: 'Bursa Etkinlikleri',
    city: 'Bursa',
    url: 'https://bursaetkinlikleri.com/',
    type: 'news',
  }),
]

/**
 * Sources that were researched but cannot currently be scraped.
 * Kept in the registry with an explicit status + reason; re-evaluated manually.
 */
const INACTIVE_SOURCES: Array<SourceConfig & { status: string }> = [
  {
    id: 'passo',
    name: 'Passo',
    city: 'Bursa',
    district: null,
    type: 'ticketing',
    url: 'https://www.passo.com.tr/tr',
    enabled: false,
    scrapeIntervalMinutes: 120,
    status: 'blocked',
    notes: 'Cloudflare challenge (HTTP 403) — anti-bot protection is not bypassed by policy. Verified 2026-08-28.',
  },
  {
    id: 'yildirim-belediyesi',
    name: 'Yıldırım Belediyesi',
    city: 'Bursa',
    district: 'Yıldırım',
    type: 'district_municipality',
    url: 'https://www.yildirim.bel.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'No dedicated /etkinlikler page (404); homepage shows event links without dates — adapter pending deeper research.',
  },
  {
    id: 'gemlik-belediyesi',
    name: 'Gemlik Belediyesi',
    city: 'Bursa',
    district: 'Gemlik',
    type: 'district_municipality',
    url: 'https://www.gemlik.bel.tr/etkinlikler',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'error',
    notes: 'Site returns HTTP 500 ("There is no row at position 0") on event pages. Verified 2026-08-28.',
  },
  {
    id: 'mudanya-belediyesi',
    name: 'Mudanya Belediyesi',
    city: 'Bursa',
    district: 'Mudanya',
    type: 'district_municipality',
    url: 'https://www.mudanya.bel.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'error',
    notes: 'TLS certificate chain invalid (UNABLE_TO_VERIFY_LEAF_SIGNATURE); scraping without TLS validation is not enabled by policy.',
  },
  {
    id: 'yenisehir-belediyesi-bursa',
    name: 'Yenişehir Belediyesi (Bursa)',
    city: 'Bursa',
    district: 'Yenişehir',
    type: 'district_municipality',
    url: '',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'No verifiable official domain found (yenisehir.bel.tr belongs to Mersin/Yenişehir). No URL is stored until verified.',
  },
  {
    id: 'kestel-belediyesi',
    name: 'Kestel Belediyesi',
    city: 'Bursa',
    district: 'Kestel',
    type: 'district_municipality',
    url: 'https://www.kestel.bel.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Site reachable but no public event calendar found on homepage. Verified 2026-08-28.',
  },
  {
    id: 'orhangazi-belediyesi',
    name: 'Orhangazi Belediyesi',
    city: 'Bursa',
    district: 'Orhangazi',
    type: 'district_municipality',
    url: 'https://orhangazi.bel.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Homepage shows event/announcement links (verified reachable); dedicated adapter pending structure analysis.',
  },
  {
    id: 'gursu-belediyesi',
    name: 'Gürsu Belediyesi',
    city: 'Bursa',
    district: 'Gürsu',
    type: 'district_municipality',
    url: 'https://www.gursu.bel.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Homepage shows many etkinlik links (verified reachable); dedicated adapter pending structure analysis.',
  },
  {
    id: 'mustafakemalpasa-belediyesi',
    name: 'Mustafakemalpaşa Belediyesi',
    city: 'Bursa',
    district: 'Mustafakemalpaşa',
    type: 'district_municipality',
    url: 'https://www.mustafakemalpasa.bel.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Homepage shows event links (verified reachable); dedicated adapter pending structure analysis.',
  },
  {
    id: 'antalya-buyuksehir',
    name: 'Antalya Büyükşehir Belediyesi',
    city: 'Antalya',
    district: null,
    type: 'municipality',
    url: 'https://www.antalya.bel.tr/etkinlikler',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'HTTP 200 but Vue/MCMS SPA — event cards are not in the HTML. Public JSON endpoint not yet identified. Verified 2026-08-29.',
  },
  {
    id: 'samsun-buyuksehir',
    name: 'Samsun Büyükşehir Belediyesi',
    city: 'Samsun',
    district: null,
    type: 'municipality',
    url: 'https://www.samsun.bel.tr/etkinlikler',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'error',
    notes: '/etkinlikler returns HTTP 500; /etkinlik returns 404. Homepage /guncel/etkinlikler is a news list, not a dated calendar. Verified 2026-08-29.',
  },
  {
    id: 'balikesir-buyuksehir',
    name: 'Balıkesir Büyükşehir Belediyesi',
    city: 'Balıkesir',
    district: null,
    type: 'municipality',
    url: 'https://www.balikesir.bel.tr/etkinlikler',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'error',
    notes: '/etkinlikler returns HTTP 500. Verified 2026-08-29.',
  },
  {
    id: 'mugla-buyuksehir',
    name: 'Muğla Büyükşehir Belediyesi',
    city: 'Muğla',
    district: null,
    type: 'municipality',
    url: 'https://www.mugla.bel.tr/etkinlikler',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'error',
    notes: 'Fetch of /etkinlikler failed (network error). Homepage not yet confirmed as a calendar. Verified 2026-08-29.',
  },
  {
    id: 'kutahya-belediyesi',
    name: 'Kütahya Belediyesi',
    city: 'Kütahya',
    district: null,
    type: 'municipality',
    url: 'https://www.kutahya.bel.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Homepage (HTTP 200) lists etkinlik.asp?id= links; a sample detail URL returned HTTP 404. Dedicated adapter pending a working calendar page. Verified 2026-08-29.',
  },
  {
    id: 'zonguldak-belediyesi',
    name: 'Zonguldak Belediyesi',
    city: 'Zonguldak',
    district: null,
    type: 'municipality',
    url: 'https://www.zonguldak.bel.tr/etkinlikler',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'HTTP 200 Next.js SPA — event list is not in the server HTML. Verified 2026-08-29.',
  },
  {
    id: 'nevsehir-belediyesi',
    name: 'Nevşehir Belediyesi',
    city: 'Nevşehir',
    district: null,
    type: 'municipality',
    url: 'https://www.nevsehir.bel.tr/etkinlikler',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: '/etkinlikler returns HTTP 404. No verified calendar URL stored. Verified 2026-08-29.',
  },
  {
    id: 'brs-haber',
    name: 'BRS Haber',
    city: 'Bursa',
    district: null,
    type: 'news',
    url: 'https://www.brshaber.com/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Publishes monthly event-roundup articles, not a dated event calendar or Event JSON. Article timestamps are not event dates. Verified 2026-09-04.',
  },
  {
    id: 'bursada-bu-hafta',
    name: "Bursa'da Bu Hafta",
    city: 'Bursa',
    district: null,
    type: 'news',
    url: 'https://www.bursadabuhafta.com/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Apex domain does not resolve; www host timed out during fetch. Re-evaluate when a stable calendar URL is reachable. Verified 2026-09-04.',
  },
  {
    id: 'bursa-tv',
    name: 'Bursa TV',
    city: 'Bursa',
    district: null,
    type: 'news',
    url: 'https://www.bursatv.com.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Local news site; event coverage is unstructured articles. No machine-readable calendar. Verified 2026-09-04.',
  },
  {
    id: 'akparti-bursa',
    name: 'AK Parti Bursa İl Başkanlığı',
    city: 'Bursa',
    district: null,
    type: 'political',
    url: 'https://www.akparti.org.tr/iller/bursa/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Official il page has contact info only; activity is past news posts, not a public upcoming-event calendar. Verified 2026-09-04.',
  },
  {
    id: 'chp-bursa',
    name: 'CHP Bursa İl Başkanlığı',
    city: 'Bursa',
    district: null,
    type: 'political',
    url: 'https://bursa.chp.org.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Il homepage is a national news feed; dates are article timestamps, not a provincial event calendar. Verified 2026-09-04.',
  },
  {
    id: 'chp-antalya',
    name: 'CHP Antalya İl Başkanlığı',
    city: 'Antalya',
    district: null,
    type: 'political',
    url: 'https://antalya.chp.org.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Same CHP il CMS as Bursa: news/press, no dated upcoming-event calendar. Verified 2026-09-04.',
  },
  {
    id: 'chp-samsun',
    name: 'CHP Samsun İl Başkanlığı',
    city: 'Samsun',
    district: null,
    type: 'political',
    url: 'https://samsun.chp.org.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Same CHP il CMS: news/press, no dated upcoming-event calendar. Verified 2026-09-04.',
  },
  {
    id: 'chp-mugla',
    name: 'CHP Muğla İl Başkanlığı',
    city: 'Muğla',
    district: null,
    type: 'political',
    url: 'https://mugla.chp.org.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'Same CHP il CMS: news/press, no dated upcoming-event calendar. Verified 2026-09-04.',
  },
  {
    id: 'mhp-bursa',
    name: 'MHP Bursa İl Başkanlığı',
    city: 'Bursa',
    district: null,
    type: 'political',
    url: 'https://www.mhp.org.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'National site is news/press; no verified provincial event calendar URL. Verified 2026-09-04.',
  },
  {
    id: 'iyiparti-bursa',
    name: 'İYİ Parti Bursa İl Başkanlığı',
    city: 'Bursa',
    district: null,
    type: 'political',
    url: 'https://iyiparti.org.tr/',
    enabled: false,
    scrapeIntervalMinutes: 360,
    status: 'disabled',
    notes: 'National site; no verified Bursa event calendar with source-provided dates. Verified 2026-09-04.',
  },
]

export function adapterById(id: string): EventSourceAdapter | undefined {
  return ADAPTERS.find((a) => a.config.id === id)
}

/** Sync the registry table with configured adapters + researched-but-inactive sources. */
export function syncRegistry(): void {
  const upsert = db.prepare(`
    INSERT INTO sources (id, name, city, district, type, url, enabled, scrape_interval_minutes, status, notes)
    VALUES (@id, @name, @city, @district, @type, @url, @enabled, @interval, @status, @notes)
    ON CONFLICT(id) DO UPDATE SET
      name=@name, city=@city, district=@district, type=@type, url=@url,
      enabled=@enabled, scrape_interval_minutes=@interval, notes=@notes, status=@status
  `)
  for (const a of ADAPTERS) {
    upsert.run({
      id: a.config.id,
      name: a.config.name,
      city: a.config.city,
      district: a.config.district,
      type: a.config.type,
      url: a.config.url,
      enabled: a.config.enabled ? 1 : 0,
      interval: a.config.scrapeIntervalMinutes,
      status: 'active',
      notes: a.config.notes ?? null,
    })
  }
  for (const s of INACTIVE_SOURCES) {
    upsert.run({
      id: s.id,
      name: s.name,
      city: s.city,
      district: s.district,
      type: s.type,
      url: s.url,
      enabled: 0,
      interval: s.scrapeIntervalMinutes,
      status: s.status,
      notes: s.notes ?? null,
    })
    db.prepare('UPDATE sources SET status=? WHERE id=?').run(s.status, s.id)
  }
  console.log(`[registry] synced ${ADAPTERS.length} active adapters, ${INACTIVE_SOURCES.length} inactive sources at ${nowIso()}`)
}
