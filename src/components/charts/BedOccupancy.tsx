import type { DistrictBedRollup } from '@/types/database'

interface BedOccupancyBarProps {
  data: DistrictBedRollup | null
}

export default function BedOccupancyBar({ data }: BedOccupancyBarProps) {
  if (!data) {
    return <p className="text-sm text-slate-500">No bed rollup data available.</p>
  }

  const pct = Number(data.occupancy_pct)

  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>
          {data.occupied_beds} / {data.total_beds} beds occupied
        </span>
        <span className={pct > 80 ? 'font-medium text-amber-600' : 'text-slate-600'}>{pct}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {data.available_beds} available · {data.reporting_facility_count} PHCs reporting
      </p>
    </div>
  )
}
