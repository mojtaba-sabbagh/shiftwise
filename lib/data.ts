import { db } from "@/lib/db";
import type { Coverage, Input, Role, RotationPattern, Rules, Shift, TimeOff, Worker } from "@/lib/scheduler";

export type OrganizationData = Input & {
  workerRecords: (Worker & { email: string; active: boolean })[];
  coverageRecords: (Coverage & { roleName: string; shiftName: string })[];
  rotationPatterns: (RotationPattern & { roleName: string })[];
  timeOffRecords: (TimeOff & { id: string; workerName: string; reason: string })[];
  lastRun: {
    id: string; weekStart: string; status: string; requiredCount: number; assignedCount: number; createdAt: string;
    algorithm: string; evaluations: number | null; seed: number | null;
    diagnostics: { positionId: string; message: string }[];
    assignments: { workerId: string; workerName: string; roleId: string; roleName: string; color: string;
      shiftId: string; shiftName: string; date: string; startsAt: string; endsAt: string }[];
  } | null;
};

export async function loadOrganization(organizationId: string, timezone: string, weekStart: string): Promise<OrganizationData> {
  const pool = db();
  const [roleRows, workerRows, shiftRows, coverageRows, leaveRows, rulesRows, runRows, patternRows] = await Promise.all([
    pool.query("SELECT id,name,color FROM roles WHERE organization_id=$1 ORDER BY name", [organizationId]),
    pool.query(`SELECT w.id,w.name,w.email,w.active,COALESCE(array_agg(wr.role_id) FILTER (WHERE wr.role_id IS NOT NULL),'{}') AS role_ids
      FROM workers w LEFT JOIN worker_roles wr ON wr.worker_id=w.id WHERE w.organization_id=$1 GROUP BY w.id ORDER BY w.name`, [organizationId]),
    pool.query("SELECT id,name,start_time::text,end_time::text,active FROM shift_templates WHERE organization_id=$1 ORDER BY start_time", [organizationId]),
    pool.query(`SELECT c.id,c.weekday,c.required_count,c.shift_id,c.role_id,r.name AS role_name,s.name AS shift_name
      FROM coverage c JOIN roles r ON r.id=c.role_id JOIN shift_templates s ON s.id=c.shift_id
      WHERE c.organization_id=$1 ORDER BY c.weekday,s.start_time,r.name`, [organizationId]),
    pool.query(`SELECT t.id,t.worker_id,w.name AS worker_name,t.starts_at,t.ends_at,t.reason
      FROM time_off t JOIN workers w ON w.id=t.worker_id WHERE t.organization_id=$1
      ORDER BY t.starts_at`, [organizationId]),
    pool.query("SELECT * FROM scheduling_rules WHERE organization_id=$1", [organizationId]),
    pool.query("SELECT * FROM schedule_runs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 1", [organizationId]),
    pool.query(`SELECT p.id,p.role_id,r.name AS role_name,p.name,p.weight,p.steps
      FROM rotation_patterns p JOIN roles r ON r.id=p.role_id
      WHERE p.organization_id=$1 ORDER BY r.name,p.name`, [organizationId]),
  ]);
  const roles: Role[] = roleRows.rows.map(r => ({ id: r.id, name: r.name, color: r.color }));
  const workerRecords = workerRows.rows.map(w => ({ id: w.id, name: w.name, email: w.email || "", active: w.active, roleIds: w.role_ids as string[] }));
  const shifts: Shift[] = shiftRows.rows.filter(s => s.active).map(s => ({ id: s.id, name: s.name, startTime: s.start_time, endTime: s.end_time }));
  const coverageRecords = coverageRows.rows.map(c => ({ id: c.id, weekday: c.weekday, count: c.required_count, shiftId: c.shift_id, roleId: c.role_id, roleName: c.role_name, shiftName: c.shift_name }));
  const timeOffRecords = leaveRows.rows.map(t => ({ id: t.id, workerId: t.worker_id, workerName: t.worker_name,
    startsAt: t.starts_at.toISOString(), endsAt: t.ends_at.toISOString(), reason: t.reason }));
  const rotationPatterns: (RotationPattern & { roleName: string })[] = patternRows.rows.map(p => ({
    id: p.id, roleId: p.role_id, roleName: p.role_name, name: p.name, weight: p.weight,
    steps: Array.isArray(p.steps) ? (p.steps as string[]) : [],
  }));
  const raw = rulesRows.rows[0];
  const rules: Rules = { minRestHours: raw.min_rest_hours, maxWeeklyHours: raw.max_weekly_hours,
    maxConsecutiveDays: raw.max_consecutive_days, maxNightShifts: raw.max_night_shifts, nightStartHour: raw.night_start_hour };
  let lastRun: OrganizationData["lastRun"] = null;
  if (runRows.rowCount) {
    const run = runRows.rows[0];
    const saved = await pool.query(`SELECT a.worker_id,w.name AS worker_name,a.role_id,r.name AS role_name,r.color,
      a.shift_id,s.name AS shift_name,a.shift_date::text AS date,a.starts_at,a.ends_at
      FROM schedule_assignments a JOIN workers w ON w.id=a.worker_id JOIN roles r ON r.id=a.role_id
      JOIN shift_templates s ON s.id=a.shift_id WHERE a.run_id=$1 ORDER BY a.starts_at,r.name`, [run.id]);
    lastRun = { id: run.id, weekStart: typeof run.week_start === "string" ? run.week_start : run.week_start.toISOString().slice(0, 10),
      status: run.status, requiredCount: run.required_count, assignedCount: run.assigned_count,
      algorithm: run.algorithm, evaluations: run.evaluation_count, seed: run.seed,
      createdAt: run.created_at.toISOString(), diagnostics: run.diagnostics,
      assignments: saved.rows.map(a => ({ workerId: a.worker_id, workerName: a.worker_name, roleId: a.role_id,
        roleName: a.role_name, color: a.color, shiftId: a.shift_id, shiftName: a.shift_name, date: a.date,
        startsAt: a.starts_at.toISOString(), endsAt: a.ends_at.toISOString() })) };
  }
  return { weekStart, timezone, roles, workers: workerRecords.filter(w => w.active), workerRecords,
    shifts, coverage: coverageRecords.filter(c => shifts.some(s => s.id === c.shiftId)), coverageRecords,
    timeOff: timeOffRecords, timeOffRecords, rules, patterns: rotationPatterns, rotationPatterns, lastRun };
}
