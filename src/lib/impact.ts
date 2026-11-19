import type { CityEvent, ImpactLevel, ServiceType } from '../types'
import { cityByName } from '../data/cities'
import { UNAVAILABLE } from './labels'

export const LEVEL_LABEL: Record<ImpactLevel, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Çok yüksek',
}

export const LEVEL_ORDER: Record<ImpactLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

export const LEVEL_COLOR: Record<ImpactLevel, string> = {
  low: '#CBD5E1',
  medium: '#6EE7B7',
  high: '#10B981',
  critical: '#064E3B',
}

export const scoreToLevel = (score: number): ImpactLevel => {
  if (score >= 85) return 'critical'
  if (score >= 65) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

export const cityHasService = (cityName: string, service: ServiceType): boolean =>
  cityByName(cityName)?.services.includes(service) ?? false

export const opportunityScore = (e: CityEvent, service: ServiceType): number => {
  const level = service === 'parking' ? e.parkingImpact : e.scooterDemand
  const levelBoost = LEVEL_ORDER[level] * 8
  const attendanceBoost = e.attendance !== null ? Math.min(12, Math.round(e.attendance / 2500)) : 0
  return Math.min(100, Math.round(e.impactScore * 0.72 + levelBoost + attendanceBoost))
}

const fmtAttendance = (n: number): string =>
  n >= 1000 ? `${Math.round(n / 100) / 10}B`.replace('.0B', 'B') : String(n)

export const generateInsight = (e: CityEvent): string => {
  const parking = cityHasService(e.city, 'parking')
  const scooter = cityHasService(e.city, 'scooter')
  const hasTime = e.startTime !== '—'
  const window = hasTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : `${e.startTime} itibarıyla`) : 'etkinlik süresince'
  const where = e.venue !== UNAVAILABLE ? e.venue : null
  const parts: string[] = []

  if (e.eventStatus === 'cancelled') {
    return 'Kaynak bu etkinliği İPTAL olarak işaretlemiş. Operasyonel aksiyon gerekmez; ayrılmış kapasite serbest bırakılabilir.'
  }
  if (e.eventStatus === 'postponed') {
    parts.push('Not: kaynak bu etkinliği ERTELENDİ olarak işaretlemiş — kaynak taahhüdünden önce yeni tarihi doğrulayın.')
  }

  parts.push(
    e.attendance !== null
      ? `${where ? `${where} çevresinde` : `${e.city} içinde`} ${hasTime ? `${e.startTime}–${e.endTime ?? 'bitiş'} arasında` : 'etkinlik gününde'} ${fmtAttendance(e.attendance)} katılımcı bekleniyor${where ? '' : ' (kaynak yer yayımlamamış)'}.`
      : `${where ? `${where} çevresinde` : `${e.city} içinde`} ${window} yaya hareketi bekleniyor (${where ? 'kaynak katılım sayısı yayımlamamış' : 'kaynak yer ve katılım sayısı yayımlamamış'}).`,
  )

  if (scooter) {
    if (LEVEL_ORDER[e.scooterDemand] >= 2) {
      parts.push(
        `Scooter talebi ${LEVEL_LABEL[e.scooterDemand].toLocaleLowerCase('tr-TR')} görünüyor: ek araçları ${hasTime ? `${e.startTime} saatinde 60–90 dakika önce` : 'etkinlikten önce'} alan çevresine kaydırın ve ${e.endTime ? `${e.endTime} sonrasında` : 'etkinlik bittikten sonra'} dönüş akışı için dengeleme turu planlayın.`,
      )
    } else if (e.scooterDemand === 'medium') {
      parts.push(
        'Orta düzey scooter talebi bekleniyor; 800 m içindeki müsaitliği izleyin, doluluk %70’i geçerse takviye edin.',
      )
    }
  }

  if (parking) {
    if (LEVEL_ORDER[e.parkingImpact] >= 2) {
      parts.push(
        `Otopark baskısı ${LEVEL_LABEL[e.parkingImpact].toLocaleLowerCase('tr-TR')} bekleniyor: yakındaki lotlar ${hasTime ? `${e.startTime} öncesinde` : 'etkinlik başlarken'} dolabilir. Etkinlik tarifesi, ön rezervasyon ve yedek lot yönlendirmesi düşünülebilir.`,
      )
    } else if (e.parkingImpact === 'medium') {
      parts.push(
        `Yakın lot doluluğu ılımlı artabilir; standart kadro yeterlidir, ${hasTime ? `${e.startTime} itibarıyla` : 'etkinlik süresince'} izleyin.`,
      )
    }
  }

  if (!parking && LEVEL_ORDER[e.parkingImpact] >= 2) {
    parts.push(
      `Not: otopark etkisi ${LEVEL_LABEL[e.parkingImpact].toLocaleLowerCase('tr-TR')} ancak şirket ${e.city} içinde otopark işletmiyor — olası genişleme sinyali.`,
    )
  }
  if (!scooter && LEVEL_ORDER[e.scooterDemand] >= 2) {
    parts.push(
      `Not: scooter talebi ${LEVEL_LABEL[e.scooterDemand].toLocaleLowerCase('tr-TR')} ancak filo ${e.city} içinde çalışmıyor — olası genişleme sinyali.`,
    )
  }

  if (parts.length === 1) {
    parts.push('Beklenen operasyonel etki sınırlı; filo veya kapasite aksiyonu gerekmez.')
  }

  return parts.join(' ')
}

