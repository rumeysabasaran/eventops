import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useData } from '../context/DataContext'
import { CITIES } from '../data/cities'
import type { EventCategory, ImpactLevel } from '../types'
import { scoreToLevel } from '../lib/impact'
import { PageHeader, EmptyState } from '../components/ui'
import EventListItem from '../components/EventListItem'
import { CATEGORY_LABEL, IMPACT_FILTER_LABEL } from '../lib/labels'

const CATEGORIES: EventCategory[] = [
  'Concert',
  'Festival',
  'Sports',
  'Theater',
  'Fair & Expo',
  'Conference',
  'Marathon',
  'Cultural',
  'Community',
]

const IMPACT_FILTERS: { value: 'all' | ImpactLevel; label: string }[] = [
  { value: 'all', label: IMPACT_FILTER_LABEL.all },
  { value: 'critical', label: IMPACT_FILTER_LABEL.critical },
  { value: 'high', label: IMPACT_FILTER_LABEL.high },
  { value: 'medium', label: IMPACT_FILTER_LABEL.medium },
  { value: 'low', label: IMPACT_FILTER_LABEL.low },
]

type SortKey = 'date' | 'impact'

export default function Events() {
  const { events: EVENTS } = useData()
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('all')
  const [category, setCategory] = useState('all')
  const [impact, setImpact] = useState<'all' | ImpactLevel>('all')
  const [sort, setSort] = useState<SortKey>('date')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = EVENTS.filter((e) => {
      if (city !== 'all' && e.city !== city) return false
      if (category !== 'all' && e.category !== category) return false
      if (impact !== 'all' && scoreToLevel(e.impactScore) !== impact) return false
      if (q && !`${e.name} ${e.venue} ${e.district} ${e.city} ${e.organizer}`.toLowerCase().includes(q)) return false
      return true
    })
    if (sort === 'impact') list.sort((a, b) => b.impactScore - a.impactScore)
    return list
  }, [EVENTS, query, city, category, impact, sort])

  return (
    <div>
      <PageHeader
        title="Tüm Etkinlikler"
        subtitle={`${EVENTS.length} yaklaşan doğrulanmış etkinlik listeleniyor`}
      />

      <div className="mx-auto max-w-[1440px] px-6 py-4">
        {/* Filtre ve Arama Alanı */}
        <div className="mb-4 rounded-xl border border-border bg-white p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-full flex-1 sm:min-w-[260px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Etkinlik, mekân veya organizatör ara…"
                className="input-corp w-full pl-9 pr-3 text-[#0f172a]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select value={city} onChange={(e) => setCity(e.target.value)} className="select-corp">
                <option value="all">Tüm Şehirler</option>
                {CITIES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select value={category} onChange={(e) => setCategory(e.target.value)} className="select-corp">
                <option value="all">Tüm Kategoriler</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>

              <select value={impact} onChange={(e) => setImpact(e.target.value as 'all' | ImpactLevel)} className="select-corp">
                {IMPACT_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex items-center gap-1.5 pl-2 border-l border-border">
                <span className="text-[11.5px] font-medium text-text-muted">Sıralama:</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="select-corp">
                  <option value="date">Tarihe Göre</option>
                  <option value="impact">Öncelik Skoruna Göre</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Sonuç Sayısı */}
        <div className="mb-2.5 flex items-center justify-between text-[12px] font-medium text-text-muted">
          <span>{filtered.length} etkinlik bulundu</span>
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <EmptyState title="Filtrelere uygun etkinlik bulunamadı" hint="Lütfen arama terimini veya filtre kriterlerini genişletin." />
        ) : (
          <div className="space-y-1.5 pb-6">
            {filtered.map((e) => (
              <EventListItem key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
