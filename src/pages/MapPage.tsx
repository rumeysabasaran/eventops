import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useData } from '../context/DataContext'
import { CITIES } from '../data/cities'
import type { ImpactLevel } from '../types'
import { scoreToLevel, LEVEL_COLOR, LEVEL_LABEL } from '../lib/impact'
import { formatDate, relativeDay } from '../lib/format'
import { PageHeader, ImpactBadge } from '../components/ui'
import { CategoryBadge } from '../components/EventListItem'
import { BasemapTiles } from '../components/BasemapTiles'
import { groupEventsOnMap, pinPrecisionLabel, pinVenueTitle, type MapPinGroup } from '../lib/mapLocation'

const LEVELS: ImpactLevel[] = ['critical', 'high', 'medium', 'low']

const RADIUS: Record<ImpactLevel, number> = {
  low: 7,
  medium: 8,
  high: 10,
  critical: 12,
}

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 80)
    return () => window.clearTimeout(t)
  }, [map])
  return null
}

function FitPins({ pins, city }: { pins: MapPinGroup[]; city: string }) {
  const map = useMap()
  useEffect(() => {
    if (pins.length === 0) return
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 15)
      return
    }
    map.fitBounds(
      pins.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [40, 40], maxZoom: city === 'all' ? 7 : 15 },
    )
  }, [map, pins, city])
  return null
}

export default function MapPage() {
  const { events: EVENTS } = useData()
  const [visible, setVisible] = useState<Set<ImpactLevel>>(new Set(LEVELS))
  const [city, setCity] = useState('all')

  const inCity = useMemo(
    () => (city === 'all' ? EVENTS : EVENTS.filter((e) => e.city === city)),
    [EVENTS, city],
  )

  const pins = useMemo(() => {
    const located = inCity.filter((e) => visible.has(scoreToLevel(e.impactScore)))
    return groupEventsOnMap(located)
  }, [inCity, visible])

  const mappedEvents = pins.reduce((n, p) => n + p.events.length, 0)
  const hidden = inCity.length - mappedEvents

  const toggle = (l: ImpactLevel) => {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(l)) next.delete(l)
      else next.add(l)
      return next
    })
  }

  const selectedCity = CITIES.find((c) => c.name === city)
  const center: [number, number] = selectedCity ? [selectedCity.lat, selectedCity.lng] : [39.3, 32.0]
  const zoom = selectedCity ? 12 : 6

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Etkinlik & Talep Haritası"
        subtitle={
          pins.length === 0
            ? hidden > 0
              ? `${hidden} etkinlik var; mekân adı henüz harita eşleşmesi bekliyor`
              : 'Bu filtrede gösterilecek etkinlik yok'
            : `${pins.length} doğrulanmış konum · ${mappedEvents} etkinlik haritalandı${
                hidden > 0 ? ` (${hidden} koordinatsız gizlendi)` : ''
              }`
        }
        actions={
          <select value={city} onChange={(e) => setCity(e.target.value)} className="select-corp">
            <option value="all">Tüm Şehirler</option>
            {CITIES.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="relative min-h-0 flex-1">
        <MapContainer key={`${city}`} center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
          <BasemapTiles />
          <InvalidateSize />
          <FitPins pins={pins} city={city} />
          {pins.map((g) => {
            const top = [...g.events].sort((a, b) => b.impactScore - a.impactScore)[0]
            const level = scoreToLevel(Math.max(...g.events.map((e) => e.impactScore)))
            return (
              <CircleMarker
                key={g.key}
                center={[g.lat, g.lng]}
                radius={RADIUS[level]}
                pathOptions={{
                  color: LEVEL_COLOR[level],
                  weight: 1.5,
                  fillColor: LEVEL_COLOR[level],
                  fillOpacity: 0.65,
                }}
              >
                <Popup>
                  <div className="p-3">
                    <div className="text-[12.5px] font-bold leading-snug text-corp">{pinVenueTitle(g.events)}</div>
                    <div className="mt-0.5 text-[11px] text-text-muted">
                      {g.events.length} etkinlik · {top.city} · {pinPrecisionLabel(g.events)}
                    </div>
                    <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
                      {g.events.map((e) => (
                        <li key={e.id} className="border-t border-border pt-1.5 first:border-t-0 first:pt-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <CategoryBadge category={e.category} />
                            <span
                              className="font-mono text-[11.5px] font-bold"
                              style={{ color: LEVEL_COLOR[scoreToLevel(e.impactScore)] }}
                            >
                              {e.impactScore}
                            </span>
                          </div>
                          <Link to={`/events/${e.id}`} className="mt-1 block text-[12px] font-bold text-corp hover:text-brand transition-colors">
                            {e.name}
                          </Link>
                          <div className="text-[10.5px] text-text-muted">
                            {relativeDay(e.date)} · {formatDate(e.date)} {e.startTime !== '—' && `· ${e.startTime}`}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <ImpactBadge level={e.parkingImpact} prefix="P" />
                            <ImpactBadge level={e.scooterDemand} prefix="S" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>

        {pins.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-6">
            <div className="max-w-md rounded-xl border border-border bg-white px-4 py-3 text-center shadow-dropdown">
              <div className="text-[13px] font-bold text-corp">Eşleşen Konum Bulunamadı</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-text-muted">
                Haritada yalnızca doğrulanmış açık sokak koordinatları gösterilmektedir.
              </p>
            </div>
          </div>
        )}

        {/* Sağ Üst Filtre Kutusu */}
        <div className="absolute right-4 top-4 z-[1000] w-48 rounded-xl border border-border bg-white/95 p-3 shadow-dropdown backdrop-blur-sm">
          <div className="label-xs mb-2">Etki Düzeyleri</div>
          <div className="space-y-1">
            {LEVELS.map((l) => {
              const count = pins.reduce(
                (n, g) => n + g.events.filter((e) => scoreToLevel(e.impactScore) === l).length,
                0,
              )
              const on = visible.has(l)
              return (
                <button
                  key={l}
                  onClick={() => toggle(l)}
                  className={`flex w-full items-center justify-between rounded-lg border px-2 py-1 text-[11.5px] font-semibold transition-all ${
                    on ? 'border-brand/40 bg-brand-bg text-brand-dark' : 'border-border bg-white text-text-light'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block rounded-full"
                      style={{
                        width: RADIUS[l],
                        height: RADIUS[l],
                        background: `${LEVEL_COLOR[l]}88`,
                        border: `1.5px solid ${LEVEL_COLOR[l]}`,
                      }}
                    />
                    {LEVEL_LABEL[l]}
                  </span>
                  <span className="font-mono text-[11px] text-text-muted">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
