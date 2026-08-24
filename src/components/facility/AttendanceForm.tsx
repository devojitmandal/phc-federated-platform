import { useState } from 'react'
import Button from '@/components/ui/Button'

interface AttendanceFormProps {
  staff: Array<{ id: string; name: string; role: string }>
  loading: boolean
  onSubmit: (staffId: string, status: 'present' | 'absent' | 'on_leave') => Promise<void>
}

export default function AttendanceForm({ staff, loading, onSubmit }: AttendanceFormProps) {
  const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent' | 'on_leave'>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSaveAll() {
    setSaving(true)
    setMessage(null)
    try {
      for (const member of staff) {
        const status = statuses[member.id] ?? 'present'
        await onSubmit(member.id, status)
      }
      setMessage('Attendance saved for all staff.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  if (staff.length === 0) {
    return <p className="text-sm text-slate-500">No staff roster found for this facility.</p>
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
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="on_leave">On leave</option>
          </select>
        </div>
      ))}
      {message && (
        <p className={`text-sm ${message.includes('saved') ? 'text-emerald-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
      <Button onClick={() => void handleSaveAll()} disabled={loading || saving}>
        {saving ? 'Saving…' : 'Save attendance'}
      </Button>
    </div>
  )
}
