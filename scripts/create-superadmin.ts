import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { db } from "../lib/db";
import { hashPassword } from "../lib/auth";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const name = (process.env.SUPERADMIN_NAME || "").trim();
  const email = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || "";
  if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || password.length > 256) {
    throw new Error("Set SUPERADMIN_NAME, SUPERADMIN_EMAIL and a unique SUPERADMIN_PASSWORD of at least 12 characters for this command.");
  }
  try {
    const result = await db().query("INSERT INTO superadmins(id,name,email,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id",
      [randomUUID(), name, email, await hashPassword(password)]);
    if (!result.rowCount) throw new Error("This superadmin email already exists. No password was changed.");
    console.log("Superadmin created. Sign in at /admin/login.");
  } finally {
    await db().end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
