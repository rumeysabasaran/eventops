import type { NormalizedEvent, ValidationResult } from '../../types.js'

/**
 * Validation gate before persistence. An event must have a real title,
 * a source-provided date, and a plausible time window.
 */
export function validateEvent(e: NormalizedEvent): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!e.title || e.title.length < 3) errors.push('title missing or too short')
  if (e.title && e.title.length > 300) errors.push('title implausibly long')

  if (!e.startTime) errors.push('no source-provided date')
  else {
    const t = Date.parse(e.startTime)
    if (Number.isNaN(t)) errors.push(`unparseable start_time: ${e.startTime}`)
    else {
      const daysFromNow = (t - Date.now()) / 86_400_000
      if (daysFromNow < -400) errors.push('start_time more than 400 days in the past')
      if (daysFromNow > 500) errors.push('start_time more than 500 days in the future')
      if (daysFromNow < -1 && e.datePrecision !== 'range') warnings.push('event already in the past')
    }
  }

  if (e.endTime && e.startTime && Date.parse(e.endTime) < Date.parse(e.startTime)) {
    errors.push('end_time before start_time')
  }

  if (!e.city) errors.push('city missing')

  if (e.latitude !== null && (e.latitude < 35 || e.latitude > 43)) errors.push('latitude outside Türkiye')
  if (e.longitude !== null && (e.longitude < 25 || e.longitude > 45)) errors.push('longitude outside Türkiye')

  if (!e.eventUrl) warnings.push('no event detail URL')
  if (!e.venue) warnings.push('no venue')

  return { ok: errors.length === 0, errors, warnings }
}
