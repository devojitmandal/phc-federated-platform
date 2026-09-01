import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Medicine } from '@/types/database'

export function useMedicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('medicines')
      .select('*')
      .order('name_en')
      .then(({ data, error }) => {
        if (!error && data) setMedicines(data)
        setLoading(false)
      })
  }, [])

  return { medicines, loading }
}

export function useInventory(facilityId: string | null) {
  const [loading, setLoading] = useState(false)
  const [recentStock, setRecentStock] = useState<Array<InventorySnapshotWithMedicine>>([])

  const fetchRecent = useCallback(async () => {
    if (!facilityId) return
    const { data } = await supabase
      .from('inventory_snapshots')
      .select('*, medicines(name_en, name_hi, code, unit)')
      .eq('facility_id', facilityId)
      .order('recorded_at', { ascending: false })
      .limit(20)
    if (data) setRecentStock(data as InventorySnapshotWithMedicine[])
  }, [facilityId])

  useEffect(() => {
    void fetchRecent()
  }, [fetchRecent])

  const logStock = useCallback(
    async (medicineId: string, quantity: number, unit: string, batchExpiry?: string) => {
      if (!facilityId) throw new Error('No facility assigned')
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('inventory_snapshots').insert({
          facility_id: facilityId,
          medicine_id: medicineId,
          quantity,
          unit,
          batch_expiry: batchExpiry || null,
          source: 'manual',
          recorded_by: user?.id,
        })
        if (error) throw error
        await fetchRecent()
      } finally {
        setLoading(false)
      }
    },
    [facilityId, fetchRecent],
  )

  return { logStock, loading, recentStock, refresh: fetchRecent }
}

interface InventorySnapshotWithMedicine {
  id: string
  quantity: number
  unit: string
  recorded_at: string
  source: string
  medicines: { name_en: string; name_hi: string; code: string; unit: string }
}

export function useBedStatus(facilityId: string | null) {
  const [loading, setLoading] = useState(false)
  const [latest, setLatest] = useState<{ total_beds: number; occupied_beds: number; recorded_at: string } | null>(null)

  const fetchLatest = useCallback(async () => {
    if (!facilityId) return
    const { data } = await supabase
      .from('bed_status')
      .select('total_beds, occupied_beds, recorded_at')
      .eq('facility_id', facilityId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) setLatest(data)
  }, [facilityId])

  useEffect(() => {
    void fetchLatest()
  }, [fetchLatest])

  const logBedStatus = useCallback(
    async (totalBeds: number, occupiedBeds: number) => {
      if (!facilityId) throw new Error('No facility assigned')
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('bed_status').insert({
          facility_id: facilityId,
          total_beds: totalBeds,
          occupied_beds: occupiedBeds,
          recorded_by: user?.id,
        })
        if (error) throw error
        await fetchLatest()
      } finally {
        setLoading(false)
      }
    },
    [facilityId, fetchLatest],
  )

  return { logBedStatus, loading, latest, refresh: fetchLatest }
}

export function useAttendance(facilityId: string | null) {
  const [staff, setStaff] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!facilityId) return
    supabase
      .from('staff')
      .select('id, name, role')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setStaff(data)
      })
  }, [facilityId])

  const logAttendance = useCallback(
    async (records: Array<{ staffId: string; status: 'present' | 'absent' | 'on_leave' }>) => {
      if (!facilityId) throw new Error('No facility assigned')
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        
        const upsertPayload = records.map((record) => ({
          facility_id: facilityId,
          staff_id: record.staffId,
          log_date: today,
          status: record.status,
          recorded_by: user?.id,
        }))

        // Send all rows in one single database call
        const { error } = await supabase.from('attendance_logs').upsert(
          upsertPayload,
          { onConflict: 'facility_id,staff_id,log_date' },
        )
        if (error) throw error
      } finally {
        setLoading(false)
      }
    },
    [facilityId, today],
  )

  return { staff, logAttendance, loading }
}