import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import { loadOrganization } from "../lib/data";
import { generate } from "../lib/scheduler";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const pool = db();
  const org = randomUUID(), role = randomUUID(), worker = randomUUID(), shift = randomUUID();
  try {
    await pool.query("INSERT INTO organizations(id,name,timezone) VALUES($1,$2,$3)", [org,"آزمون موقت شیفت‌یار","Asia/Tehran"]);
    await pool.query("INSERT INTO scheduling_rules(organization_id) VALUES($1)", [org]);
    await pool.query("INSERT INTO roles(id,organization_id,name) VALUES($1,$2,$3)", [role,org,"اپراتور"]);
    await pool.query("INSERT INTO workers(id,organization_id,name) VALUES($1,$2,$3)", [worker,org,"کارمند آزمایشی"]);
    await pool.query("INSERT INTO worker_roles(worker_id,role_id) VALUES($1,$2)", [worker,role]);
    await pool.query("INSERT INTO shift_templates(id,organization_id,name,start_time,end_time) VALUES($1,$2,$3,$4,$5)", [shift,org,"صبح","07:00","15:00"]);
    await pool.query("INSERT INTO coverage(id,organization_id,shift_id,role_id,weekday,required_count) VALUES($1,$2,$3,$4,1,1)", [randomUUID(),org,shift,role]);
    const data = await loadOrganization(org,"Asia/Tehran","2026-09-26");
    assert.equal(data.workers.length, 1);
    assert.equal(data.coverage.length, 1);
    const roster = generate(data);
    assert.equal(roster.assignments.length, 1);
    assert.equal(roster.uncovered.length, 0);
    console.log("Database mapping and schedule generation passed.");
  } finally {
    await pool.query("DELETE FROM organizations WHERE id=$1", [org]);
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
