-- PHC Federated Platform — initial schema
-- Hierarchy: facility → district → state → national
-- Week 1 RLS priority: facility_worker + district_admin (airtight)
-- State/national RLS: stretch goal (permissive read policies below)

-- ---------------------------------------------------------------------------
-- Extensions & enums
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM (
  'facility_worker',
  'district_admin',
  'state_viewer',
  'national_admin'
);

CREATE TYPE data_source AS ENUM ('manual', 'voice');

CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'on_leave');

CREATE TYPE forecast_scope AS ENUM ('district', 'state', 'national');

CREATE TYPE stockout_risk AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE alert_type AS ENUM ('stockout', 'low_stock', 'bed_capacity', 'attendance');

CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

CREATE TYPE recommendation_status AS ENUM ('suggested', 'approved', 'dismissed');

CREATE TYPE voice_session_status AS ENUM ('transcribed', 'confirmed', 'applied', 'failed');

-- ---------------------------------------------------------------------------
-- Reference / hierarchy
-- ---------------------------------------------------------------------------

CREATE TABLE states (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  name_en    TEXT NOT NULL,
  name_hi    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE districts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id   UUID NOT NULL REFERENCES states (id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  name_en    TEXT NOT NULL,
  name_hi    TEXT NOT NULL,
  population INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE facilities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id        UUID NOT NULL REFERENCES districts (id) ON DELETE CASCADE,
  code               TEXT NOT NULL UNIQUE,
  name_en            TEXT NOT NULL,
  name_hi            TEXT,
  facility_type      TEXT NOT NULL DEFAULT 'PHC',
  bed_capacity       INT NOT NULL DEFAULT 6,
  population_served  INT NOT NULL,
  lat                NUMERIC(9, 6),
  lng                NUMERIC(9, 6),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT facilities_population_served_positive CHECK (population_served > 0)
);

CREATE TABLE medicines (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   TEXT NOT NULL UNIQUE,
  name_en                TEXT NOT NULL,
  name_hi                TEXT NOT NULL,
  unit                   TEXT NOT NULL DEFAULT 'tablets',
  category               TEXT NOT NULL,
  reorder_threshold_days INT NOT NULL DEFAULT 7,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  full_name   TEXT,
  facility_id UUID REFERENCES facilities (id) ON DELETE SET NULL,
  district_id UUID REFERENCES districts (id) ON DELETE SET NULL,
  state_id    UUID REFERENCES states (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_scope_check CHECK (
    (role = 'facility_worker' AND facility_id IS NOT NULL)
    OR (role = 'district_admin' AND district_id IS NOT NULL)
    OR (role = 'state_viewer' AND state_id IS NOT NULL)
    OR (role = 'national_admin')
  )
);

-- ---------------------------------------------------------------------------
-- Raw local tables (facility-scoped)
-- ---------------------------------------------------------------------------

CREATE TABLE inventory_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  UUID NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  medicine_id  UUID NOT NULL REFERENCES medicines (id) ON DELETE RESTRICT,
  quantity     NUMERIC(12, 2) NOT NULL CHECK (quantity >= 0),
  unit         TEXT NOT NULL,
  batch_expiry DATE,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source       data_source NOT NULL DEFAULT 'manual',
  recorded_by  UUID REFERENCES profiles (id) ON DELETE SET NULL
);

CREATE INDEX idx_inventory_snapshots_facility_recorded
  ON inventory_snapshots (facility_id, recorded_at DESC);

CREATE INDEX idx_inventory_snapshots_medicine
  ON inventory_snapshots (medicine_id);

CREATE TABLE bed_status (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id    UUID NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  total_beds     INT NOT NULL CHECK (total_beds >= 0),
  occupied_beds  INT NOT NULL CHECK (occupied_beds >= 0),
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by    UUID REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT bed_status_occupied_lte_total CHECK (occupied_beds <= total_beds)
);

CREATE INDEX idx_bed_status_facility_recorded
  ON bed_status (facility_id, recorded_at DESC);

CREATE TABLE attendance_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  status      attendance_status NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  UNIQUE (facility_id, staff_id, log_date)
);

