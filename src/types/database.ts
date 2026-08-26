export type UserRole =
  | 'facility_worker'
  | 'district_admin'
  | 'state_viewer'
  | 'national_admin'

export type DataSource = 'manual' | 'voice'
export type AttendanceStatus = 'present' | 'absent' | 'on_leave'
export type StockoutRisk = 'low' | 'medium' | 'high' | 'critical'
export type ForecastScope = 'district' | 'state' | 'national'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type RecommendationStatus = 'suggested' | 'approved' | 'dismissed'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  facility_id: string | null
  district_id: string | null
  state_id: string | null
}

export interface State {
  id: string
  code: string
  name_en: string
  name_hi: string
}

export interface District {
  id: string
  state_id: string
  code: string
  name_en: string
  name_hi: string
  population: number
}

export interface Facility {
  id: string
  district_id: string
  code: string
  name_en: string
  name_hi: string | null
  facility_type: string
  bed_capacity: number
  population_served: number
}

export interface Medicine {
  id: string
  code: string
  name_en: string
  name_hi: string
  unit: string
  category: string
  reorder_threshold_days: number
}

export interface Staff {
  id: string
  facility_id: string
  name: string
  role: string
  is_active: boolean
}

export interface InventorySnapshot {
  id: string
  facility_id: string
  medicine_id: string
  quantity: number
  unit: string
  batch_expiry: string | null
  recorded_at: string
  source: DataSource
  recorded_by: string | null
}

export interface BedStatus {
  id: string
  facility_id: string
  total_beds: number
  occupied_beds: number
  recorded_at: string
}

export interface AttendanceLog {
  id: string
  facility_id: string
  staff_id: string
  log_date: string
  status: AttendanceStatus
}

export interface DistrictInventoryRollup {
  district_id: string
  medicine_id: string
  snapshot_date: string
  total_quantity: number
  facility_count: number
  avg_daily_consumption: number
  days_of_supply: number | null
  medicines?: Medicine
}

export interface DistrictBedRollup {
  district_id: string
  snapshot_date: string
  total_beds: number
  occupied_beds: number
  available_beds: number
  occupancy_pct: number
  reporting_facility_count: number
}

export interface DistrictAttendanceRollup {
  district_id: string
  snapshot_date: string
  staff_present: number
  staff_absent: number
  attendance_pct: number
  reporting_facility_count: number
}

export interface Forecast {
  id: string
  scope: ForecastScope
  scope_id: string | null
  medicine_id: string
  forecast_date: string
  horizon_days: number
  predicted_consumption: number | null
  stockout_risk: StockoutRisk
  days_until_stockout: number | null
  gemini_narrative_en: string | null
  gemini_narrative_hi: string | null
  medicines?: Medicine
}

export interface Alert {
  id: string
  scope: ForecastScope
  scope_id: string | null
  alert_type: string
  severity: AlertSeverity
  title_en: string
  title_hi: string
  body_en: string
  body_hi: string
  related_medicine_id: string | null
  is_acknowledged: boolean
  created_at: string
}

export interface RedistributionRecommendation {
  id: string
  medicine_id: string
  from_district_id: string
  to_district_id: string
  suggested_quantity: number
  reason_en: string
  reason_hi: string
  status: RecommendationStatus
  created_at: string
  medicines?: Medicine
  from_district?: District
  to_district?: District
}

export interface VoiceSession {
  id: string
  facility_id: string
  user_id: string
  audio_transcript_hi: string | null
  parsed_json: Record<string, unknown> | null
  confirmation_text_hi: string | null
  status: string
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string; role: UserRole }; Update: Partial<Profile>; Relationships: [] }
      states: { Row: State; Insert: Partial<State>; Update: Partial<State>; Relationships: [] }
      districts: { Row: District; Insert: Partial<District>; Update: Partial<District>; Relationships: [] }
      facilities: { Row: Facility; Insert: Partial<Facility>; Update: Partial<Facility>; Relationships: [] }
      medicines: { Row: Medicine; Insert: Partial<Medicine>; Update: Partial<Medicine>; Relationships: [] }
      staff: { Row: Staff; Insert: Partial<Staff>; Update: Partial<Staff>; Relationships: [] }
      inventory_snapshots: { Row: InventorySnapshot; Insert: Partial<InventorySnapshot>; Update: Partial<InventorySnapshot>; Relationships: [] }
      bed_status: { Row: BedStatus; Insert: Partial<BedStatus>; Update: Partial<BedStatus>; Relationships: [] }
      attendance_logs: { Row: AttendanceLog; Insert: Partial<AttendanceLog>; Update: Partial<AttendanceLog>; Relationships: [] }
      district_inventory_rollup: { Row: DistrictInventoryRollup; Insert: Partial<DistrictInventoryRollup>; Update: Partial<DistrictInventoryRollup>; Relationships: [] }
      district_bed_rollup: { Row: DistrictBedRollup; Insert: Partial<DistrictBedRollup>; Update: Partial<DistrictBedRollup>; Relationships: [] }
      district_attendance_rollup: { Row: DistrictAttendanceRollup; Insert: Partial<DistrictAttendanceRollup>; Update: Partial<DistrictAttendanceRollup>; Relationships: [] }
      forecasts: { Row: Forecast; Insert: Partial<Forecast>; Update: Partial<Forecast>; Relationships: [] }
      alerts: { Row: Alert; Insert: Partial<Alert>; Update: Partial<Alert>; Relationships: [] }
      redistribution_recommendations: { Row: RedistributionRecommendation; Insert: Partial<RedistributionRecommendation>; Update: Partial<RedistributionRecommendation>; Relationships: [] }
      voice_sessions: { Row: VoiceSession; Insert: Partial<VoiceSession>; Update: Partial<VoiceSession>; Relationships: [] }
    }
    Views: {}
    Functions: {
      refresh_rollups: {
        Args: { p_district_id?: string | null }
        Returns: { districts_refreshed: string[]; snapshot_date: string }
      }
    }
    Enums: {
      user_role: UserRole
      data_source: DataSource
      attendance_status: AttendanceStatus
      stockout_risk: StockoutRisk
    }
    CompositeTypes: {}
  }
}