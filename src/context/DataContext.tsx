/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CityEvent, DataSource, ScraperRun } from '../types'
import { fetchEvents, fetchSources, fetchRuns, IS_DEMO } from '../api/client'
import { isUpcomingStart } from '../lib/format'

interface DataContextValue {
  events: CityEvent[]
  sources: DataSource[]
  runs: ScraperRun[]
  loading: boolean
  error: string | null
  refresh: () => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<CityEvent[]>([])
  const [sources, setSources] = useState<DataSource[]>([])
  const [runs, setRuns] = useState<ScraperRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchEvents(), fetchSources(), fetchRuns()])
      .then(([e, s, r]) => {
        if (cancelled) return
        setEvents(e.filter((ev) => isUpcomingStart(ev.date)))
        setSources(s)
        setRuns(r)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setEvents([])
        setSources([])
        setRuns([])
        setError(
          IS_DEMO
            ? `Demo verisi yüklenemedi (${err.message}).`
            : `API’ye ulaşılamıyor (${err.message}). Arka ucu başlatın: npm run server`,
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  useEffect(() => {
    if (IS_DEMO) return
    const id = window.setInterval(() => {
      Promise.all([fetchEvents(), fetchSources(), fetchRuns()])
        .then(([e, s, r]) => {
          setEvents(e.filter((ev) => isUpcomingStart(ev.date)))
          setSources(s)
          setRuns(r)
          setError(null)
        })
        .catch(() => {
          /* keep last successful snapshot; banner only on initial load */
        })
    }, 120_000)
    return () => window.clearInterval(id)
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({
      events,
      sources,
      runs,
      loading,
      error,
      refresh: () => setReloadKey((k) => k + 1),
    }),
    [events, sources, runs, loading, error],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData, DataProvider içinde kullanılmalıdır')
  return ctx
}
