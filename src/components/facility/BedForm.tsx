import { FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'

interface BedFormProps {
  bedCapacity: number
  loading: boolean
  latest: { total_beds: number; occupied_beds: number } | null
  onSubmit: (totalBeds: number, occupiedBeds: number) => Promise<void>
}

export default function BedForm({ bedCapacity, loading, latest, onSubmit }: BedFormProps) {
  const { t } = useTranslation()
  const [totalBeds, setTotalBeds] = useState(String(bedCapacity))
  const [occupiedBeds, setOccupiedBeds] = useState('0')
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

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
      setMessage({ text: t('Occupied beds cannot exceed total beds.'), isError: true })
      return
    }
    
    try {
      await onSubmit(total, occupied)
      setMessage({ text: t('Bed status updated.'), isError: false })
    } catch (err) {
      setMessage({ 
        text: err instanceof Error ? err.message : t('Failed to update beds'), 
        isError: true 
      })
    }
  }

  const available = Number(totalBeds) - Number(occupiedBeds)
  const pct = Number(totalBeds) > 0 ? Math.round((Number(occupiedBeds) / Number(totalBeds)) * 100) : 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">{t('Total beds')}</label>
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
          <label className="mb-1 block text-sm font-medium">{t('Occupied beds')}</label>
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
        <span className="font-medium">{available}</span> {t('available')} ·{' '}
        <span className={pct > 80 ? 'text-amber-600 font-medium' : ''}>{pct}{t('% occupancy')}</span>
      </div>
      
      {message && (
        <p className={`text-sm ${message.isError ? 'text-red-600' : 'text-emerald-600'}`}>
          {message.text}
        </p>
      )}
      
      <Button type="submit" disabled={loading}>
        {loading ? t('Saving…') : t('Update bed status')}
      </Button>
    </form>
  )
}