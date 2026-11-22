import { Link } from 'react-router-dom'
import { MapPin, Users, Clock } from 'lucide-react'
import type { CityEvent } from '../types'
import { ImpactBadge, ScorePill } from './ui'
import { formatDate, relativeDay, formatAttendance } from '../lib/format'
import { categoryLabel, EVENT_STATUS_LABEL } from '../lib/labels'

export const CATEGORY_COLOR: Record<string, string> = {
  Concert: '#047857',     // Zümrüt yeşili
  Festival: '#10b981',    // Birincil yeşil
  Sports: '#0f766e',      // Koyu petrol yeşili
  Theater: '#334155',     // Antrasit / arduvaz
  'Fair & Expo': '#065f46', // Derin orman yeşili
  Conference: '#1e293b',  // Gece mavisi
  Marathon: '#059669',    // Yeşil
  Cultural: '#475569',    // Gri-mavi
  Community: '#0d9488',   // Teal
}

export function categoryColor(category: string): string {
  return CATEGORY_COLOR[category] ?? '#10b981'
}

export function CategoryBadge({ category }: { category: string }) {
  const color = categoryColor(category)
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-badge border px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ color, borderColor: `${color}30`, background: `${color}10` }}
    >
      {categoryLabel(category)}
    </span>
  )
}

export default function EventListItem({ event }: { event: CityEvent }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="group block rounded-lg border border-[#e2e8f0] bg-white px-4 py-3 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-bold text-[#0f172a] group-hover:text-[#10b981] transition-colors">
              {event.name}
            </span>
            <CategoryBadge category={event.category} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] text-[#64748b]">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} className="text-[#94a3b8]" />
              {event.city} · {event.venue}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} className="text-[#94a3b8]" />
              {formatDate(event.date)}
              {event.startTime !== '—' && ` · ${event.startTime}${event.endTime ? `–${event.endTime}` : ''}`}
            </span>
            {event.attendance !== null && (
              <span className="inline-flex items-center gap-1">
                <Users size={12} className="text-[#94a3b8]" />
                {formatAttendance(event.attendance)} katılım
              </span>
            )}
            {event.eventStatus && event.eventStatus !== 'scheduled' && (
              <span className="font-semibold uppercase text-amber-700">
                {EVENT_STATUS_LABEL[event.eventStatus] ?? event.eventStatus}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden flex-col items-end gap-1 sm:flex">
            <ImpactBadge level={event.scooterDemand} prefix="Scooter" />
            <ImpactBadge level={event.parkingImpact} prefix="Otopark" />
          </div>
          <div className="flex w-20 flex-col items-end gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Öncelik</span>
            <ScorePill score={event.impactScore} />
          </div>
          <span className="hidden w-20 text-right text-[11px] font-semibold text-[#64748b] md:block">
            {relativeDay(event.date)}
          </span>
        </div>
      </div>
    </Link>
  )
}
