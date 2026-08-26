// src/components/facility/StockForm.tsx
import { FormEvent, useState } from 'react'
import Button from '@/components/ui/Button'
import type { Medicine } from '@/types/database'

interface StockFormProps {
  medicines: Medicine[]
  loading: boolean
  onSubmit: (medicineId: string, quantity: number, unit: string, batchExpiry?: string) => Promise<void>
}

export function StockForm({ medicines, loading, onSubmit }: StockFormProps) {
  const [medicineId, setMedicineId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [batchExpiry, setBatchExpiry] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  function handleMedicineChange(id: string) {
    setMedicineId(id)
    const selected = medicines.find((m) => m.id === id)
    if (selected) setUnit(selected.unit)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (!medicineId || !quantity) {
      setMessage('Select a medicine and enter a quantity.')
      return
    }

    try {
      await onSubmit(medicineId, Number(quantity), unit, batchExpiry || undefined)
      setMessage('Stock updated.')
      setMedicineId('')
      setQuantity('')
      setUnit('')
      setBatchExpiry('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update stock')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Medicine</label>
        <select
          value={medicineId}
          onChange={(e) => handleMedicineChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        >
          <option value="">Select medicine</option>
          {medicines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name_en} ({m.name_hi})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Quantity</label>
          <input
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Unit</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>
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

      {message && (
        <p className={`text-sm ${message.includes('updated') ? 'text-emerald-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Save stock update'}
      </Button>
    </form>
  )
}