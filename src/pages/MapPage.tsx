import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Circle, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronRight, Clock, MapPin, SquareParking, X, Zap } from 'lucide-react'
import { useData } from '../context/DataContext'
import { CITIES } from '../data/cities'
import type { CityEvent, ImpactLevel } from '../types'
import { cityHasService, recommendedAction, scoreToLevel, LEVEL_COLOR, LEVEL_LABEL } from '../lib/impact'
import { daysUntil, formatDate, relativeDay } from '../lib/format'
import { UNAVAILABLE } from '../lib/labels'
import { PageHeader, ImpactBadge, ScoreRing } from '../components/ui'
import { CategoryBadge } from '../components/EventListItem'
import { BasemapTiles } from '../components/BasemapTiles'
import { groupEventsOnMap, pinVenueTitle, resolveEventLocation, type MapPinGroup } from '../lib/mapLocation'

const LEVELS: ImpactLevel[] = ['critical', 'high', 'medium', 'low']
const PLANNING_RADIUS_M = 800

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

/** Seçili mekânı, karar panelinin kapatmadığı alana ortalar. */
function FocusEvent({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    const zoom = 14
    const point = map.project([lat, lng], zoom)
    if (map.getSize().x >= 768) point.x += 190
    else point.y += 130
    map.flyTo(map.unproject(point, zoom), zoom, { duration: 0.8 })
  }, [map, lat, lng])
  return null
}

const shiftTime = (hhmm: string, minutes: number): string => {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h * 60 + m + minutes + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function TimeWindow({ event }: { event: CityEvent }) {
  if (event.startTime === '—') {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-[11.5px] text-text-muted">
        <Clock size={13} /> Başlangıç saati kaynakta yayımlanmamış
      </div>
    )
  }
  const steps = [
    { label: 'Hazırlık', value: `${shiftTime(event.startTime, -90)}–${event.startTime}` },
    { label: 'Etkinlik', value: event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime },
    { label: 'Dönüş', value: event.endTime ? `${event.endTime} sonrası` : 'Bitişte' },
  ]
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {steps.map((s, i) => (
        <div
          key={s.label}
          className={`rounded-lg border px-2 py-1.5 ${i === 1 ? 'border-emerald-300 bg-emerald-50' : 'border-border bg-surface-secondary'}`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{s.label}</div>
          <div className="mt-0.5 font-mono text-[11px] font-bold text-corp">{s.value}</div>
        </div>
      ))}
    </div>
  )
}

