-- Soft rotation preferences: for a given role the representative defines an
-- ordered cycle of shift templates (plus the token "off" for a rest day).
-- These are applied by the solver only after coverage and balance are fixed,
-- so they never trade away a hard constraint or a covered position.
CREATE TABLE IF NOT EXISTS rotation_patterns (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  name text NOT NULL,
  weight smallint NOT NULL DEFAULT 1 CHECK(weight BETWEEN 1 AND 10),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, role_id, name)
);
CREATE INDEX IF NOT EXISTS rotation_patterns_org_idx ON rotation_patterns(organization_id, role_id);
