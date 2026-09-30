ALTER TABLE schedule_runs ADD COLUMN IF NOT EXISTS algorithm text NOT NULL DEFAULT 'CP-SAT';
ALTER TABLE schedule_runs ADD COLUMN IF NOT EXISTS evaluation_count integer;
ALTER TABLE schedule_runs ADD COLUMN IF NOT EXISTS seed integer;
ALTER TABLE schedule_runs ALTER COLUMN algorithm SET DEFAULT 'CP-SAT';
