import { FormEvent, useEffect, useState } from 'react'
import Button from '@/components/ui/Button'

interface BedFormProps {
  bedCapacity: number
  loading: boolean
  latest: { total_beds: number; occupied_beds: number } | null
  onSubmit: (totalBeds: number, occupiedBeds: number) => Promise<void>
}

export default function BedForm({ bedCapacity, loading, latest, onSubmit }: BedFormProps) {
  const [totalBeds, setTotalBeds] = useState(String(bedCapacity))
  const [occupiedBeds, setOccupiedBeds] = useState('0')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (latest) {
      setTotalBeds(String(latest.total_beds))
      setOccupiedBeds(String(latest.occupied_beds))
    } else {
      setTotalBeds(String(bedCapacity))
    }
  }, [latest, bedCapacity])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const total = Number(totalBeds)
    const occupied = Number(occupiedBeds)
    if (occupied > total) {
      setMessage('Occupied beds cannot exceed total beds.')
      return
    }
    try {
      await onSubmit(total, occupied)
      setMessage('Bed status updated.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update beds')
    }
  }

  const available = Number(totalBeds) - Number(occupiedBeds)
  const pct = Number(totalBeds) > 0 ? Math.round((Number(occupiedBeds) / Number(totalBeds)) * 100) : 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Total beds</label>
          <input
            type="number"
            min="0"
            value={totalBeds}
            onChange={(e) => setTotalBeds(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Occupied beds</label>
          <input
            type="number"
            min="0"
            max={totalBeds}
            value={occupiedBeds}
            onChange={(e) => setOccupiedBeds(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <span className="font-medium">{available}</span> available ·{' '}
        <span className={pct > 80 ? 'text-amber-600 font-medium' : ''}>{pct}% occupancy</span>
      </div>
      {message && (
        <p className={`text-sm ${message.includes('updated') ? 'text-emerald-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Update bed status'}
      </Button>
    </form>
  )
}
