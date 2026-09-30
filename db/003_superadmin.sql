CREATE TABLE IF NOT EXISTS superadmins (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS superadmin_sessions (
  token_hash text PRIMARY KEY,
  superadmin_id uuid NOT NULL REFERENCES superadmins(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS superadmin_sessions_admin_idx ON superadmin_sessions(superadmin_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
