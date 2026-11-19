import { Link, useParams } from 'react-router-dom'
import { MapContainer, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Clock,
  Users,
  Ticket,
  Building,
  Link2,
  ClipboardList,
  SquareParking,
  Zap,
  ShieldCheck,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { cityByName } from '../data/cities'
import {
  generateInsight,
  recommendedAction,
  cityHasService,
  LEVEL_COLOR,
  scoreToLevel,
} from '../lib/impact'
import { formatDateLong, relativeDay, formatAttendance } from '../lib/format'
import { EVENT_STATUS_LABEL, UNAVAILABLE } from '../lib/labels'
import { LOCATION_PRECISION_LABEL, resolveEventLocation } from '../lib/mapLocation'
import { PageHeader, ImpactBadge, ScoreRing, EmptyState } from '../components/ui'
import { CategoryBadge } from '../components/EventListItem'
import { BasemapTiles } from '../components/BasemapTiles'

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="flex items-center gap-1.5 text-[12px] text-[#64748b]">
        <span className="text-[#94a3b8]">{icon}</span>
        {label}
      </span>
      <span className="text-right text-[12px] font-medium text-[#0f172a]">{value}</span>
    </div>
  )
}

export default function EventDetail() {
  const { id } = useParams()
  const { events, loading } = useData()
  const event = id ? events.find((e) => e.id === id) : undefined

  if (!event) {
    return (
      <div className="p-6">
        <EmptyState
          title={loading ? 'Etkinlik yükleniyor…' : 'Etkinlik bulunamadı'}
          hint={loading ? 'Doğrulanmış kayıtlar alınıyor.' : 'Kayıt veri hattından kaldırılmış olabilir.'}
        />
      </div>
    )
  }

  const city = cityByName(event.city)
  const hasParking = cityHasService(event.city, 'parking')
  const hasScooter = cityHasService(event.city, 'scooter')
  const level = scoreToLevel(event.impactScore)
  const loc = resolveEventLocation(event)

  return (
    <div>
      <PageHeader
        title={event.name}
        subtitle={`${event.city} · ${event.district} · ${relativeDay(event.date)}`}
        actions={
          <Link to="/events" className="btn-secondary">
            <ArrowLeft size={13} /> Tüm etkinlikler
          </Link>
        }
      />

      <div className="mx-auto max-w-[1440px] px-6 py-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <div className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={event.category} />
                    <span className="text-[11.5px] font-medium text-text-muted">
                      {event.ticketed === null ? 'Giriş bilgisi yok' : event.ticketed ? `Ücretli${event.price ? ` · ${event.price}` : ''}` : 'Ücretsiz'}
                    </span>
                    {event.eventStatus && event.eventStatus !== 'scheduled' && (
                      <span className="rounded-badge border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-amber-800">
                        {EVENT_STATUS_LABEL[event.eventStatus] ?? event.eventStatus}
                      </span>
                    )}
                    {event.sourceConflict && (
                      <span className="rounded-badge border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-amber-800">
                        Kaynak çelişkisi
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-[18px] font-bold leading-tight tracking-tight text-corp">{event.name}</h2>
                  <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-text-secondary">{event.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ImpactBadge level={event.parkingImpact} prefix="Otopark" />
                    <ImpactBadge level={event.scooterDemand} prefix="Scooter" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <ScoreRing score={event.impactScore} size={76} />
                  <span className="label-xs">Etki Skoru</span>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-brand" />
                <h3 className="text-[13.5px] font-bold text-corp">Operasyonel İçgörü & Önerilen Aksiyon</h3>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">{generateInsight(event)}</p>

              <div className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className={`rounded-lg border p-3 ${hasScooter ? 'border-emerald-200 bg-emerald-50/40' : 'border-[#e2e8f0] bg-[#f8fafc] opacity-70'}`}>
                  <div className="flex items-center gap-2 text-[12px] font-bold text-[#065f46]">
                    <Zap size={15} /> Filo & Mobilite Aksiyonu
                    {!hasScooter && <span className="ml-auto text-[10px] font-semibold uppercase text-[#94a3b8]">{event.city} içinde yok</span>}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#0f172a]">
                    {hasScooter ? recommendedAction(event, 'scooter') : 'Scooter filosu bu şehirde çalışmıyor.'}
                  </p>
                </div>
                <div className={`rounded-lg border p-3 ${hasParking ? 'border-slate-200 bg-slate-50/60' : 'border-[#e2e8f0] bg-[#f8fafc] opacity-70'}`}>
                  <div className="flex items-center gap-2 text-[12px] font-bold text-[#334155]">
                    <SquareParking size={15} /> Otopark Yönetim Aksiyonu
                    {!hasParking && <span className="ml-auto text-[10px] font-semibold uppercase text-[#94a3b8]">{event.city} içinde yok</span>}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#0f172a]">
                    {hasParking ? recommendedAction(event, 'parking') : 'Şirket bu şehirde otopark hizmeti işletmiyor.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h3 className="text-[13px] font-bold text-corp">Mekân Konumu</h3>
                <span className="flex items-center gap-1.5 text-[11.5px] text-text-muted">
                  <MapPin size={13} className="text-brand" /> {event.address}
                </span>
              </div>
              {!loc ? (
                <div className="flex h-[130px] flex-col items-center justify-center gap-1 px-6 text-center text-[12px] text-text-muted">
                  <span>Bu etkinliğin mekânı henüz harita koordinatına dönüşmedi.</span>
                  <span className="text-[11px] text-text-light">Sadece doğrulanmış konumlar harita üzerinde gösterilir.</span>
                </div>
              ) : (
                <>
                  <MapContainer
                    center={[loc.lat, loc.lng]}
                    zoom={14}
                    scrollWheelZoom={false}
                    style={{ height: 260 }}
                  >
                    <BasemapTiles />
                    <CircleMarker
                      center={[loc.lat, loc.lng]}
                      radius={12}
                      pathOptions={{
                        color: LEVEL_COLOR[level],
                        fillColor: LEVEL_COLOR[level],
                        fillOpacity: 0.6,
                        weight: 2,
                      }}
                    />
                  </MapContainer>
                  <div className="border-t border-border px-4 py-2 text-[11px] text-text-muted">
                    {LOCATION_PRECISION_LABEL[loc.precision]}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="mb-2 text-[13px] font-bold text-corp">Etkinlik Parametreleri</h3>
              <div className="divide-y divide-border">
                <InfoRow icon={<CalendarDays size={14} />} label="Tarih" value={formatDateLong(event.date)} />
                <InfoRow
                  icon={<Clock size={14} />}
                  label="Saat"
                  value={event.startTime !== '—' ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ''}` : UNAVAILABLE}
                />
                {event.attendance !== null && (
                  <InfoRow
                    icon={<Users size={14} />}
                    label="Katılım"
                    value={<span className="font-mono font-bold text-corp">{formatAttendance(event.attendance)}</span>}
                  />
                )}
                <InfoRow icon={<MapPin size={14} />} label="Mekân" value={event.venue} />
                <InfoRow icon={<Building size={14} />} label="İlçe" value={`${event.district}, ${event.city}`} />
                <InfoRow
                  icon={<Ticket size={14} />}
                  label="Giriş"
                  value={event.ticketed === null ? UNAVAILABLE : event.ticketed ? (event.price ?? 'Ücretli') : 'Ücretsiz'}
                />
                <InfoRow icon={<Building size={14} />} label="Organizatör" value={event.organizer} />
                <InfoRow
                  icon={<Link2 size={14} />}
                  label="Kaynak"
                  value={
                    <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="text-brand font-semibold hover:underline">
                      {event.source}
                    </a>
                  }
                />
                {event.sourceConfidence !== undefined && (
                  <InfoRow
                    icon={<ShieldCheck size={14} />}
                    label="Kaynak Güveni"
                    value={
                      <span className="font-mono font-bold text-brand-dark">
                        %{(event.sourceConfidence * 100).toFixed(0)}
                        {event.sourceCount && event.sourceCount > 1 ? ` · ${event.sourceCount} kaynak` : ''}
                      </span>
                    }
                  />
                )}
                {event.sourceStatus && (
                  <InfoRow
                    icon={<Link2 size={14} />}
                    label="Doğrulama"
                    value={
                      <span className={event.sourceStatus === 'ok' ? 'text-brand font-semibold' : 'text-text-muted'}>
                        {event.sourceStatus === 'ok' ? 'Doğrulandı' : event.sourceStatus}
                      </span>
                    }
                  />
                )}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="mb-2 text-[13px] font-bold text-corp">Hizmet Kapsamı — {event.city}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-2">
                  <span className="flex items-center gap-2 text-[12px] font-semibold text-corp">
                    <SquareParking size={15} className="text-brand" /> Otopark Hizmeti
                  </span>
                  <span className={`text-[10.5px] font-bold ${hasParking ? 'text-brand' : 'text-text-light'}`}>
                    {hasParking ? 'AKTİF' : 'HİZMET YOK'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-2">
                  <span className="flex items-center gap-2 text-[12px] font-semibold text-corp">
                    <Zap size={15} className="text-brand" /> Scooter Filosu
                  </span>
                  <span className={`text-[10.5px] font-bold ${hasScooter ? 'text-brand' : 'text-text-light'}`}>
                    {hasScooter ? 'AKTİF' : 'HİZMET YOK'}
                  </span>
                </div>
              </div>
              {city && (
                <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                  {event.city} · Nüfus: {city.population}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