interface RealEventInput {
  category: string
  title: string
  venue: string | null
  startTime: string | null
  sourceCount: number
  city: string
}

const CATEGORY_BASE: Record<string, number> = {
  Sports: 68,
  Festival: 72,
  Marathon: 70,
  Concert: 62,
  'Fair & Expo': 58,
  Conference: 42,
  Theater: 38,
  Cultural: 34,
  Community: 28,
}

const BIG_VENUE_RE = /stadyum|stadium|arena|açıkhava|acikhava|amfi|meydan|millet bahçesi|park|kongre merkezi|fuar/i
const BIG_EVENT_RE =
  /festival|maraton|koşusu|kosusu|zafer bayramı|cumhuriyet bayramı|şenlik|konseri?\b|miting|yürüyüş|yuruyus/i

export interface RealEventAnalysis {
  impactScore: number
  parkingImpact: ImpactLevel
  scooterDemand: ImpactLevel
}

export function analyzeRealEvent(e: RealEventInput): RealEventAnalysis {
  let score = CATEGORY_BASE[e.category] ?? 30

  if (e.venue && BIG_VENUE_RE.test(e.venue)) score += 10
  if (BIG_EVENT_RE.test(e.title)) score += 8
  if (e.sourceCount > 1) score += 6

  if (e.startTime) {
    const d = new Date(e.startTime)
    const day = d.getDay()
    const hour = d.getHours()
    if (day === 0 || day === 6) score += 5
    if (hour >= 18 && hour <= 22) score += 4
  }

  score = Math.max(5, Math.min(100, Math.round(score)))

  const level = scoreToLevel(score)
  const carHeavy = e.category === 'Sports' || e.category === 'Fair & Expo'
  const microHeavy = e.category === 'Festival' || e.category === 'Marathon' || e.category === 'Concert'

  const bump = (l: ImpactLevel, up: boolean): ImpactLevel => {
    const order: ImpactLevel[] = ['low', 'medium', 'high', 'critical']
    const i = order.indexOf(l)
    return order[Math.max(0, Math.min(order.length - 1, i + (up ? 1 : 0)))]
  }

  return {
    impactScore: score,
    parkingImpact: bump(level, carHeavy),
    scooterDemand: bump(level, microHeavy),
  }
}

export const recommendedAction = (e: CityEvent, service: ServiceType): string => {
  const level = service === 'parking' ? e.parkingImpact : e.scooterDemand
  const hasTime = e.startTime !== '—'
  const where = e.venue !== UNAVAILABLE ? e.venue : null
  if (service === 'scooter') {
    switch (level) {
      case 'critical':
        return where
          ? `${where} yakınına ${hasTime ? `${e.startTime} itibarıyla` : ''} ek filo gönderin; etkinlik sonrası dengeleme ekibi atayın.`
          : `Kaynak yer yayımlamamış; ${e.city} genelinde ${hasTime ? `${e.startTime} itibarıyla` : ''} ek filo hazırlayın.`
      case 'high':
        return `Scooterları ${hasTime ? `${e.startTime} saatinde 60–90 dk önce` : 'etkinlikten önce'} ${where ? `${where} çevresine` : 'şehir içinde'} kaydırın.`
      case 'medium':
        return '800 m içindeki müsaitliği izleyin; doluluk %70’i geçerse takviye edin.'
      default:
        return 'Aksiyon gerekmez; standart dağıtım yeterli.'
    }
  }
  switch (level) {
    case 'critical':
      return where
        ? `Etkinlik tarifesi ve ön rezervasyonu açın; ${where} yakınında yedek lot kullanın.`
        : `Etkinlik tarifesi ve ön rezervasyonu açın; kaynak yer yayımlamamış, ${e.city} genelinde yedek kapasite hazırlayın.`
    case 'high':
      return `Kadroyu artırın ve dinamik tarifeyi ${hasTime ? `${e.startTime} itibarıyla` : ''} etkinleştirin.`
    case 'medium':
      return 'Doluluğu izleyin; standart kadro yeterli.'
    default:
      return 'Aksiyon gerekmez.'
  }
}
