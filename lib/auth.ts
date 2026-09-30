import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const scrypt = promisify(scryptCallback);
const cookieName = "shiftwise_session";
const adminCookieName = "shiftwise_admin_session";
const maxAge = 60 * 60 * 24 * 14;
function secret() {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return key;
}
function tokenHash(token: string) { return createHmac("sha256", secret()).update(token).digest("hex"); }
function adminTokenHash(token: string) { return createHmac("sha256", secret()).update("admin:" + token).digest("hex"); }

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected || expected.length !== 128) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '14 days')", [tokenHash(token), userId]);
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db().query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash(token)]);
  jar.delete(cookieName);
}
export async function createAdminSession(adminId: string) {
  const token = randomBytes(32).toString("base64url");
  await db().query("INSERT INTO superadmin_sessions(token_hash,superadmin_id,expires_at) VALUES ($1,$2,now()+interval '14 days')", [adminTokenHash(token), adminId]);
  (await cookies()).set(adminCookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
}
export async function endAdminSession() {
  const jar = await cookies();
  const token = jar.get(adminCookieName)?.value;
  if (token) await db().query("DELETE FROM superadmin_sessions WHERE token_hash=$1", [adminTokenHash(token)]);
  jar.delete(adminCookieName);
}
export async function currentAdmin(): Promise<{ id: string; name: string; email: string } | null> {
  const token = (await cookies()).get(adminCookieName)?.value;
  if (!token) return null;
  const result = await db().query(`SELECT a.id,a.name,a.email FROM superadmin_sessions s
    JOIN superadmins a ON a.id=s.superadmin_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [adminTokenHash(token)]);
  return result.rowCount ? result.rows[0] : null;
}
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
export async function currentUser(): Promise<{ id: string; name: string; organizationId: string; organizationName: string; timezone: string; mustChangePassword: boolean } | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const result = await db().query(`SELECT u.id, u.name, u.organization_id,
    COALESCE((to_jsonb(u)->>'must_change_password')::boolean,false) AS must_change_password,
    o.name AS organization_name, o.timezone
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN organizations o ON o.id=u.organization_id
    WHERE s.token_hash=$1 AND s.expires_at>now()
      AND COALESCE((to_jsonb(o)->>'active')::boolean,true)`, [tokenHash(token)]);
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { id: row.id, name: row.name, organizationId: row.organization_id, organizationName: row.organization_name, timezone: row.timezone, mustChangePassword: row.must_change_password };
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}
