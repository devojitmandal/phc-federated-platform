import type { AlertSeverity, StockoutRisk } from '@/types/database'

const severityStyles: Record<AlertSeverity, string> = {
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
}

const riskStyles: Record<StockoutRisk, string> = {
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-yellow-50 text-yellow-700',
  high: 'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
}

interface BadgeProps {
  label: string
  variant?: AlertSeverity | StockoutRisk | 'default'
}

export default function Badge({ label, variant = 'default' }: BadgeProps) {
  const style =
    variant in severityStyles
      ? severityStyles[variant as AlertSeverity]
      : variant in riskStyles
        ? riskStyles[variant as StockoutRisk]
        : 'bg-slate-100 text-slate-700'

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}

export function daysOfSupplyBadge(days: number | null, threshold = 7) {
  if (days === null) return { label: 'No data', variant: 'default' as const }
  if (days <= 3) return { label: `${days}d supply`, variant: 'critical' as const }
  if (days <= threshold) return { label: `${days}d supply`, variant: 'high' as const }
  return { label: `${days}d supply`, variant: 'low' as const }
}
