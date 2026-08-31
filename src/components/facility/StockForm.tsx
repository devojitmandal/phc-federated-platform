import { FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import type { Medicine } from '@/types/database'

interface StockFormProps {
  medicines: Medicine[]
  loading: boolean
  onSubmit: (medicineId: string, quantity: number, unit: string, batchExpiry?: string) => Promise<void>
}

export function StockForm({ medicines, loading, onSubmit }: StockFormProps) {
  const { t } = useTranslation()
  const [medicineId, setMedicineId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [batchExpiry, setBatchExpiry] = useState('')
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  function handleMedicineChange(id: string) {
    setMedicineId(id)
    const selected = medicines.find((m) => m.id === id)
    if (selected) setUnit(selected.unit)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (!medicineId || !quantity) {
      setMessage({ text: t('Select a medicine and enter a quantity.'), isError: true })
      return
    }

    try {
      await onSubmit(medicineId, Number(quantity), unit, batchExpiry || undefined)
      setMessage({ text: t('Stock updated.'), isError: false })
      setMedicineId('')
      setQuantity('')
      setUnit('')
      setBatchExpiry('')
    } catch (err) {
      setMessage({ 
        text: err instanceof Error ? err.message : t('Failed to update stock'), 
        isError: true 
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">{t('Medicine')}</label>
        <select
          value={medicineId}
          onChange={(e) => handleMedicineChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        >
          <option value="">{t('Select medicine')}</option>
          {medicines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name_en} ({m.name_hi})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">{t('Quantity')}</label>
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
          <label className="mb-1 block text-sm font-medium">{t('Unit')}</label>
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
        <label className="mb-1 block text-sm font-medium">{t('Batch expiry (optional)')}</label>
        <input
          type="date"
          value={batchExpiry}
          onChange={(e) => setBatchExpiry(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {message && (
        <p className={`text-sm ${message.isError ? 'text-red-600' : 'text-emerald-600'}`}>
          {message.text}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? t('Saving…') : t('Save stock update')}
      </Button>
    </form>
  )
}