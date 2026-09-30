CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#467c70',
  UNIQUE(organization_id, name)
);
CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS worker_roles (
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY(worker_id, role_id)
);
CREATE TABLE IF NOT EXISTS shift_templates (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(organization_id, name),
  CHECK(start_time <> end_time)
);
CREATE TABLE IF NOT EXISTS coverage (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES shift_templates(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK(weekday BETWEEN 1 AND 7),
  required_count smallint NOT NULL CHECK(required_count BETWEEN 1 AND 50),
  UNIQUE(organization_id, shift_id, role_id, weekday)
);
CREATE TABLE IF NOT EXISTS time_off (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '',
  CHECK(starts_at < ends_at)
);
CREATE TABLE IF NOT EXISTS scheduling_rules (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  min_rest_hours smallint NOT NULL DEFAULT 11 CHECK(min_rest_hours BETWEEN 0 AND 36),
  max_weekly_hours smallint NOT NULL DEFAULT 40 CHECK(max_weekly_hours BETWEEN 1 AND 168),
  max_consecutive_days smallint NOT NULL DEFAULT 6 CHECK(max_consecutive_days BETWEEN 1 AND 7),
  max_night_shifts smallint NOT NULL DEFAULT 3 CHECK(max_night_shifts BETWEEN 0 AND 7),
  night_start_hour smallint NOT NULL DEFAULT 22 CHECK(night_start_hour BETWEEN 0 AND 23)
);
CREATE TABLE IF NOT EXISTS schedule_runs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  status text NOT NULL CHECK(status IN ('complete', 'partial')),
  required_count integer NOT NULL,
  assigned_count integer NOT NULL,
  diagnostics jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedule_runs_org_idx ON schedule_runs(organization_id, created_at DESC);
CREATE TABLE IF NOT EXISTS schedule_assignments (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES schedule_runs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id),
  role_id uuid NOT NULL REFERENCES roles(id),
  shift_id uuid NOT NULL REFERENCES shift_templates(id),
  shift_date date NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  CHECK(starts_at < ends_at)
);
CREATE INDEX IF NOT EXISTS assignments_run_idx ON schedule_assignments(run_id);
