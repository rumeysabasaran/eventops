import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CalendarRange,
  SquareParking,
  Zap,
  ChevronRight,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useData } from '../context/DataContext'
import { CITIES } from '../data/cities'
import type { ServiceType } from '../types'
import { scoreToLevel, LEVEL_COLOR, LEVEL_ORDER, LEVEL_LABEL } from '../lib/impact'
import { daysUntil, formatDate, formatAttendance, istanbulDay, relativeDay } from '../lib/format'
import { resolveEventLocation } from '../lib/mapLocation'
import { UNAVAILABLE } from '../lib/labels'
import { PageHeader, KpiCard, ImpactBadge, ScoreRing, CHART_TOOLTIP, CHART_GRID, CHART_AXIS } from '../components/ui'
import EventListItem from '../components/EventListItem'

export default function Dashboard() {
  const { events: allEvents } = useData()
  const [city, setCity] = useState('all')
  const [service, setService] = useState<'all' | ServiceType>('all')
  const [activeTab, setActiveTab] = useState<'highImpact' | 'upcoming'>('highImpact')

  const events = useMemo(() => {
    return allEvents.filter((e) => {
      if (city !== 'all' && e.city !== city) return false
      if (service !== 'all') {
        const c = CITIES.find((c) => c.name === e.city)
        if (!c?.services.includes(service)) return false
      }
      return true
    })
  }, [allEvents, city, service])

  const highImpact = useMemo(() => events.filter((e) => e.impactScore >= 65), [events])
  const thisWeek = useMemo(() => {
    return events.filter((e) => {
      const d = daysUntil(e.date)
      return d >= 0 && d <= 7
    })
  }, [events])

  const parkingOpps = useMemo(() => {
    return events.filter(
      (e) => LEVEL_ORDER[e.parkingImpact] >= 2 && CITIES.find((c) => c.name === e.city)?.services.includes('parking'),
    )
  }, [events])

  const scooterOpps = useMemo(() => {
    return events.filter(
      (e) => LEVEL_ORDER[e.scooterDemand] >= 2 && CITIES.find((c) => c.name === e.city)?.services.includes('scooter'),
    )
  }, [events])

  const timeline = useMemo(() => {
    const days: { day: string; iso: string; low: number; medium: number; high: number; critical: number }[] = []
    for (let i = 0; i < 30; i++) {
      const dt = istanbulDay(i)
      const iso = dt.toISOString().slice(0, 10)
      days.push({
        day: dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        iso,
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      })
    }
    for (const e of events) {
      const bucket = days.find((d) => d.iso === e.date)
      if (bucket) bucket[scoreToLevel(e.impactScore)] += 1
    }
    return days
  }, [events])

  const topHighImpact = useMemo(() => {
    // Önce aksiyon alınabilir olanlar: konumu doğrulanmış ve önümüzdeki 30 gün içinde.
    const actionable = (e: (typeof highImpact)[number]) =>
      e.eventStatus !== 'cancelled' && e.venue !== UNAVAILABLE && resolveEventLocation(e) !== null && daysUntil(e.date) <= 30
    return [...highImpact].sort(
      (a, b) => Number(actionable(b)) - Number(actionable(a)) || b.impactScore - a.impactScore,
    )
  }, [highImpact])

  const cityOptions = service === 'all' ? CITIES : CITIES.filter((c) => c.services.includes(service))
  const featuredEvent = topHighImpact[0]

  return (
    <div>
      {/* Üst başlık ve filtreler */}
      <PageHeader
        title="Genel Bakış"
        subtitle={`${cityOptions.length} şehir takip ediliyor · Toplam ${events.length} doğrulanmış etkinlik`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={service}
              onChange={(e) => {
                setService(e.target.value as 'all' | ServiceType)
                setCity('all')
              }}
              className="select-corp"
            >
              <option value="all">Tüm Faaliyet Alanları</option>
              <option value="scooter">Mikromobilite</option>
              <option value="parking">Otopark Operasyonu</option>
            </select>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="select-corp">
              <option value="all">Tüm Şehirler</option>
              {cityOptions.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="mx-auto max-w-[1440px] space-y-4 px-6 py-5">
        {/* 4 KPI Kartı: Nötr açık gri ikon kutusu, koyu kurşun sayılar, orta gri açıklamalar */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Yaklaşan Etkinlikler"
            value={String(events.length)}
            hint={`${highImpact.length} tanesi yüksek öncelikli`}
            icon={<CalendarDays size={18} />}
          />
          <KpiCard
            label="Bu Hafta (7 Gün)"
            value={String(thisWeek.length)}
            hint="Yakın tarihli etkinlikler"
            icon={<CalendarRange size={18} />}
          />
          <KpiCard
            label="Scooter Planı"
            value={String(scooterOpps.length)}
            hint="Filo kaydırma gerektirebilir"
            icon={<Zap size={18} />}
          />
          <KpiCard
            label="Otopark Planı"
            value={String(parkingOpps.length)}
            hint="Kapasite planı gerektirebilir"
            icon={<SquareParking size={18} />}
          />
        </div>

        {/* Orta bölüm: 30 günlük yoğunluk ve sıradaki öncelikli etkinlik */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Grafik (8 Kolon): Monokromatik Yeşil & Antrasit Palet */}
          <div className="card min-w-0 p-5 xl:col-span-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3">
              <div>
                <h2 className="text-[14px] font-bold text-[#0f172a]">30 Günlük Etkinlik Yoğunluğu</h2>
                <p className="text-[12px] text-[#64748b]">Gün bazında etkinliklerin öncelik düzeyine göre dağılımı</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {(['critical', 'high', 'medium', 'low'] as const).map((l) => (
                  <span key={l} className="flex items-center gap-1.5 text-[11px] font-medium text-[#475569]">
                    <span className="h-2 w-2 rounded-sm" style={{ background: LEVEL_COLOR[l] }} />
                    {LEVEL_LABEL[l]}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <ResponsiveContainer width="100%" height={215}>
                <BarChart data={timeline} barCategoryGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: CHART_AXIS, fontSize: 11 }}
                    axisLine={{ stroke: CHART_GRID }}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: CHART_AXIS, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                    contentStyle={CHART_TOOLTIP}
                    labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                  />
                  <Bar dataKey="low" stackId="a" fill={LEVEL_COLOR.low} name="Düşük" />
                  <Bar dataKey="medium" stackId="a" fill={LEVEL_COLOR.medium} name="Orta" />
                  <Bar dataKey="high" stackId="a" fill={LEVEL_COLOR.high} name="Yüksek" />
                  <Bar dataKey="critical" stackId="a" fill={LEVEL_COLOR.critical} name="Çok Yüksek" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Günün Öncelikli Etkinliği (4 Kolon) */}
          <div className="card flex min-w-0 flex-col p-5 xl:col-span-4">
            <div className="mb-3 flex items-center justify-between border-b border-[#e2e8f0] pb-2.5">
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#0f172a]">
                <Sparkles size={14} className="text-[#10b981]" /> Sıradaki Öncelikli Etkinlik
              </span>
              {featuredEvent && <ImpactBadge level={scoreToLevel(featuredEvent.impactScore)} />}
            </div>

            {featuredEvent ? (
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/events/${featuredEvent.id}`}
                        className="text-[14.5px] font-bold leading-snug text-[#0f172a] hover:text-[#10b981] transition-colors"
                      >
                        {featuredEvent.name}
                      </Link>
                      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[#64748b]">
                        <MapPin size={13} className="shrink-0 text-[#64748b]" />
                        <span className="truncate">{featuredEvent.city} · {featuredEvent.venue}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-[#0f172a]">
                        <Clock size={13} className="shrink-0 text-[#64748b]" />
                        <span>{relativeDay(featuredEvent.date)} · {formatDate(featuredEvent.date)}{featuredEvent.startTime !== '—' ? ` · ${featuredEvent.startTime}` : ''}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <ScoreRing score={featuredEvent.impactScore} size={64} />
                    </div>
                  </div>

                  {/* Hizmet düzeyleri */}
                  <div className="mt-4 space-y-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[12px]">
                    {featuredEvent.attendance !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b]">Tahmini Katılım:</span>
                        <span className="font-mono font-bold text-[#0f172a]">
                          {formatAttendance(featuredEvent.attendance)} kişi
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748b]">Scooter:</span>
                      <ImpactBadge level={featuredEvent.scooterDemand} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748b]">Otopark:</span>
                      <ImpactBadge level={featuredEvent.parkingImpact} />
                    </div>
                  </div>
                </div>

                {/* Birincil aksiyon butonu */}
                <div className="mt-4 pt-2">
                  <Link
                    to="/map"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#10b981] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-sm transition-all hover:bg-[#059669] active:scale-[0.99]"
                  >
                    <span>Haritada Aç</span>
                    <ChevronRight size={15} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-[12px] text-[#64748b]">
                Filtreye uygun etkinlik bulunamadı.
              </div>
            )}
          </div>
        </div>

        {/* Sekmeli etkinlik listesi */}
        <div className="card p-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] pb-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Aktif sekme: Koyu antrasit (#0F172A) zemin ve beyaz metin */}
              <button
                onClick={() => setActiveTab('highImpact')}
                className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                  activeTab === 'highImpact'
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200'
                }`}
              >
                Öncelikli Etkinlikler ({highImpact.length})
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                  activeTab === 'upcoming'
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200'
                }`}
              >
                Tarihe Göre Sıralı ({events.length})
              </button>
            </div>

            <Link
              to="/events"
              className="flex items-center gap-1 text-[12px] font-semibold text-[#10b981] hover:text-[#059669] hover:underline"
            >
              Tüm Listeyi İncele <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-1.5">
            {(activeTab === 'highImpact' ? topHighImpact.slice(0, 7) : events.slice(0, 7)).map((e) => (
              <EventListItem key={e.id} event={e} />
            ))}
            {(activeTab === 'highImpact' ? topHighImpact : events).length === 0 && (
              <div className="py-8 text-center text-[12.5px] text-[#64748b]">
                Kriterlere uygun etkinlik bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
