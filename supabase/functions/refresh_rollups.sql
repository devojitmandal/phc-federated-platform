-- Reference copy of refresh_rollups logic (canonical version lives in 001_initial_schema.sql)
-- Primary path: manual RPC call from UI ("Recalculate rollups" button)
-- Secondary path: insert triggers on inventory_snapshots, bed_status, attendance_logs

SELECT public.refresh_rollups(NULL);
