import { useMemo, useState } from 'react'
import { Activity, CheckCircle2, XCircle, Timer } from 'lucide-react'
import { useData } from '../context/DataContext'
import { timeAgo } from '../lib/format'
import { PageHeader, KpiCard, StatusDot } from '../components/ui'

type StatusFilter = 'all' | 'success' | 'partial' | 'failed'

export default function ScraperMonitoring() {
  const { runs: SCRAPER_RUNS, sources: DATA_SOURCES } = useData()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [source, setSource] = useState('all')

  const runs = useMemo(
    () =>
      [...SCRAPER_RUNS]
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .filter((r) => (status === 'all' || r.status === status) && (source === 'all' || r.sourceId === source)),
    [SCRAPER_RUNS, status, source],
  )

  const succeeded = SCRAPER_RUNS.filter((r) => r.status === 'success').length
  const failed = SCRAPER_RUNS.filter((r) => r.status === 'failed').length
  const avgDuration =
    SCRAPER_RUNS.length > 0 ? Math.round(SCRAPER_RUNS.reduce((s, r) => s + r.durationSec, 0) / SCRAPER_RUNS.length) : 0
  const successRate = SCRAPER_RUNS.length > 0 ? Math.round((succeeded / SCRAPER_RUNS.length) * 100) : 0

  return (
    <div>
      <PageHeader
        title="Tarayıcı & Veri Hattı İzleme"
        subtitle="Sistem çalışma kayıtları ve anlık veri akış performansı"
        actions={
          <div className="flex items-center gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="select-corp">
              <option value="all">Tüm Durumlar</option>
              <option value="success">Başarılı</option>
              <option value="partial">Kısmi</option>
              <option value="failed">Başarısız</option>
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="select-corp">
              <option value="all">Tüm Kaynaklar</option>
              {DATA_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="mx-auto max-w-[1440px] px-6 py-4 space-y-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Toplam Görev" value={String(SCRAPER_RUNS.length)} hint="Bağdaştırıcı döngüsü" icon={<Activity size={16} />} />
          <KpiCard label="Başarı Oranı" value={`%${successRate}`} hint={`${succeeded} sorunsuz tamamlandı`} accent="#0d9488" icon={<CheckCircle2 size={16} />} />
          <KpiCard label="Hata / Uyarı" value={String(failed)} hint="Otomatik tekrar devrede" accent="#d97706" icon={<XCircle size={16} />} />
          <KpiCard label="Ortalama Süre" value={`${avgDuration}s`} hint="Görev başına işlem" icon={<Timer size={16} />} />
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-surface-secondary/70">
                  <th className="label-xs px-4 py-2.5">İşlem ID</th>
                  <th className="label-xs px-3 py-2.5">Kaynak Adı</th>
                  <th className="label-xs px-3 py-2.5">Zaman</th>
                  <th className="label-xs px-3 py-2.5 text-right">Süre</th>
                  <th className="label-xs px-3 py-2.5 text-right">Bulunan</th>
                  <th className="label-xs px-3 py-2.5 text-right">Yeni</th>
                  <th className="label-xs px-3 py-2.5 text-right">Güncellenen</th>
                  <th className="label-xs px-3 py-2.5">Durum</th>
                  <th className="label-xs px-4 py-2.5">Sistem Günlüğü</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-bg/20 transition-colors">
                    <td className="px-4 py-2 font-mono text-[11px] text-text-muted">{r.id}</td>
                    <td className="px-3 py-2 text-[12px] font-bold text-corp">{r.sourceName}</td>
                    <td className="px-3 py-2 text-[11.5px] text-text-secondary">{timeAgo(r.startedAt)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[11.5px] tabular-nums text-corp">{r.durationSec}s</td>
                    <td className="px-3 py-2 text-right font-mono text-[11.5px] tabular-nums text-corp">{r.eventsFound}</td>
                    <td className={`px-3 py-2 text-right font-mono text-[11.5px] font-bold tabular-nums ${r.newEvents > 0 ? 'text-brand' : 'text-text-light'}`}>
                      {r.newEvents > 0 ? `+${r.newEvents}` : '0'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11.5px] tabular-nums text-text-muted">{r.updatedEvents}</td>
                    <td className="px-3 py-2">
                      <StatusDot status={r.status} />
                    </td>
                    <td className="max-w-md px-4 py-2 text-[11.5px] leading-relaxed text-text-secondary">{r.message}</td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[12.5px] text-text-muted">
                      Filtre kriterlerine uygun çalışma kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
