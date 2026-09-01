import { useCallback, useState } from 'react'
import { refreshRollups } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import type {
  Alert,
  DistrictAttendanceRollup,
  DistrictBedRollup,
  DistrictInventoryRollup,
  Forecast,
  RedistributionRecommendation,
} from '@/types/database'

export function useRollups(districtId: string | null) {
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)

  const recalculate = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await refreshRollups(districtId ?? undefined)
      setLastRefreshed(result?.snapshot_date ?? new Date().toISOString().slice(0, 10))
    } finally {
      setRefreshing(false)
    }
  }, [districtId])

  const fetchDistrictInventory = useCallback(async () => {
    if (!districtId) return [] as DistrictInventoryRollup[]
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('district_inventory_rollup')
      .select('*, medicines(name_en, name_hi, code, unit, reorder_threshold_days)')
      .eq('district_id', districtId)
      .eq('snapshot_date', today)
      .order('days_of_supply', { ascending: true, nullsFirst: false })
    if (error) throw error
    return (data ?? []) as DistrictInventoryRollup[]
  }, [districtId])

  const fetchDistrictBeds = useCallback(async () => {
    if (!districtId) return null as DistrictBedRollup | null
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('district_bed_rollup')
      .select('*')
      .eq('district_id', districtId)
      .eq('snapshot_date', today)
      .maybeSingle()
    return data as DistrictBedRollup | null
  }, [districtId])

  const fetchDistrictAttendance = useCallback(async () => {
    if (!districtId) return null as DistrictAttendanceRollup | null
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('district_attendance_rollup')
      .select('*')
      .eq('district_id', districtId)
      .eq('snapshot_date', today)
      .maybeSingle()
    return data as DistrictAttendanceRollup | null
  }, [districtId])

  return {
    recalculate,
    refreshing,
    lastRefreshed,
    fetchDistrictInventory,
    fetchDistrictBeds,
    fetchDistrictAttendance,
  }
}

export function useStateRollups(stateId: string | null) {
  const fetchStateInventory = useCallback(async () => {
    if (!stateId) return []
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('state_inventory_rollup')
      .select('*, medicines(name_en, name_hi, code)')
      .eq('state_id', stateId)
      .eq('snapshot_date', today)
      .order('days_of_supply', { ascending: true, nullsFirst: false })
    return data ?? []
  }, [stateId])

  const fetchDistricts = useCallback(async () => {
    if (!stateId) return []
    const { data } = await supabase.from('districts').select('*').eq('state_id', stateId)
    return data ?? []
  }, [stateId])

  const fetchForecasts = useCallback(async () => {
    if (!stateId) return [] as Forecast[]
    const { data } = await supabase
      .from('forecasts')
      .select('*, medicines(name_en, name_hi, code)')
      .eq('scope', 'district')
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as Forecast[]
  }, [stateId])

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as Alert[]
  }, [])

  const fetchRecommendations = useCallback(async () => {
    const { data } = await supabase
      .from('redistribution_recommendations')
      .select('*, medicines(name_en, code), from_district:districts!from_district_id(name_en), to_district:districts!to_district_id(name_en)')
      .eq('status', 'suggested')
      .order('created_at', { ascending: false })
    return (data ?? []) as RedistributionRecommendation[]
  }, [])

  return { fetchStateInventory, fetchDistricts, fetchForecasts, fetchAlerts, fetchRecommendations }
}

export function useNationalRollups() {
  const fetchNationalInventory = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('national_inventory_rollup')
      .select('*, medicines(name_en, name_hi, code)')
      .eq('snapshot_date', today)
      .order('days_of_supply', { ascending: true, nullsFirst: false })
    return data ?? []
  }, [])

  const fetchNationalBeds = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('national_bed_rollup')
      .select('*')
      .eq('snapshot_date', today)
      .maybeSingle()
    return data
  }, [])

  const fetchStates = useCallback(async () => {
    const { data } = await supabase.from('states').select('*')
    return data ?? []
  }, [])

  const fetchDistrictRiskGrid = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('district_inventory_rollup')
      .select('district_id, days_of_supply, districts(name_en, name_hi, state_id)')
      .eq('snapshot_date', today)
      .not('days_of_supply', 'is', null)
      .order('days_of_supply', { ascending: true })
  
    if (!data) return []
  
    // Keep only the worst (lowest days_of_supply) row per district
    const worstPerDistrict = new Map<string, (typeof data)[number]>()
    for (const row of data) {
      if (!worstPerDistrict.has(row.district_id)) {
        worstPerDistrict.set(row.district_id, row)
      }
    }
    return Array.from(worstPerDistrict.values())
  }, [])

  return { fetchNationalInventory, fetchNationalBeds, fetchStates, fetchDistrictRiskGrid }
}
