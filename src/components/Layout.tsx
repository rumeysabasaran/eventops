import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Map,
  Menu,
  Radar,
  SquareParking,
  X,
  Zap,
  Database,
  Activity,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { IS_DEMO } from '../api/client'
import { now } from '../lib/clock'

const NAV = [
  { to: '/', label: 'Genel bakış', icon: LayoutDashboard, end: true },
  { to: '/events', label: 'Etkinlikler', icon: CalendarDays },
  { to: '/city-report', label: 'Şehir raporu', icon: Building2 },
  { to: '/map', label: 'Harita', icon: Map },
  { to: '/parking-opportunities', label: 'Otopark planı', icon: SquareParking },
  { to: '/scooter-opportunities', label: 'Scooter planı', icon: Zap },
  { to: '/data-sources', label: 'Veri kaynakları', icon: Database },
  { to: '/scraper-monitoring', label: 'Çalışma kayıtları', icon: Activity },
]

const SECTIONS: Array<[string, number, number]> = [
  ['Planlama', 0, 4],
  ['Operasyon', 4, 6],
  ['Veri', 6, 8],
]

function BrandMark() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#10b981] text-white shadow-md shadow-emerald-950/40">
      <Radar size={19} />
    </div>
  )
}

export default function Layout() {
  const { events, loading, error, refresh } = useData()
  const location = useLocation()
  const isMap = location.pathname === '/map'
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f8fafc]">
      {menuOpen && (
        <button
          aria-label="Menüyü kapat"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-[1190] bg-slate-950/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[1200] flex w-60 shrink-0 flex-col border-r border-slate-800 bg-[#0f172a] text-slate-300 transition-transform duration-200 lg:static lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-slate-800/80 px-5 py-4">
          <BrandMark />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-bold leading-tight tracking-tight text-white">EventOps</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#10b981] lg:whitespace-nowrap">Etkinlik bazlı operasyon</div>
          </div>
          <button aria-label="Menüyü kapat" onClick={() => setMenuOpen(false)} className="text-slate-400 lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {SECTIONS.map(([title, from, to]) => (
            <div key={title}>
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</div>
              <div className="space-y-1">
                {NAV.slice(from, to).map(({ to: path, label, icon: Icon, end }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-[#10b981] font-semibold text-white shadow-sm shadow-emerald-900/30'
                          : 'text-[#94a3b8] hover:bg-slate-800/70 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={16} className="shrink-0 opacity-90" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-800 bg-[#0b1120] px-4 py-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              {IS_DEMO ? `Veri: ${now().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Sistem Aktif'}
            </span>
            <span className="font-mono text-[10.5px] font-semibold text-slate-300">{events.length} Etkinlik</span>
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f8fafc]">
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-slate-800 bg-[#0f172a] px-3 text-white lg:hidden">
          <button aria-label="Menüyü aç" onClick={() => setMenuOpen(true)} className="rounded-md p-1.5 hover:bg-slate-800">
            <Menu size={19} />
          </button>
          <Radar size={17} className="text-[#10b981]" />
          <span className="text-[13px] font-bold tracking-tight">EventOps</span>
        </div>
        {error && (
          <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-6 py-2 text-[12px] text-amber-900">
            <span>{error}</span>
            <button
              onClick={refresh}
              className="shrink-0 rounded border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold hover:bg-amber-100"
            >
              Yeniden dene
            </button>
          </div>
        )}
        {loading && (
          <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-1.5 text-[11.5px] font-medium text-emerald-800">
            Etkinlikler yükleniyor…
          </div>
        )}
        <div className={`min-h-0 flex-1 ${isMap ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
