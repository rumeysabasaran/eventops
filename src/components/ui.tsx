import type { ReactNode } from 'react'
import type { ImpactLevel } from '../types'
import { LEVEL_LABEL, LEVEL_COLOR, scoreToLevel } from '../lib/impact'

export const CHART_TOOLTIP = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 12,
  color: '#0f172a',
  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
}

export const CHART_GRID = '#f1f5f9'
export const CHART_AXIS = '#64748b'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-[#e2e8f0] bg-white">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold tracking-tight text-[#0f172a]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[12px] text-[#64748b] sm:truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

const BADGE_STYLE: Record<ImpactLevel, string> = {
  low: 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]',
  medium: 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]',
  high: 'bg-[#ecfdf5] text-[#047857] border-[#6ee7b7] font-semibold',
  critical: 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0] font-bold',
}

export function ImpactBadge({ level, prefix }: { level: ImpactLevel; prefix?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-badge border px-2 py-0.5 text-[11px] ${BADGE_STYLE[level]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL_COLOR[level] }} />
      {prefix ? `${prefix} ` : ''}
      {LEVEL_LABEL[level]}
    </span>
  )
}

export function ScorePill({ score }: { score: number }) {
  const level = scoreToLevel(score)
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className="font-mono text-[12.5px] font-bold tabular-nums"
        style={{ color: LEVEL_COLOR[level] }}
      >
        {score}
      </span>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-[#f1f5f9]">
        <span
          className="block h-full rounded-full transition-all duration-300"
          style={{ width: `${score}%`, background: LEVEL_COLOR[level] }}
        />
      </span>
    </div>
  )
}

export function ScoreRing({ score, size = 68 }: { score: number; size?: number }) {
  const level = scoreToLevel(score)
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={LEVEL_COLOR[level]}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[15px] font-bold tabular-nums text-[#0f172a]">{score}</span>
        <span className="text-[8.5px] font-semibold uppercase tracking-wider text-[#94a3b8]">/100</span>
      </div>
    </div>
  )
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon: ReactNode
  accent?: string
  delay?: number
}) {
  return (
    <div className="card p-4 hover:border-slate-300">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748b]">{label}</span>
        {/* Nötr açık gri (#F1F5F9) zemin üzerinde koyu gri (#334155) minimalist ikon */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#334155]">
          {icon}
        </div>
      </div>
      <div className="mt-2 text-[24px] font-bold leading-none tracking-tight tabular-nums text-[#0f172a]">{value}</div>
      {hint && (
        <div className="mt-2 text-[11.5px] font-medium text-[#64748b]">
          {hint}
        </div>
      )}
    </div>
  )
}

export function StatusDot({
  status,
}: {
  status: 'active' | 'inactive' | 'error' | 'success' | 'partial' | 'failed' | 'running' | 'blocked' | 'disabled'
}) {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: '#10b981', label: 'Aktif' },
    success: { color: '#10b981', label: 'Başarılı' },
    running: { color: '#065f46', label: 'Çalışıyor' },
    partial: { color: '#64748b', label: 'Kısmi' },
    inactive: { color: '#94a3b8', label: 'Pasif' },
    disabled: { color: '#94a3b8', label: 'Kapalı' },
    blocked: { color: '#64748b', label: 'Engelli' },
    error: { color: '#e11d48', label: 'Hata' },
    failed: { color: '#e11d48', label: 'Başarısız' },
  }
  const { color, label } = map[status] ?? map.inactive
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-[13.5px] font-semibold text-[#0f172a]">{title}</div>
      {hint && <div className="mt-1 text-[12px] text-[#64748b]">{hint}</div>}
    </div>
  )
}
