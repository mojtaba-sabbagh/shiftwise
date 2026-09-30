import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const migrations = (await readdir(resolve("db"))).filter(file => /^\d+_.*\.sql$/.test(file)).sort();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const file of migrations) await pool.query(await readFile(resolve("db", file), "utf8"));
    console.log("Database schema ready.");
  } finally {
    await pool.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