function DecisionPanel({
  event,
  siblings,
  onSelect,
  onClose,
}: {
  event: CityEvent
  siblings: CityEvent[]
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const hasScooter = cityHasService(event.city, 'scooter')
  const hasParking = cityHasService(event.city, 'parking')
  return (
    <aside className="absolute inset-x-2 bottom-2 z-[1000] max-h-[56%] overflow-y-auto rounded-xl border border-border bg-white p-4 shadow-dropdown md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[360px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label-xs">Seçili etkinlik</div>
          <h2 className="mt-1 text-[15px] font-bold leading-snug text-corp">{event.name}</h2>
          <div className="mt-1 flex items-start gap-1 text-[11.5px] text-text-muted">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span>{event.venue} · {event.city}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={event.category} />
            <span className="text-[11px] font-semibold text-[#065f46]">
              {relativeDay(event.date)} · {formatDate(event.date)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button aria-label="Paneli kapat" onClick={onClose} className="text-text-light hover:text-corp">
            <X size={16} />
          </button>
          <ScoreRing score={event.impactScore} size={56} />
        </div>
      </div>

      <div className="mt-3">
        <TimeWindow event={event} />
      </div>

      <div className="mt-3 space-y-2">
        {hasScooter && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
            <div className="flex items-center justify-between gap-2 text-[11.5px] font-bold text-[#065f46]">
              <span className="flex items-center gap-1.5"><Zap size={13} /> Scooter</span>
              <ImpactBadge level={event.scooterDemand} />
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-corp">{recommendedAction(event, 'scooter')}</p>
          </div>
        )}
        {hasParking && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between gap-2 text-[11.5px] font-bold text-[#334155]">
              <span className="flex items-center gap-1.5"><SquareParking size={13} /> Otopark</span>
              <ImpactBadge level={event.parkingImpact} />
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-corp">{recommendedAction(event, 'parking')}</p>
          </div>
        )}
      </div>

      {siblings.length > 1 && (
        <div className="mt-3">
          <div className="label-xs mb-1">Bu mekândaki diğer etkinlikler</div>
          <div className="space-y-1">
            {siblings
              .filter((s) => s.id !== event.id)
              .slice(0, 3)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-left text-[11.5px] hover:bg-slate-50"
                >
                  <span className="truncate font-semibold text-corp">{s.name}</span>
                  <span className="shrink-0 text-[10.5px] text-text-muted">{formatDate(s.date)}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      <Link to={`/events/${event.id}`} className="btn-primary mt-3 w-full justify-center">
        Etkinlik detayını aç <ChevronRight size={14} />
      </Link>
      <p className="mt-2 text-[10.5px] leading-relaxed text-text-light">
        Kural tabanlı öneri. Halka {PLANNING_RADIUS_M} m planlama yarıçapını gösterir, saha verisiyle henüz doğrulanmadı.
      </p>
    </aside>
  )
}

export default function MapPage() {
  const { events: EVENTS } = useData()
  const [visible, setVisible] = useState<Set<ImpactLevel>>(new Set(LEVELS))
  const [city, setCity] = useState('Bursa')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelClosed, setPanelClosed] = useState(false)

  const inCity = useMemo(
    () => (city === 'all' ? EVENTS : EVENTS.filter((e) => e.city === city)),
    [EVENTS, city],
  )

  const pins = useMemo(() => {
    const located = inCity.filter((e) => visible.has(scoreToLevel(e.impactScore)))
    return groupEventsOnMap(located)
  }, [inCity, visible])

  const bestEvent = useMemo(() => {
    const candidates = inCity.filter(
      (e) => e.eventStatus !== 'cancelled' && e.venue !== UNAVAILABLE && resolveEventLocation(e) && daysUntil(e.date) <= 30,
    )
    return [...candidates].sort((a, b) => b.impactScore - a.impactScore)[0] ?? null
  }, [inCity])

  const selected = panelClosed ? null : (inCity.find((e) => e.id === selectedId) ?? bestEvent)
  const selectedLoc = selected ? resolveEventLocation(selected) : null
  const selectedPin = selectedLoc
    ? pins.find((p) => p.lat === selectedLoc.lat && p.lng === selectedLoc.lng)
    : undefined

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

  const selectEvent = (id: string) => {
    setSelectedId(id)
    setPanelClosed(false)
  }

  const selectedCity = CITIES.find((c) => c.name === city)
  const center: [number, number] = selectedCity ? [selectedCity.lat, selectedCity.lng] : [39.3, 32.0]
  const zoom = selectedCity ? 12 : 6

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Etkinlik Haritası"
        subtitle={
          pins.length === 0
            ? hidden > 0
              ? `${hidden} etkinlik var; mekân adı henüz harita eşleşmesi bekliyor`
              : 'Bu filtrede gösterilecek etkinlik yok'
            : `${pins.length} doğrulanmış konum · ${mappedEvents} etkinlik${hidden > 0 ? ` · ${hidden} konumsuz` : ''}`
        }
        actions={
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              setSelectedId(null)
              setPanelClosed(false)
            }}
            className="select-corp"
          >
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
        <MapContainer key={city} center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
          <BasemapTiles />
          <InvalidateSize />
          {selectedLoc ? <FocusEvent lat={selectedLoc.lat} lng={selectedLoc.lng} /> : <FitPins pins={pins} city={city} />}
          {selected && selectedLoc && (
            <Circle
              center={[selectedLoc.lat, selectedLoc.lng]}
              radius={PLANNING_RADIUS_M}
              interactive={false}
              pathOptions={{ color: '#047857', weight: 2, dashArray: '6 6', fillColor: '#10b981', fillOpacity: 0.12 }}
            />
          )}
          {pins.map((g) => {
            const top = [...g.events].sort((a, b) => b.impactScore - a.impactScore)[0]
            const level = scoreToLevel(top.impactScore)
            const isSelected = g.key === selectedPin?.key
            return (
              <CircleMarker
                key={`${g.key}-${isSelected}`}
                center={[g.lat, g.lng]}
                radius={isSelected ? RADIUS[level] + 4 : RADIUS[level]}
                eventHandlers={{ click: () => selectEvent(top.id) }}
                pathOptions={{
                  color: isSelected ? '#0f172a' : LEVEL_COLOR[level],
                  weight: isSelected ? 2.5 : 1.5,
                  fillColor: LEVEL_COLOR[level],
                  fillOpacity: isSelected ? 0.95 : 0.65,
                }}
              >
                <Tooltip direction="top">{pinVenueTitle(g.events)}</Tooltip>
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

        <div className="absolute left-12 right-2 top-2.5 z-[900] flex flex-wrap gap-1 md:right-auto">
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
                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold shadow-sm ${
                  on ? 'border-brand/40 bg-white text-brand-dark' : 'border-border bg-white/80 text-text-light'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[l] }} />
                {LEVEL_LABEL[l]}
                <span className="font-mono text-[10.5px] text-text-muted">{count}</span>
              </button>
            )
          })}
        </div>

        {selected && selectedLoc && (
          <DecisionPanel
            event={selected}
            siblings={selectedPin?.events ?? [selected]}
            onSelect={selectEvent}
            onClose={() => setPanelClosed(true)}
          />
        )}
      </div>
    </div>
  )
}
