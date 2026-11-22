import { format, parseISO, formatDistanceStrict } from 'date-fns'
import { tr } from 'date-fns/locale'
import { now } from './clock'

export const formatDate = (iso: string): string => format(parseISO(iso), 'EEE d MMM', { locale: tr })
export const formatDateLong = (iso: string): string => format(parseISO(iso), 'EEEE, d MMMM yyyy', { locale: tr })

export const daysUntil = (iso: string): number => {
  const day = iso.slice(0, 10)
  const today = istanbulToday()
  const eventNoon = Date.parse(`${day}T12:00:00+03:00`)
  const todayNoon = Date.parse(`${today}T12:00:00+03:00`)
  if (Number.isNaN(eventNoon) || Number.isNaN(todayNoon)) return 0
  return Math.round((eventNoon - todayNoon) / 86_400_000)
}

export function istanbulToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now())
}

/** İstanbul takvimine göre bugünden `offset` gün sonrasının öğlesi. */
export function istanbulDay(offset: number): Date {
  return new Date(Date.parse(`${istanbulToday()}T12:00:00+03:00`) + offset * 86_400_000)
}

/** Başlangıç tarihi bugün veya sonrası (İstanbul takvimi). */
export function isUpcomingStart(date: string): boolean {
  return Boolean(date) && date.slice(0, 10) >= istanbulToday()
}

export const relativeDay = (iso: string): string => {
  const days = Math.max(0, daysUntil(iso))
  if (days === 0) return 'Bugün'
  if (days === 1) return 'Yarın'
  return `${days} gün sonra`
}

export const formatAttendance = (n: number): string => {
  if (n >= 1000) {
    const k = n / 1000
    return `${k % 1 === 0 ? k : k.toFixed(1)}B`
  }
  return n.toLocaleString('tr-TR')
}

export const formatNumber = (n: number): string => n.toLocaleString('tr-TR')

export const timeAgo = (iso: string): string =>
  `${formatDistanceStrict(parseISO(iso), now(), { locale: tr })} önce`