CREATE INDEX idx_attendance_logs_facility_date
  ON attendance_logs (facility_id, log_date DESC);

-- ---------------------------------------------------------------------------
-- Aggregated rollup tables
-- ---------------------------------------------------------------------------

CREATE TABLE district_inventory_rollup (
  district_id           UUID NOT NULL REFERENCES districts (id) ON DELETE CASCADE,
  medicine_id           UUID NOT NULL REFERENCES medicines (id) ON DELETE CASCADE,
  snapshot_date         DATE NOT NULL,
  total_quantity        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  facility_count        INT NOT NULL DEFAULT 0,
  avg_daily_consumption NUMERIC(12, 2) NOT NULL DEFAULT 0,
  days_of_supply        NUMERIC(8, 2),
  refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (district_id, medicine_id, snapshot_date)
);

CREATE TABLE district_bed_rollup (
  district_id              UUID NOT NULL REFERENCES districts (id) ON DELETE CASCADE,
  snapshot_date            DATE NOT NULL,
  total_beds               INT NOT NULL DEFAULT 0,
  occupied_beds            INT NOT NULL DEFAULT 0,
  available_beds           INT NOT NULL DEFAULT 0,
  occupancy_pct            NUMERIC(5, 2) NOT NULL DEFAULT 0,
  reporting_facility_count INT NOT NULL DEFAULT 0,
  refreshed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (district_id, snapshot_date)
);

CREATE TABLE district_attendance_rollup (
  district_id              UUID NOT NULL REFERENCES districts (id) ON DELETE CASCADE,
  snapshot_date            DATE NOT NULL,
  staff_present            INT NOT NULL DEFAULT 0,
  staff_absent             INT NOT NULL DEFAULT 0,
  attendance_pct           NUMERIC(5, 2) NOT NULL DEFAULT 0,
  reporting_facility_count INT NOT NULL DEFAULT 0,
  refreshed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (district_id, snapshot_date)
);

CREATE TABLE state_inventory_rollup (
  state_id              UUID NOT NULL REFERENCES states (id) ON DELETE CASCADE,
  medicine_id           UUID NOT NULL REFERENCES medicines (id) ON DELETE CASCADE,
  snapshot_date         DATE NOT NULL,
  total_quantity        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  district_count        INT NOT NULL DEFAULT 0,
  avg_daily_consumption NUMERIC(12, 2) NOT NULL DEFAULT 0,
  days_of_supply        NUMERIC(8, 2),
  refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (state_id, medicine_id, snapshot_date)
);

CREATE TABLE state_bed_rollup (
  state_id                 UUID NOT NULL REFERENCES states (id) ON DELETE CASCADE,
  snapshot_date            DATE NOT NULL,
  total_beds               INT NOT NULL DEFAULT 0,
  occupied_beds            INT NOT NULL DEFAULT 0,
  available_beds           INT NOT NULL DEFAULT 0,
  occupancy_pct            NUMERIC(5, 2) NOT NULL DEFAULT 0,
  reporting_district_count INT NOT NULL DEFAULT 0,
  refreshed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (state_id, snapshot_date)
);

CREATE TABLE state_attendance_rollup (
  state_id                 UUID NOT NULL REFERENCES states (id) ON DELETE CASCADE,
  snapshot_date            DATE NOT NULL,
  staff_present            INT NOT NULL DEFAULT 0,
  staff_absent             INT NOT NULL DEFAULT 0,
  attendance_pct           NUMERIC(5, 2) NOT NULL DEFAULT 0,
  reporting_district_count INT NOT NULL DEFAULT 0,
  refreshed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (state_id, snapshot_date)
);

CREATE TABLE national_inventory_rollup (
  medicine_id           UUID NOT NULL REFERENCES medicines (id) ON DELETE CASCADE,
  snapshot_date         DATE NOT NULL,
  total_quantity        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  state_count           INT NOT NULL DEFAULT 0,
  avg_daily_consumption NUMERIC(12, 2) NOT NULL DEFAULT 0,
  days_of_supply        NUMERIC(8, 2),
  refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (medicine_id, snapshot_date)
);

