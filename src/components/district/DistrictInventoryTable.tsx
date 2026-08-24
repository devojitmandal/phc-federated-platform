import Badge, { daysOfSupplyBadge } from '@/components/ui/Badge'
import type { DistrictInventoryRollup } from '@/types/database'

interface DistrictInventoryTableProps {
  rows: DistrictInventoryRollup[]
  loading?: boolean
}

export default function DistrictInventoryTable({ rows, loading }: DistrictInventoryTableProps) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading rollup data…</p>
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No rollup data yet. Log stock at PHCs, then click &quot;Recalculate rollups&quot;.
      </p>
    )
  }

  const lowStock = rows.filter(
    (r) => r.days_of_supply !== null && r.days_of_supply < (r.medicines?.reorder_threshold_days ?? 7),
  )

  return (
    <div>
      {lowStock.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {lowStock.length} medicine(s) below reorder threshold — early warning active.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="pb-2 pr-4">Medicine</th>
              <th className="pb-2 pr-4">Total qty</th>
              <th className="pb-2 pr-4">PHCs reporting</th>
              <th className="pb-2 pr-4">Avg daily use</th>
              <th className="pb-2">Days of supply</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const badge = daysOfSupplyBadge(row.days_of_supply, row.medicines?.reorder_threshold_days)
              return (
                <tr key={row.medicine_id} className="border-b border-slate-50">
                  <td className="py-2 pr-4">
                    <div>{row.medicines?.name_en ?? row.medicine_id}</div>
                    <div className="text-xs text-slate-500">{row.medicines?.name_hi}</div>
                  </td>
                  <td className="py-2 pr-4">
                    {Number(row.total_quantity).toLocaleString('en-IN')} {row.medicines?.unit}
                  </td>
                  <td className="py-2 pr-4">{row.facility_count}</td>
                  <td className="py-2 pr-4">{Number(row.avg_daily_consumption).toFixed(1)}</td>
                  <td className="py-2">
                    <Badge label={badge.label} variant={badge.variant} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
