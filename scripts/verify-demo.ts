import { existsSync } from "node:fs";
import { DateTime } from "luxon";
import { db } from "../lib/db";
import { loadOrganization } from "../lib/data";
import { generateWithCpSat } from "../lib/cp-sat";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const name = process.argv[2];
  if (!name) throw new Error('Usage: npm run seed:verify -- "کارخانه نمونه"');
  const pool = db();
  try {
    const organizations = await pool.query<{ id: string; timezone: string }>("SELECT id,timezone FROM organizations WHERE name=$1", [name]);
    if (organizations.rowCount !== 1) throw new Error("Select an existing, unambiguous organization.");
    const org = organizations.rows[0];
    const today = DateTime.now().setZone(org.timezone);
    const weekStart = today.plus({ days: (6 - today.weekday + 7) % 7 }).toISODate()!;
    const input = await loadOrganization(org.id, org.timezone, weekStart);
    const result = await generateWithCpSat(input, 20260929);
    console.log(JSON.stringify({ organization: name, weekStart, positions: result.positions.length,
      assigned: result.assignments.length, uncovered: result.uncovered.length, algorithm: result.algorithm }, null, 2));
    if (result.uncovered.length) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