CREATE TABLE national_bed_rollup (
  snapshot_date            DATE NOT NULL PRIMARY KEY,
  total_beds               INT NOT NULL DEFAULT 0,
  occupied_beds            INT NOT NULL DEFAULT 0,
  available_beds           INT NOT NULL DEFAULT 0,
  occupancy_pct            NUMERIC(5, 2) NOT NULL DEFAULT 0,
  reporting_state_count    INT NOT NULL DEFAULT 0,
  refreshed_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE national_attendance_rollup (
  snapshot_date            DATE NOT NULL PRIMARY KEY,
  staff_present            INT NOT NULL DEFAULT 0,
  staff_absent             INT NOT NULL DEFAULT 0,
  attendance_pct           NUMERIC(5, 2) NOT NULL DEFAULT 0,
  reporting_state_count    INT NOT NULL DEFAULT 0,
  refreshed_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- AI / intelligence tables
-- ---------------------------------------------------------------------------

CREATE TABLE forecasts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                 forecast_scope NOT NULL,
  scope_id              UUID,
  medicine_id           UUID NOT NULL REFERENCES medicines (id) ON DELETE CASCADE,
  forecast_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  horizon_days          INT NOT NULL DEFAULT 14,
  predicted_consumption NUMERIC(12, 2),
  stockout_risk         stockout_risk NOT NULL DEFAULT 'low',
  days_until_stockout   NUMERIC(8, 2),
  gemini_narrative_en   TEXT,
  gemini_narrative_hi   TEXT,
  model_version         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope               forecast_scope NOT NULL,
  scope_id            UUID,
  alert_type          alert_type NOT NULL,
  severity            alert_severity NOT NULL DEFAULT 'info',
  title_en            TEXT NOT NULL,
  title_hi            TEXT NOT NULL,
  body_en             TEXT NOT NULL,
  body_hi             TEXT NOT NULL,
  related_medicine_id UUID REFERENCES medicines (id) ON DELETE SET NULL,
  is_acknowledged     BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE redistribution_recommendations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id        UUID NOT NULL REFERENCES medicines (id) ON DELETE CASCADE,
  from_district_id   UUID NOT NULL REFERENCES districts (id) ON DELETE CASCADE,
  to_district_id     UUID NOT NULL REFERENCES districts (id) ON DELETE CASCADE,
  suggested_quantity NUMERIC(12, 2) NOT NULL CHECK (suggested_quantity > 0),
  reason_en          TEXT NOT NULL,
  reason_hi          TEXT NOT NULL,
  status             recommendation_status NOT NULL DEFAULT 'suggested',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT redistribution_distinct_districts CHECK (from_district_id <> to_district_id)
);

CREATE TABLE voice_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id         UUID NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  audio_transcript_hi TEXT,
  parsed_json         JSONB,
  confirmation_text_hi TEXT,
  status              voice_session_status NOT NULL DEFAULT 'transcribed',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Auth helper functions (security definer for RLS)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_facility_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT facility_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_district_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT district_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_state_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT state_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.facility_in_user_district(p_facility_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM facilities f
    WHERE f.id = p_facility_id
      AND f.district_id = public.current_user_district_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- Rollup refresh (primary path: manual RPC from UI)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_rollups(p_district_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_date DATE := CURRENT_DATE;
  v_district_ids UUID[];
  v_district_id UUID;
  v_state_id UUID;
  v_result JSONB := '{"districts_refreshed": [], "snapshot_date": null}'::JSONB;
BEGIN
  IF p_district_id IS NOT NULL THEN
    v_district_ids := ARRAY[p_district_id];
  ELSE
    SELECT ARRAY_AGG(id ORDER BY name_en) INTO v_district_ids FROM districts;
  END IF;

  FOREACH v_district_id IN ARRAY v_district_ids
  LOOP
    INSERT INTO district_inventory_rollup (
      district_id, medicine_id, snapshot_date,
      total_quantity, facility_count, avg_daily_consumption, days_of_supply, refreshed_at
    )
    SELECT
      v_district_id,
      m.id,
      v_snapshot_date,
      COALESCE(SUM(latest.quantity), 0),
      COUNT(DISTINCT latest.facility_id),
      COALESCE(consumption.avg_daily, 0),
      CASE
        WHEN COALESCE(consumption.avg_daily, 0) > 0
        THEN ROUND(COALESCE(SUM(latest.quantity), 0) / consumption.avg_daily, 2)
        ELSE NULL
      END,
      now()
    FROM medicines m
    LEFT JOIN LATERAL (
      SELECT DISTINCT ON (s.facility_id, s.medicine_id)
        s.facility_id, s.medicine_id, s.quantity
      FROM inventory_snapshots s
      JOIN facilities f ON f.id = s.facility_id
      WHERE f.district_id = v_district_id
        AND s.medicine_id = m.id
        AND s.recorded_at::date <= v_snapshot_date
      ORDER BY s.facility_id, s.medicine_id, s.recorded_at DESC
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT
        CASE
          WHEN COUNT(*) >= 2 THEN
            ABS(MAX(s.quantity) FILTER (WHERE s.recorded_at::date = v_snapshot_date)
              - MAX(s.quantity) FILTER (WHERE s.recorded_at::date = v_snapshot_date - 7))
            / 7.0
          ELSE 0
        END AS avg_daily
      FROM inventory_snapshots s
      JOIN facilities f ON f.id = s.facility_id
      WHERE f.district_id = v_district_id
        AND s.medicine_id = m.id
        AND s.recorded_at::date >= v_snapshot_date - 7
    ) consumption ON true
    GROUP BY m.id, consumption.avg_daily
    ON CONFLICT (district_id, medicine_id, snapshot_date) DO UPDATE SET
      total_quantity = EXCLUDED.total_quantity,
      facility_count = EXCLUDED.facility_count,
      avg_daily_consumption = EXCLUDED.avg_daily_consumption,
      days_of_supply = EXCLUDED.days_of_supply,
      refreshed_at = now();

    INSERT INTO district_bed_rollup (
      district_id, snapshot_date,
      total_beds, occupied_beds, available_beds, occupancy_pct,
      reporting_facility_count, refreshed_at
    )
    SELECT
      v_district_id,
      v_snapshot_date,
      COALESCE(SUM(latest.total_beds), 0),
      COALESCE(SUM(latest.occupied_beds), 0),
      COALESCE(SUM(latest.total_beds - latest.occupied_beds), 0),
      CASE
        WHEN COALESCE(SUM(latest.total_beds), 0) > 0
        THEN ROUND(100.0 * SUM(latest.occupied_beds) / SUM(latest.total_beds), 2)
        ELSE 0
      END,
      COUNT(latest.facility_id),
      now()
    FROM (
      SELECT DISTINCT ON (b.facility_id)
        b.facility_id, b.total_beds, b.occupied_beds
      FROM bed_status b
      JOIN facilities f ON f.id = b.facility_id
      WHERE f.district_id = v_district_id
        AND b.recorded_at::date <= v_snapshot_date
      ORDER BY b.facility_id, b.recorded_at DESC
    ) latest
    ON CONFLICT (district_id, snapshot_date) DO UPDATE SET
      total_beds = EXCLUDED.total_beds,
      occupied_beds = EXCLUDED.occupied_beds,
      available_beds = EXCLUDED.available_beds,
      occupancy_pct = EXCLUDED.occupancy_pct,
      reporting_facility_count = EXCLUDED.reporting_facility_count,
      refreshed_at = now();

    INSERT INTO district_attendance_rollup (
      district_id, snapshot_date,
      staff_present, staff_absent, attendance_pct,
      reporting_facility_count, refreshed_at
    )
    SELECT
      v_district_id,
      v_snapshot_date,
      COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN a.status <> 'present' THEN 1 ELSE 0 END), 0),
      CASE
        WHEN COUNT(*) > 0
        THEN ROUND(100.0 * SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*), 2)
        ELSE 0
      END,
      COUNT(DISTINCT a.facility_id),
      now()
    FROM attendance_logs a
    JOIN facilities f ON f.id = a.facility_id
    WHERE f.district_id = v_district_id
      AND a.log_date = v_snapshot_date
    ON CONFLICT (district_id, snapshot_date) DO UPDATE SET
      staff_present = EXCLUDED.staff_present,
      staff_absent = EXCLUDED.staff_absent,
      attendance_pct = EXCLUDED.attendance_pct,
      reporting_facility_count = EXCLUDED.reporting_facility_count,
      refreshed_at = now();

    v_result := jsonb_set(
      v_result,
      '{districts_refreshed}',
      (v_result->'districts_refreshed') || to_jsonb(v_district_id::text)
    );
  END LOOP;

  FOR v_state_id IN SELECT id FROM states
  LOOP
    INSERT INTO state_inventory_rollup (
      state_id, medicine_id, snapshot_date,
      total_quantity, district_count, avg_daily_consumption, days_of_supply, refreshed_at
    )
    SELECT
      v_state_id,
      medicine_id,
      v_snapshot_date,
      SUM(total_quantity),
      COUNT(DISTINCT district_id),
      AVG(avg_daily_consumption),
      CASE
        WHEN AVG(avg_daily_consumption) > 0
        THEN ROUND(SUM(total_quantity) / AVG(avg_daily_consumption), 2)
        ELSE NULL
      END,
      now()
    FROM district_inventory_rollup dir
    JOIN districts d ON d.id = dir.district_id
    WHERE d.state_id = v_state_id
      AND dir.snapshot_date = v_snapshot_date
    GROUP BY medicine_id
    ON CONFLICT (state_id, medicine_id, snapshot_date) DO UPDATE SET
      total_quantity = EXCLUDED.total_quantity,
      district_count = EXCLUDED.district_count,
      avg_daily_consumption = EXCLUDED.avg_daily_consumption,
      days_of_supply = EXCLUDED.days_of_supply,
      refreshed_at = now();

    INSERT INTO state_bed_rollup (
      state_id, snapshot_date,
      total_beds, occupied_beds, available_beds, occupancy_pct,
      reporting_district_count, refreshed_at
    )
    SELECT
      v_state_id,
      v_snapshot_date,
      SUM(total_beds),
      SUM(occupied_beds),
      SUM(available_beds),
      CASE
        WHEN SUM(total_beds) > 0
        THEN ROUND(100.0 * SUM(occupied_beds) / SUM(total_beds), 2)
        ELSE 0
      END,
      COUNT(*),
      now()
    FROM district_bed_rollup dbr
    JOIN districts d ON d.id = dbr.district_id
    WHERE d.state_id = v_state_id
      AND dbr.snapshot_date = v_snapshot_date
    ON CONFLICT (state_id, snapshot_date) DO UPDATE SET
      total_beds = EXCLUDED.total_beds,
      occupied_beds = EXCLUDED.occupied_beds,
      available_beds = EXCLUDED.available_beds,
      occupancy_pct = EXCLUDED.occupancy_pct,
      reporting_district_count = EXCLUDED.reporting_district_count,
      refreshed_at = now();

    INSERT INTO state_attendance_rollup (
      state_id, snapshot_date,
      staff_present, staff_absent, attendance_pct,
      reporting_district_count, refreshed_at
    )
    SELECT
      v_state_id,
      v_snapshot_date,
      SUM(staff_present),
      SUM(staff_absent),
      CASE
        WHEN SUM(staff_present + staff_absent) > 0
        THEN ROUND(100.0 * SUM(staff_present) / SUM(staff_present + staff_absent), 2)
        ELSE 0
      END,
      COUNT(*),
      now()
    FROM district_attendance_rollup dar
    JOIN districts d ON d.id = dar.district_id
    WHERE d.state_id = v_state_id
      AND dar.snapshot_date = v_snapshot_date
    ON CONFLICT (state_id, snapshot_date) DO UPDATE SET
      staff_present = EXCLUDED.staff_present,
      staff_absent = EXCLUDED.staff_absent,
      attendance_pct = EXCLUDED.attendance_pct,
      reporting_district_count = EXCLUDED.reporting_district_count,
      refreshed_at = now();
  END LOOP;

  INSERT INTO national_inventory_rollup (
    medicine_id, snapshot_date,
    total_quantity, state_count, avg_daily_consumption, days_of_supply, refreshed_at
  )
  SELECT
    medicine_id,
    v_snapshot_date,
    SUM(total_quantity),
    COUNT(DISTINCT state_id),
    AVG(avg_daily_consumption),
    CASE
      WHEN AVG(avg_daily_consumption) > 0
      THEN ROUND(SUM(total_quantity) / AVG(avg_daily_consumption), 2)
      ELSE NULL
    END,
    now()
  FROM state_inventory_rollup
  WHERE snapshot_date = v_snapshot_date
  GROUP BY medicine_id
  ON CONFLICT (medicine_id, snapshot_date) DO UPDATE SET
    total_quantity = EXCLUDED.total_quantity,
    state_count = EXCLUDED.state_count,
    avg_daily_consumption = EXCLUDED.avg_daily_consumption,
    days_of_supply = EXCLUDED.days_of_supply,
    refreshed_at = now();

  INSERT INTO national_bed_rollup (
    snapshot_date, total_beds, occupied_beds, available_beds,
    occupancy_pct, reporting_state_count, refreshed_at
  )
  SELECT
    v_snapshot_date,
    SUM(total_beds),
    SUM(occupied_beds),
    SUM(available_beds),
    CASE
      WHEN SUM(total_beds) > 0
      THEN ROUND(100.0 * SUM(occupied_beds) / SUM(total_beds), 2)
      ELSE 0
    END,
    COUNT(DISTINCT state_id),
    now()
  FROM state_bed_rollup
  WHERE snapshot_date = v_snapshot_date
  ON CONFLICT (snapshot_date) DO UPDATE SET
    total_beds = EXCLUDED.total_beds,
    occupied_beds = EXCLUDED.occupied_beds,
    available_beds = EXCLUDED.available_beds,
    occupancy_pct = EXCLUDED.occupancy_pct,
    reporting_state_count = EXCLUDED.reporting_state_count,
    refreshed_at = now();

  INSERT INTO national_attendance_rollup (
    snapshot_date, staff_present, staff_absent, attendance_pct,
    reporting_state_count, refreshed_at
  )
  SELECT
    v_snapshot_date,
    SUM(staff_present),
    SUM(staff_absent),
    CASE
      WHEN SUM(staff_present + staff_absent) > 0
      THEN ROUND(100.0 * SUM(staff_present) / SUM(staff_present + staff_absent), 2)
      ELSE 0
    END,
    COUNT(DISTINCT state_id),
    now()
  FROM state_attendance_rollup
  WHERE snapshot_date = v_snapshot_date
  ON CONFLICT (snapshot_date) DO UPDATE SET
    staff_present = EXCLUDED.staff_present,
    staff_absent = EXCLUDED.staff_absent,
    attendance_pct = EXCLUDED.attendance_pct,
    reporting_state_count = EXCLUDED.reporting_state_count,
    refreshed_at = now();

  v_result := jsonb_set(v_result, '{snapshot_date}', to_jsonb(v_snapshot_date::text));
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_rollups(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Secondary path: optional insert triggers (best-effort auto-refresh)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_refresh_rollups_for_facility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_district_id UUID;
BEGIN
  SELECT district_id INTO v_district_id
  FROM facilities
  WHERE id = COALESCE(NEW.facility_id, OLD.facility_id);

  IF v_district_id IS NOT NULL THEN
    PERFORM public.refresh_rollups(v_district_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_inventory_refresh_rollups
  AFTER INSERT ON inventory_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_rollups_for_facility();

CREATE TRIGGER trg_bed_status_refresh_rollups
  AFTER INSERT ON bed_status
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_rollups_for_facility();

CREATE TRIGGER trg_attendance_refresh_rollups
  AFTER INSERT ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_rollups_for_facility();

-- ---------------------------------------------------------------------------
-- Row Level Security — Week 1 priority: facility_worker + district_admin
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_inventory_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_bed_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_attendance_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_inventory_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_bed_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_attendance_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_inventory_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_bed_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_attendance_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE redistribution_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE states ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY states_read ON states
  FOR SELECT TO authenticated USING (true);

CREATE POLICY districts_read ON districts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY medicines_read ON medicines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY facilities_worker_select ON facilities
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'facility_worker'
    AND id = public.current_user_facility_id()
  );

CREATE POLICY facilities_district_admin_select ON facilities
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'district_admin'
    AND district_id = public.current_user_district_id()
  );

