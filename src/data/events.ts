import type { CityEvent } from '../types'

/** Mock event dataset retired. The UI loads only verified events from the API. */
export const EVENTS: CityEvent[] = []
export const eventById = (): CityEvent | undefined => undefined
