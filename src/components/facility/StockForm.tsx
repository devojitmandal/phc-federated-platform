import { FormEvent, useState } from 'react'
import Button from '@/components/ui/Button'
import type { Medicine } from '@/types/database'

interface StockFormProps {
  medicines: Medicine[]
  loading: boolean
  onSubmit: (medicineId: string, quantity: number, unit: string, batchExpiry?: string) => Promise<void>
}

export default function StockForm({ medicines, loading, onSubmit }: StockFormProps) {
  const [medicineId, setMedicineId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [batchExpiry, setBatchExpiry] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const selected = medicines.find((m) => m.id === medicineId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    setMessage(null)
    try {
      await onSubmit(selected.id, Number(quantity), selected.unit, batchExpiry || undefined)
      setQuantity('')
      setBatchExpiry('')
      setMessage('Stock logged successfully.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to log stock')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Medicine</label>
        <select
          value={medicineId}
          onChange={(e) => setMedicineId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        >
          <option value="">Select medicine</option>
          {medicines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name_en} ({m.code})
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-1 text-xs text-slate-500">{selected.name_hi}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Quantity {selected ? `(${selected.unit})` : ''}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Batch expiry (optional)</label>
          <input
            type="date"
            value={batchExpiry}
            onChange={(e) => setBatchExpiry(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {message && (
        <p className={`text-sm ${message.includes('success') ? 'text-emerald-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
      <Button type="submit" disabled={loading || !medicineId}>
        {loading ? 'Saving…' : 'Log stock'}
      </Button>
    </form>
  )
}