CREATE POLICY facilities_elevated_select ON facilities
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('state_viewer', 'national_admin'));

CREATE POLICY staff_worker_all ON staff
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
  )
  WITH CHECK (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
  );

CREATE POLICY staff_district_admin_select ON staff
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'district_admin'
    AND public.facility_in_user_district(facility_id)
  );

CREATE POLICY inventory_worker_select ON inventory_snapshots
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
  );

CREATE POLICY inventory_worker_insert ON inventory_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
    AND recorded_by = auth.uid()
  );

CREATE POLICY inventory_worker_update ON inventory_snapshots
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
  )
  WITH CHECK (
    facility_id = public.current_user_facility_id()
    AND recorded_by = auth.uid()
  );

CREATE POLICY inventory_district_admin_select ON inventory_snapshots
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'district_admin'
    AND public.facility_in_user_district(facility_id)
  );

CREATE POLICY bed_status_worker_select ON bed_status
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
  );

CREATE POLICY bed_status_worker_insert ON bed_status
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
    AND recorded_by = auth.uid()
  );

CREATE POLICY bed_status_district_admin_select ON bed_status
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'district_admin'
    AND public.facility_in_user_district(facility_id)
  );

CREATE POLICY attendance_worker_select ON attendance_logs
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
  );

CREATE POLICY attendance_worker_insert ON attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
    AND recorded_by = auth.uid()
  );

