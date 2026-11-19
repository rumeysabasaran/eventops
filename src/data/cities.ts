import type { City } from '../types'

export const CITIES: City[] = [
  { id: 'bursa', name: 'Bursa', services: ['parking', 'scooter'], lat: 40.1885, lng: 29.061, population: '3.2M' },
  { id: 'antalya', name: 'Antalya', services: ['scooter'], lat: 36.8969, lng: 30.7133, population: '2.7M' },
  { id: 'samsun', name: 'Samsun', services: ['parking'], lat: 41.2867, lng: 36.33, population: '1.4M' },
  { id: 'balikesir', name: 'Balıkesir', services: ['scooter'], lat: 39.6484, lng: 27.8826, population: '1.3M' },
  { id: 'mugla', name: 'Muğla', services: ['parking'], lat: 37.2153, lng: 28.3636, population: '1.0M' },
  { id: 'ordu', name: 'Ordu', services: ['parking'], lat: 40.9839, lng: 37.8764, population: '775K' },
  { id: 'kutahya', name: 'Kütahya', services: ['scooter'], lat: 39.4167, lng: 29.9833, population: '580K' },
  { id: 'zonguldak', name: 'Zonguldak', services: ['parking'], lat: 41.4564, lng: 31.7987, population: '590K' },
  { id: 'nevsehir', name: 'Nevşehir', services: ['scooter'], lat: 38.6244, lng: 34.7144, population: '310K' },
  { id: 'yalova', name: 'Yalova', services: ['scooter'], lat: 40.655, lng: 29.2769, population: '300K' },
]

export const cityByName = (name: string): City | undefined =>
  CITIES.find((c) => c.name === name)

export const PARKING_CITIES = CITIES.filter((c) => c.services.includes('parking')).map((c) => c.name)
export const SCOOTER_CITIES = CITIES.filter((c) => c.services.includes('scooter')).map((c) => c.name)
