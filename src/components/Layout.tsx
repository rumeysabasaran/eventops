import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Map,
  SquareParking,
  Zap,
  Database,
  Activity,
} from 'lucide-react'
import { useData } from '../context/DataContext'

const NAV = [
  { to: '/', label: 'Gösterge paneli', icon: LayoutDashboard, end: true },
  { to: '/events', label: 'Etkinlikler', icon: CalendarDays },
  { to: '/city-intelligence', label: 'Şehir zekâsı', icon: Building2 },
  { to: '/map', label: 'Etkinlik haritası', icon: Map },
  { to: '/parking-opportunities', label: 'Otopark fırsatları', icon: SquareParking },
  { to: '/scooter-opportunities', label: 'Scooter fırsatları', icon: Zap },
  { to: '/data-sources', label: 'Veri kaynakları', icon: Database },
  { to: '/scraper-monitoring', label: 'Tarayıcı izleme', icon: Activity },
]

const SECTIONS: Array<[string, number, number]> = [
  ['Genel Bakış', 0, 4],
  ['Operasyonel Fırsatlar', 4, 6],
  ['Veri & Sistem', 6, 8],
]

export default function Layout() {
  const { events, loading, error, refresh } = useData()
  const location = useLocation()
  const isMap = location.pathname === '/map'

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      {/* Sol Menü (Sidebar): Derin antrasit/gece mavisi (#0F172A) */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-[#0f172a] text-slate-300">
        {/* Sol Üst Logo & Marka Alanı */}
        <div className="flex items-center gap-3 border-b border-slate-800/80 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#10b981] text-[12px] font-black text-white shadow-md shadow-emerald-950/40">
            EO
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13.5px] font-bold leading-tight tracking-tight text-white">
              EventOps
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#10b981]">
              Operasyon Paneli
            </div>
          </div>
        </div>

        {/* Navigasyon Sekmeleri */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {SECTIONS.map(([title, from, to]) => (
            <div key={title}>
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {title}
              </div>
              <div className="space-y-1">
                {NAV.slice(from, to).map(({ to: path, label, icon: Icon, end }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-[#10b981] text-white font-semibold shadow-sm shadow-emerald-900/30'
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

        {/* Alt Durum Çubuğu */}
        <div className="border-t border-slate-800 bg-[#0b1120] px-4 py-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              Sistem Aktif
            </span>
            <span className="font-mono text-[10.5px] font-semibold text-slate-300">
              {events.length} Etkinlik
            </span>
          </div>
        </div>
      </aside>

      {/* Ana İçerik Alanı */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fafc]">
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
            Doğrulanmış etkinlik verileri senkronize ediliyor…
          </div>
        )}
        <div className={`min-h-0 flex-1 ${isMap ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