CREATE POLICY attendance_worker_update ON attendance_logs
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
  )
  WITH CHECK (facility_id = public.current_user_facility_id());

CREATE POLICY attendance_district_admin_select ON attendance_logs
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'district_admin'
    AND public.facility_in_user_district(facility_id)
  );

CREATE POLICY district_inventory_rollup_admin ON district_inventory_rollup
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'district_admin'
    AND district_id = public.current_user_district_id()
  );

CREATE POLICY district_bed_rollup_admin ON district_bed_rollup
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'district_admin'
    AND district_id = public.current_user_district_id()
  );

CREATE POLICY district_attendance_rollup_admin ON district_attendance_rollup
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'district_admin'
    AND district_id = public.current_user_district_id()
  );

-- Stretch goal: state/national rollup read policies
CREATE POLICY state_inventory_rollup_elevated ON state_inventory_rollup
  FOR SELECT TO authenticated
  USING (
    (public.current_user_role() = 'state_viewer' AND state_id = public.current_user_state_id())
    OR public.current_user_role() = 'national_admin'
  );

CREATE POLICY state_bed_rollup_elevated ON state_bed_rollup
  FOR SELECT TO authenticated
  USING (
    (public.current_user_role() = 'state_viewer' AND state_id = public.current_user_state_id())
    OR public.current_user_role() = 'national_admin'
  );

