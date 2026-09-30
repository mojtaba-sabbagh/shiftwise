import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { DateTime } from "luxon";
import { db, transaction } from "../lib/db";

// All names and staffing requirements here are synthetic demonstration data.
const roles = [
  { key: "operator", name: "اپراتور تولید", color: "#39a66d", workers: [
    "نازنین احمدی", "علی رضایی", "مریم محمدی", "امیرحسین کریمی",
    "سارا حسینی", "محمدمهدی عباسی", "الهام مرادی", "رضا جعفری",
    "فاطمه صادقی", "پویا اکبری", "نیلوفر رستمی", "حسین قاسمی",
  ] },
  { key: "technician", name: "تکنسین نگهداری", color: "#5c8db8", workers: [
    "احسان نوری", "نگار محمودی", "مسعود براتی",
    "پریسا قربانی", "حمید سلطانی", "زهره کاظمی",
  ] },
  { key: "supervisor", name: "سرپرست شیفت", color: "#ae8b53", workers: [
    "بهرام شریفی", "لیلا زمانی", "فرهاد حیدری",
    "مهسا رفیعی", "کیوان امینی", "الهه موسوی",
  ] },
] as const;
const shifts = [
  { key: "morning", name: "صبح", start: "06:00", end: "14:00", operators: 2 },
  { key: "evening", name: "عصر", start: "14:00", end: "22:00", operators: 2 },
  { key: "night", name: "شب", start: "22:00", end: "06:00", operators: 1 },
] as const;

function stableId(organizationId: string, key: string) {
  const bytes = createHash("sha256").update(`shiftwise-demo-v1:${organizationId}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function target() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || !["--organization", "--org-id"].includes(args[0]) || !args[1]?.trim()) {
    throw new Error('Usage: npm run seed:demo -- --organization "کارخانه نمونه" (or --org-id <uuid>)');
  }
  if (args[0] === "--org-id" && !/^[a-f0-9-]{36}$/i.test(args[1])) throw new Error("Invalid organization ID.");
  return { byId: args[0] === "--org-id", value: args[1].trim() };
}

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const selected = target();
  const pool = db();
  try {
    const matches = await pool.query<{ id: string; name: string; timezone: string }>(
      `SELECT id,name,timezone FROM organizations WHERE ${selected.byId ? "id=$1" : "name=$1"}`, [selected.value]);
    if (matches.rowCount !== 1) throw new Error(matches.rowCount ? "Several organizations have this name; use --org-id." : "Organization not found; create it in the superadmin panel first.");
    const org = matches.rows[0];
    const summary = await transaction(async client => {
      await client.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [org.id]);
      const before = await client.query(`SELECT
        (SELECT count(*)::int FROM roles WHERE organization_id=$1) AS roles,
        (SELECT count(*)::int FROM workers WHERE organization_id=$1) AS workers,
        (SELECT count(*)::int FROM shift_templates WHERE organization_id=$1) AS shifts,
        (SELECT count(*)::int FROM coverage WHERE organization_id=$1) AS coverage`, [org.id]);
      const roleIds = new Map<string, string>();
      for (const role of roles) {
        await client.query("INSERT INTO roles(id,organization_id,name,color) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,name) DO NOTHING",
          [stableId(org.id, `role:${role.key}`), org.id, role.name, role.color]);
        const found = await client.query<{ id: string }>("SELECT id FROM roles WHERE organization_id=$1 AND name=$2", [org.id, role.name]);
        roleIds.set(role.key, found.rows[0].id);
      }
      for (const role of roles) {
        for (const [index, name] of role.workers.entries()) {
          const workerId = stableId(org.id, `worker:${role.key}:${index}`);
          const collision = await client.query<{ id: string }>("SELECT id FROM workers WHERE organization_id=$1 AND name=$2 AND id<>$3", [org.id, name, workerId]);
          if (collision.rowCount) throw new Error(`Worker name «${name}» already exists in this organization; no data was changed.`);
          await client.query("INSERT INTO workers(id,organization_id,name) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING", [workerId, org.id, name]);
          await client.query("INSERT INTO worker_roles(worker_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [workerId, roleIds.get(role.key)]);
        }
      }
      for (const shift of shifts) {
        await client.query(`INSERT INTO shift_templates(id,organization_id,name,start_time,end_time)
          VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,name) DO NOTHING`,
          [stableId(org.id, `shift:${shift.key}`), org.id, shift.name, shift.start, shift.end]);
        const found = await client.query<{ id: string; start_time: string; end_time: string }>(
          "SELECT id,start_time::text,end_time::text FROM shift_templates WHERE organization_id=$1 AND name=$2", [org.id, shift.name]);
        if (found.rows[0].start_time.slice(0, 5) !== shift.start || found.rows[0].end_time.slice(0, 5) !== shift.end) {
          throw new Error(`Shift «${shift.name}» has different hours; no data was changed.`);
        }
        for (let weekday = 1; weekday <= 7; weekday++) {
          for (const role of roles) {
            const required = role.key === "operator" ? shift.operators : 1;
            await client.query(`INSERT INTO coverage(id,organization_id,shift_id,role_id,weekday,required_count)
              VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organization_id,shift_id,role_id,weekday) DO NOTHING`,
              [stableId(org.id, `coverage:${shift.key}:${role.key}:${weekday}`), org.id, found.rows[0].id, roleIds.get(role.key), weekday, required]);
          }
        }
      }
      await client.query("INSERT INTO scheduling_rules(organization_id) VALUES($1) ON CONFLICT DO NOTHING", [org.id]);
      const after = await client.query(`SELECT
        (SELECT count(*)::int FROM roles WHERE organization_id=$1) AS roles,
        (SELECT count(*)::int FROM workers WHERE organization_id=$1) AS workers,
        (SELECT count(*)::int FROM shift_templates WHERE organization_id=$1) AS shifts,
        (SELECT count(*)::int FROM coverage WHERE organization_id=$1) AS coverage`, [org.id]);
      return { before: before.rows[0], after: after.rows[0] };
    });
    const now = DateTime.now().setZone(org.timezone);
    const nextSaturday = now.plus({ days: (6 - now.weekday + 7) % 7 }).toISODate();
    console.log(JSON.stringify({ organization: org.name, ...summary, suggestedWeekStart: nextSaturday }, null, 2));
  } finally {
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
