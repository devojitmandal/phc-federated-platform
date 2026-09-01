import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'

interface AttendanceFormProps {
  staff: Array<{ id: string; name: string; role: string }>
  loading: boolean
  onSubmit: (records: Array<{ staffId: string; status: 'present' | 'absent' | 'on_leave' }>) => Promise<void>
}

export default function AttendanceForm({ staff, loading, onSubmit }: AttendanceFormProps) {
  const { t } = useTranslation()
  const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent' | 'on_leave'>>({})
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSaveAll() {
    setSaving(true)
    setMessage(null)
    try {
      const payload = staff.map((member) => ({
        staffId: member.id,
        status: statuses[member.id] ?? 'present',
      }))
      
      // Fire the single database request
      await onSubmit(payload)
      
      setMessage({ text: t('Attendance saved for all staff.'), isError: false })
    } catch (err) {
      setMessage({ 
        text: err instanceof Error ? err.message : t('Failed to save attendance'), 
        isError: true 
      })
    } finally {
      setSaving(false)
    }
  }

  if (staff.length === 0) {
    return <p className="text-sm text-slate-500">{t('No staff roster found for this facility.')}</p>
  }

  return (
    <div className="space-y-3">
      {staff.map((member) => (
        <div key={member.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
          <div>
            <p className="text-sm font-medium">{member.name}</p>
            <p className="text-xs text-slate-500">{member.role}</p>
          </div>
          <select
            value={statuses[member.id] ?? 'present'}
            onChange={(e) =>
              setStatuses((s) => ({
                ...s,
                [member.id]: e.target.value as 'present' | 'absent' | 'on_leave',
              }))
            }
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="present">{t('Present')}</option>
            <option value="absent">{t('Absent')}</option>
            <option value="on_leave">{t('On leave')}</option>
          </select>
        </div>
      ))}
      {message && (
        <p className={`text-sm ${message.isError ? 'text-red-600' : 'text-emerald-600'}`}>
          {message.text}
        </p>
      )}
      <Button onClick={() => void handleSaveAll()} disabled={loading || saving}>
        {saving ? t('Saving…') : t('Save attendance')}
      </Button>
    </div>
  )
}