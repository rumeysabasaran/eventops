# City Event Intelligence

An event intelligence platform for a company operating **scooter fleets** and **parking services** across Turkish cities. The platform collects upcoming city events (concerts, festivals, sports, fairs, marathons, cultural events) and turns them into operational recommendations:

**Events → Impact Analysis → Business Opportunity → Operational Recommendation**

## Supported Cities

| Service | Cities |
| --- | --- |
| Parking | Bursa, Zonguldak, Muğla, Samsun, Ordu |
| Scooter | Bursa, Yalova, Balıkesir, Kütahya, Antalya, Nevşehir |

Bursa supports both services.

## Features

- **Dashboard** — KPIs (upcoming / high-impact / weekly events, expected attendance, opportunities), city & service filters, 30-day activity timeline stacked by impact level, highest-impact spotlight.
- **Events** — searchable, filterable, sortable event catalog with impact scores (0–100), parking impact and scooter demand levels.
- **Event Detail** — full event facts, location map, service coverage, and an AI-powered operational insight with parking and fleet action recommendations.
- **City Intelligence** — per-city analytics: event density, category mix, most active locations, top commercial opportunities.
- **Map** — interactive dark map with impact-tiered markers (size + color) and compact event previews.
- **Parking / Scooter Opportunities** — ranked opportunity tables with opportunity scores and recommended actions.
- **Data Sources & Scraper Monitoring** — modular scraper adapter registry (ticketing platforms, municipality calendars, venue calendars, sports federations) with health status, and execution logs of the ingestion pipeline.

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 3 (custom dark enterprise theme)
- React Router (hash routing)
- Recharts (timeline, density, category charts)
- Leaflet + react-leaflet (CARTO dark basemap)
- lucide-react icons, date-fns

## Getting Started

```bash
npm install
npm run server   # start the ingestion backend + API + scheduler (port 3001)
npm run dev      # start the frontend dev server (proxies /api to :3001)
npm run scrape   # run all enabled scrapers once from the CLI
npm run scrape -- biletix   # run a single source by id
npm run build    # frontend type-check + backend type-check + production build
```

## Real Event Ingestion (backend/)

The app ships with a **real, source-driven ingestion pipeline** — no invented events, dates, venues or attendance. Anything a source does not provide is stored as `null` and shown as "Not available".

```
PUBLIC SOURCES → SOURCE REGISTRY → SCRAPERS → RAW DATA → NORMALIZE →
VALIDATE → DEDUPLICATE → VERIFY → SQLITE DATABASE → API → REACT UI
```

- `backend/scrapers/base/EventSourceAdapter.ts` — adapter base class (`fetch → parse → normalize → validate`). Adding a source only requires a new adapter.
- `backend/scrapers/{municipalities,venues,ticketing,sports,organizers}/` — working adapters for verified Bursa sources (Bursa Büyükşehir, Nilüfer, Osmangazi, İnegöl, Merinos AKKM, Biletix, TFF, Eker I Run).
- `backend/services/` — Turkish date normalization (`28 Ağustos 2026 20:00`, `03 - 05 Eylül 2026`, `28.08.2026 | 10:00`…), validation, cross-source deduplication, source verification, cancellation/postponement detection (`iptal`, `ertelendi`, …).
- `backend/database/` — SQLite schema: `sources`, `raw_events` (original payload preserved), `events`, `event_sources`, `event_changes`, `scrape_runs`, `scrape_errors`, `holidays`.
- `backend/jobs/` — per-source interval scheduler (municipality 6h, ticketing 2h, sports 6h…), manual runs, holiday ingestion (Nager.Date public calendar for TR).

### API

- `GET /api/events` (`?city=Bursa`, `?verified=true`, `?status=cancelled`, `?from/?to`)
- `GET /api/events/:id` (includes source references + change history)
- `GET /api/sources` · `GET /api/scrape-runs` · `GET /api/scrape-errors` · `GET /api/holidays`
- `POST /api/scrapers/:sourceId/run`

### Data modes

The UI defaults to **Production** (real ingested events). The original mock dataset is preserved as an isolated **Demo** mode (toggle in the sidebar footer); the two are never mixed.

## Architecture Notes

The scoring and recommendation logic lives in `src/lib/impact.ts`:

- `scoreToLevel` maps the 0–100 impact score to Low / Medium / High / Very High.
- `analyzeRealEvent` computes the impact analysis for real events from source-provided facts only (category, venue type, timing, multi-source confirmation) — it never fabricates factual data.
- `opportunityScore` blends the impact score with service-specific demand for ranking.
- `generateInsight` / `recommendedAction` produce deterministic business-oriented recommendations from event attributes.
