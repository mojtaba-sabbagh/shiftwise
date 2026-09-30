import { existsSync } from "node:fs";
import { db } from "../lib/db";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const pool = db();
  try {
    const result = await pool.query(`SELECT DISTINCT o.id FROM organizations o JOIN users u ON u.organization_id=o.id
      WHERE o.name LIKE 'آزمون موقت %' AND u.email LIKE 'smoke-%@example.invalid'`);
    for (const { id } of result.rows) {
      await pool.query("DELETE FROM schedule_runs WHERE organization_id=$1", [id]);
      await pool.query("DELETE FROM organizations WHERE id=$1", [id]);
    }
    console.log(`Removed ${result.rowCount} temporary smoke-test organization(s).`);
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
