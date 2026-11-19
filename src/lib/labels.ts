import type { EventCategory, ImpactLevel } from '../types'

export const UNAVAILABLE = 'Kaynakta yok'

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  Concert: 'Konser',
  Festival: 'Festival',
  Sports: 'Spor',
  Theater: 'Tiyatro',
  'Fair & Expo': 'Fuar',
  Conference: 'Konferans',
  Marathon: 'Maraton',
  Cultural: 'Kültür',
  Community: 'Topluluk',
}

export const categoryLabel = (category: string): string =>
  CATEGORY_LABEL[category as EventCategory] ?? category

export const EVENT_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Planlandı',
  cancelled: 'İptal',
  postponed: 'Ertelendi',
}

export const IMPACT_FILTER_LABEL: Record<'all' | ImpactLevel, string> = {
  all: 'Tüm etki düzeyleri',
  critical: 'Çok yüksek',
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük',
}
