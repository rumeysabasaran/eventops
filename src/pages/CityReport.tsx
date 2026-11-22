import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Flame,
  Gauge,
  SquareParking,
  Zap,
  MapPin,
  Ticket,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useData } from '../context/DataContext'
import { CITIES } from '../data/cities'
import { LEVEL_ORDER, opportunityScore, LEVEL_COLOR, scoreToLevel } from '../lib/impact'
import { formatAttendance, daysUntil, formatDate, istanbulDay } from '../lib/format'
import { PageHeader, KpiCard, ImpactBadge, CHART_TOOLTIP, CHART_GRID, CHART_AXIS } from '../components/ui'
import { CategoryBadge } from '../components/EventListItem'
import { categoryLabel, UNAVAILABLE } from '../lib/labels'

const CAT_COLORS = ['#10b981', '#064e3b', '#047857', '#0f172a', '#334155', '#6ee7b7', '#475569', '#059669', '#94a3b8']

export default function CityReport() {
  const { events: allEvents } = useData()
  const [cityName, setCityName] = useState('Bursa')
  const city = CITIES.find((c) => c.name === cityName)!
  const events = useMemo(() => allEvents.filter((e) => e.city === cityName), [allEvents, cityName])

  const highImpact = events.filter((e) => e.impactScore >= 65)
  const withAttendance = events.filter((e) => e.attendance !== null)
  const hasAttendanceData = withAttendance.length > 0
  const ticketedCount = events.filter((e) => e.ticketed === true).length
  const busiestWeekCount = useMemo(() => {
    let max = 0
    for (let start = 0; start <= 23; start++) {
      const count = events.filter((e) => {
        const d = daysUntil(e.date)
        return d >= start && d < start + 7
      }).length
      max = Math.max(max, count)
    }
    return max
  }, [events])

  const parkingOpps = city.services.includes('parking')
    ? events.filter((e) => LEVEL_ORDER[e.parkingImpact] >= 2)
    : []
  const scooterOpps = city.services.includes('scooter')
    ? events.filter((e) => LEVEL_ORDER[e.scooterDemand] >= 2)
    : []

  const density = useMemo(() => {
    const days: { day: string; iso: string; events: number; attendance: number }[] = []
    for (let i = 0; i < 30; i++) {
      const dt = istanbulDay(i)
      days.push({
        day: dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        iso: dt.toISOString().slice(0, 10),
        events: 0,
        attendance: 0,
      })
    }
    for (const e of events) {
      const bucket = days.find((d) => d.iso === e.date)
      if (bucket) {
        bucket.events += 1
        bucket.attendance += e.attendance ?? 0
      }
    }
    return days
  }, [events])

  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of events) map.set(e.category, (map.get(e.category) ?? 0) + 1)
    return [...map.entries()]
      .map(([name, value]) => ({ name: categoryLabel(name), value }))
      .sort((a, b) => b.value - a.value)
  }, [events])

  const locations = useMemo(() => {
    const map = new Map<string, { venue: string; district: string; events: number; attendance: number; maxScore: number }>()
    for (const e of events) {
      if (e.venue === UNAVAILABLE) continue
      const cur = map.get(e.venue) ?? { venue: e.venue, district: e.district, events: 0, attendance: 0, maxScore: 0 }
      cur.events += 1
      cur.attendance += e.attendance ?? 0
      cur.maxScore = Math.max(cur.maxScore, e.impactScore)
      map.set(e.venue, cur)
    }
    return [...map.values()]
      .sort((a, b) => b.attendance - a.attendance || b.events - a.events || b.maxScore - a.maxScore)
      .slice(0, 6)
  }, [events])

  return (
    <div>
      <PageHeader
        title="Şehir Raporu"
        subtitle="Seçili şehirde etkinlik yoğunluğu ve mekân dağılımı"
        actions={
          <select value={cityName} onChange={(e) => setCityName(e.target.value)} className="select-corp">
            {CITIES.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="mx-auto max-w-[1440px] space-y-4 px-6 py-4">
        {/* Şehir Başlık Kartı */}
        <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-white to-brand-bg/30">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[16px] font-bold tracking-tight text-corp">{city.name}</h2>
              <div className="flex gap-1.5">
                {city.services.includes('parking') && (
                  <span className="rounded-badge border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-teal-800">
                    Otopark
                  </span>
                )}
                {city.services.includes('scooter') && (
                  <span className="rounded-badge border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-cyan-800">
                    Scooter
                  </span>
                )}
              </div>
            </div>
            <p className="mt-0.5 text-[12px] text-text-muted">
              Nüfus {city.population} · {events.length} yaklaşan doğrulanmış etkinlik
            </p>
          </div>
          <Link to="/map" className="btn-secondary">
            <MapPin size={13} className="text-brand" /> Haritada Gör
          </Link>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Yaklaşan Etkinlik" value={String(events.length)} hint="Kayıtlı toplam" icon={<CalendarDays size={14} />} />
          <KpiCard label="Yüksek Öncelik" value={String(highImpact.length)} hint="Öncelikli takip" accent="#0d9488" icon={<Flame size={14} />} />
          <KpiCard
            label="Biletli Etkinlik"
            value={String(ticketedCount)}
            hint="Bilet bağlantısı bulunan"
            icon={<Ticket size={14} />}
          />
          <KpiCard label="En Yoğun Hafta" value={String(busiestWeekCount)} hint="7 günlük en yüksek" icon={<Gauge size={14} />} />
          <KpiCard
            label="Otopark Planı"
            value={city.services.includes('parking') ? String(parkingOpps.length) : '—'}
            hint={city.services.includes('parking') ? 'Yüksek öncelikli' : 'Hizmet yok'}
            accent="#0f766e"
            icon={<SquareParking size={14} />}
          />
          <KpiCard
            label="Scooter Planı"
            value={city.services.includes('scooter') ? String(scooterOpps.length) : '—'}
            hint={city.services.includes('scooter') ? 'Yüksek öncelikli' : 'Hizmet yok'}
            accent="#0284c7"
            icon={<Zap size={14} />}
          />
        </div>

        {/* Grafikler */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="card p-4 xl:col-span-2">
            <h3 className="text-[13px] font-bold text-corp">30 Günlük Etkinlik Takvimi</h3>
            <p className="mb-3 mt-0.5 text-[11.5px] text-text-muted">
              {hasAttendanceData ? 'Gün bazında beklenen toplam katılım' : 'Günlük etkinlik sayısı'}
            </p>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={density}>
                <defs>
                  <linearGradient id="att" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: CHART_AXIS, fontSize: 10.5 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} interval={2} />
                <YAxis
                  tick={{ fill: CHART_AXIS, fontSize: 10.5 }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                  tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}K` : String(v))}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  labelStyle={{ color: '#0f2937', fontWeight: 600 }}
                  formatter={(value) =>
                    hasAttendanceData ? [formatAttendance(Number(value ?? 0)), 'Katılım'] : [String(value), 'Etkinlik']
                  }
                />
                <Area
                  type="monotone"
                  dataKey={hasAttendanceData ? 'attendance' : 'events'}
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#att)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-4">
            <h3 className="text-[13px] font-bold text-corp">Kategori Dağılımı</h3>
            <p className="mb-2 mt-0.5 text-[11.5px] text-text-muted">Şehirdeki etkinlik türleri</p>
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={120} height={135}>
                <PieChart>
                  <Pie data={categories} dataKey="value" innerRadius={34} outerRadius={52} paddingAngle={2} stroke="none">
                    {categories.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {categories.slice(0, 5).map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                      {c.name}
                    </span>
                    <span className="font-mono font-bold text-corp">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mekânlar ve öncelikli etkinlikler */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="card p-4">
            <h3 className="mb-2.5 text-[13px] font-bold text-corp">En Aktif Mekânlar</h3>
            <div className="space-y-1.5">
              {locations.map((l) => (
                <div key={l.venue} className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-bold text-corp">{l.venue}</div>
                    <div className="text-[11px] text-text-muted">
                      {l.district} · {l.events} etkinlik
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {l.attendance > 0 && (
                      <span className="font-mono text-[11.5px] font-semibold text-text-secondary">{formatAttendance(l.attendance)}</span>
                    )}
                    <span
                      className="font-mono text-[12px] font-bold"
                      style={{ color: LEVEL_COLOR[scoreToLevel(l.maxScore)] }}
                    >
                      {l.maxScore}
                    </span>
                  </div>
                </div>
              ))}
              {locations.length === 0 && <p className="text-[12px] text-text-muted">Kayıtlı mekân yok.</p>}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-2.5 text-[13px] font-bold text-corp">Öncelikli Etkinlikler</h3>
            <div className="space-y-1.5">
              {[...events]
                .map((e) => ({
                  e,
                  score: Math.max(
                    city.services.includes('parking') ? opportunityScore(e, 'parking') : 0,
                    city.services.includes('scooter') ? opportunityScore(e, 'scooter') : 0,
                  ),
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map(({ e, score }) => (
                  <Link
                    key={e.id}
                    to={`/events/${e.id}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-2 hover:bg-brand-bg/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[12px] font-bold text-corp">{e.name}</span>
                        <CategoryBadge category={e.category} />
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-muted">
                        {formatDate(e.date)} {e.startTime !== '—' && `· ${e.startTime}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {city.services.includes('parking') && <ImpactBadge level={e.parkingImpact} prefix="P" />}
                      {city.services.includes('scooter') && <ImpactBadge level={e.scooterDemand} prefix="S" />}
                      <span className="font-mono text-[12.5px] font-bold text-brand-dark">{score}</span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
