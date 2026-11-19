import { Database, CheckCircle2, AlertTriangle, PlusCircle, Layers } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatNumber, timeAgo } from '../lib/format'
import { PageHeader, KpiCard, StatusDot } from '../components/ui'

export default function DataSources() {
  const { sources: DATA_SOURCES } = useData()
  const active = DATA_SOURCES.filter((s) => s.status === 'active')
  const failing = DATA_SOURCES.filter((s) => s.status === 'error' || s.status === 'blocked')
  const totalEvents = DATA_SOURCES.reduce((s, x) => s + x.eventsCollected, 0)
  const newToday = DATA_SOURCES.reduce((s, x) => s + x.newEventsLast24h, 0)

  return (
    <div>
      <PageHeader
        title="Veri Kaynakları & Entegrasyonlar"
        subtitle="Modüler şehir tarayıcı adaptörleri ve veri hattı durumu"
        actions={
          <button className="btn-primary">
            <PlusCircle size={14} /> Yeni Kaynak Bağla
          </button>
        }
      />

      <div className="mx-auto max-w-[1440px] px-6 py-4 space-y-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Bağlı Kaynaklar" value={String(DATA_SOURCES.length)} hint={`${active.length} aktif toplayıcı`} icon={<Database size={16} />} />
          <KpiCard label="Sağlıklı Hat" value={String(active.length)} hint="Kesintisiz akış" accent="#0d9488" icon={<CheckCircle2 size={16} />} />
          <KpiCard label="İnceleme Gereken" value={String(failing.length)} hint="Müdahale bekleniyor" accent="#d97706" icon={<AlertTriangle size={16} />} />
          <KpiCard label="Toplanan Veri" value={formatNumber(totalEvents)} hint={`Son 24 saatte +${newToday}`} accent="#0284c7" icon={<Layers size={16} />} />
        </div>

        <div className="grid grid-cols-1 gap-3.5 pb-6 md:grid-cols-2 xl:grid-cols-3">
          {DATA_SOURCES.map((s) => (
            <div key={s.id} className="card p-4 hover:border-brand/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-corp">{s.name}</div>
                  <div className="mt-0.5 text-[11px] text-text-muted">{s.type}</div>
                </div>
                <StatusDot status={s.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-surface-secondary px-2.5 py-2">
                  <div className="label-xs">Toplam Kayıt</div>
                  <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums text-corp">
                    {formatNumber(s.eventsCollected)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface-secondary px-2.5 py-2">
                  <div className="label-xs">Son 24 Saat</div>
                  <div className={`mt-0.5 font-mono text-[15px] font-bold tabular-nums ${s.newEventsLast24h > 0 ? 'text-brand' : 'text-text-muted'}`}>
                    {s.newEventsLast24h > 0 ? `+${s.newEventsLast24h}` : '0'}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-[11.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Son Senkronizasyon</span>
                  <span className="font-medium text-corp">
                    {s.lastRun ? timeAgo(s.lastRun) : 'Hiç'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Çalışma Periyodu</span>
                  <span className="font-medium text-corp">{s.interval}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Güvenilirlik Oranı</span>
                  <span className={`font-mono font-bold ${s.reliability >= 95 ? 'text-brand' : s.reliability >= 90 ? 'text-amber-600' : 'text-rose-600'}`}>
                    %{s.reliability.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Kapsam</span>
                  <span className="max-w-[60%] truncate text-right font-medium text-corp">
                    {s.coverage.join(', ')}
                  </span>
                </div>
              </div>

              <div className="mt-3 border-t border-border pt-2.5">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-[11.5px] font-semibold text-brand hover:underline">
                    {s.url.replace('https://', '')}
                  </a>
                ) : (
                  <span className="text-[11.5px] text-text-light">Doğrulanmış URL yok</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
