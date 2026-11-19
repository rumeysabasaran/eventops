import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SquareParking, Zap, TrendingUp, CalendarRange, Ticket } from 'lucide-react'
import { useData } from '../context/DataContext'
import { CITIES } from '../data/cities'
import type { ServiceType, ImpactLevel } from '../types'
import { opportunityScore, recommendedAction, LEVEL_ORDER, LEVEL_COLOR, scoreToLevel } from '../lib/impact'
import { formatDate, formatAttendance, relativeDay, daysUntil } from '../lib/format'
import { PageHeader, KpiCard, ImpactBadge, EmptyState } from '../components/ui'
import { CategoryBadge } from '../components/EventListItem'

const SERVICE_META: Record<
  ServiceType,
  { title: string; subtitle: string; levelLabel: string; icon: React.ReactNode; accent: string }
> = {
  scooter: {
    title: 'Scooter / Mikromobilite Fırsatları',
    subtitle: 'Filo yönlendirmesi ve batarya operasyonu gerektirebilecek yüksek talep etkinlikleri',
    levelLabel: 'Scooter Talebi',
    icon: <Zap size={16} />,
    accent: '#10b981',
  },
  parking: {
    title: 'Otopark Operasyonel Fırsatları',
    subtitle: 'Yönetilen otopark lokasyonlarında talep artışı yaratması beklenen etkinlikler',
    levelLabel: 'Otopark Etkisi',
    icon: <SquareParking size={16} />,
    accent: '#064e3b',
  },
}

export default function Opportunities({ service }: { service: ServiceType }) {
  const { events: EVENTS } = useData()
  const meta = SERVICE_META[service]
  const serviceCities = CITIES.filter((c) => c.services.includes(service))
  const [city, setCity] = useState('all')
  const [minLevel, setMinLevel] = useState<ImpactLevel>('medium')

  const rows = useMemo(() => {
    return EVENTS.filter((e) => {
      if (!serviceCities.some((c) => c.name === e.city)) return false
      if (city !== 'all' && e.city !== city) return false
      if (e.eventStatus === 'cancelled') return false
      const level = service === 'parking' ? e.parkingImpact : e.scooterDemand
      return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel]
    })
      .map((e) => ({ e, score: opportunityScore(e, service) }))
      .sort((a, b) => b.score - a.score)
  }, [EVENTS, service, city, minLevel, serviceCities])

  const showAttendance = rows.some((r) => r.e.attendance !== null)
  const ticketedCount = rows.filter((r) => r.e.ticketed === true).length
  const thisWeek = rows.filter((r) => {
    const d = daysUntil(r.e.date)
    return d >= 0 && d <= 7
  }).length
  const critical = rows.filter(
    (r) => (service === 'parking' ? r.e.parkingImpact : r.e.scooterDemand) === 'critical',
  ).length

  return (
    <div>
      <PageHeader
        title={meta.title}
        subtitle={`${meta.subtitle} · Faaliyet: ${serviceCities.map((c) => c.name).join(', ')}`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value as ImpactLevel)}
              className="select-corp"
            >
              <option value="low">Tüm Talep Düzeyleri</option>
              <option value="medium">Orta ve Üzeri Talep</option>
              <option value="high">Yüksek ve Üzeri Talep</option>
              <option value="critical">Yalnızca Kritik Talep</option>
            </select>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="select-corp">
              <option value="all">Tüm Hizmet Şehirleri</option>
              {serviceCities.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="mx-auto max-w-[1440px] px-6 py-4 space-y-4">
        {/* KPI Özeti */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Tespit Edilen Fırsatlar"
            value={String(rows.length)}
            hint={`${serviceCities.length} şehirde aktif`}
            icon={<TrendingUp size={16} />}
          />
          <KpiCard
            label="Kritik Düzey Talep"
            value={String(critical)}
            hint="Öncelikli saha hazırlığı"
            accent="#0d9488"
            icon={meta.icon}
          />
          <KpiCard
            label="7 Gün İçinde"
            value={String(thisWeek)}
            hint="Bu hafta planlanmalı"
            icon={<CalendarRange size={16} />}
          />
          <KpiCard
            label="Biletli Etkinlik"
            value={String(ticketedCount)}
            hint="Doğrulanmış gişe talebi"
            accent={meta.accent}
            icon={<Ticket size={16} />}
          />
        </div>

        {/* Tablo */}
        {rows.length === 0 ? (
          <EmptyState title="Filtrelere uygun operasyonel fırsat bulunamadı" hint="Lütfen minimum talep eşiğini düşürün veya şehir seçimini değiştirin." />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary/70">
                    <th className="label-xs px-4 py-2.5">Etkinlik</th>
                    <th className="label-xs px-3 py-2.5">Mekân & Şehir</th>
                    <th className="label-xs px-3 py-2.5">Tarih / Saat</th>
                    {showAttendance && <th className="label-xs px-3 py-2.5 text-right">Beklenen Katılım</th>}
                    <th className="label-xs px-3 py-2.5">{meta.levelLabel}</th>
                    <th className="label-xs px-3 py-2.5 text-right">Fırsat Skoru</th>
                    <th className="label-xs px-4 py-2.5">Önerilen Saha Aksiyonu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(({ e, score }) => {
                    const level = service === 'parking' ? e.parkingImpact : e.scooterDemand
                    return (
                      <tr key={e.id} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5">
                          <Link to={`/events/${e.id}`} className="block">
                            <div className="text-[12.5px] font-bold text-corp group-hover:text-[#10b981] transition-colors">
                              {e.name}
                            </div>
                            <div className="mt-0.5">
                              <CategoryBadge category={e.category} />
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-[12px] font-semibold text-corp">{e.venue}</div>
                          <div className="text-[11px] text-text-muted">
                            {e.district}, {e.city}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-[12px] font-medium text-corp">{formatDate(e.date)}</div>
                          <div className="text-[11px] text-text-muted">
                            {e.startTime !== '—' && `${e.startTime}${e.endTime ? `–${e.endTime}` : ''} · `}
                            <span className="font-semibold text-[#065f46]">{relativeDay(e.date)}</span>
                          </div>
                        </td>
                        {showAttendance && (
                          <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold tabular-nums text-corp">
                            {e.attendance !== null ? `${formatAttendance(e.attendance)} pax` : '—'}
                          </td>
                        )}
                        <td className="px-3 py-2.5">
                          <ImpactBadge level={level} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className="font-mono text-[13px] font-bold tabular-nums"
                            style={{ color: LEVEL_COLOR[scoreToLevel(score)] }}
                          >
                            {score}
                          </span>
                        </td>
                        <td className="max-w-xs px-4 py-2.5 text-[11.5px] leading-relaxed text-text-secondary">
                          {recommendedAction(e, service)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