CREATE POLICY state_attendance_rollup_elevated ON state_attendance_rollup
  FOR SELECT TO authenticated
  USING (
    (public.current_user_role() = 'state_viewer' AND state_id = public.current_user_state_id())
    OR public.current_user_role() = 'national_admin'
  );

CREATE POLICY national_inventory_rollup_admin ON national_inventory_rollup
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'national_admin');

CREATE POLICY national_bed_rollup_admin ON national_bed_rollup
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'national_admin');

CREATE POLICY national_attendance_rollup_admin ON national_attendance_rollup
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'national_admin');

CREATE POLICY forecasts_elevated_read ON forecasts
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('district_admin', 'state_viewer', 'national_admin'));

CREATE POLICY alerts_elevated_read ON alerts
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('district_admin', 'state_viewer', 'national_admin'));

CREATE POLICY redistribution_elevated_read ON redistribution_recommendations
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('district_admin', 'state_viewer', 'national_admin'));

CREATE POLICY voice_sessions_worker ON voice_sessions
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_role() = 'facility_worker'
    AND facility_id = public.current_user_facility_id()
    AND user_id = auth.uid()
  );
CREATE POLICY redistribution_elevated_update ON redistribution_recommendations
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('district_admin', 'state_viewer', 'national_admin'))
  WITH CHECK (public.current_user_role() IN ('district_admin', 'state_viewer', 'national_admin'));