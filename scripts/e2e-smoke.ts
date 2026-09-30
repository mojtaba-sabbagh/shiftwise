import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { db } from "../lib/db";
import { hashPassword } from "../lib/auth";
import { randomUUID } from "node:crypto";

const origin = "http://localhost:3000";
function formAction(html: string, marker: string) {
  const forms = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/g) || [];
  const form = forms.find(item => item.includes(marker));
  const id = form?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  if (!id) throw new Error(`Form action not found for ${marker}`);
  return id;
}
async function page(path: string, cookie = "") {
  const response = await fetch(`${origin}${path}`, { headers: cookie ? { cookie } : undefined, redirect:"manual" });
  return { response, html: await response.text() };
}
async function submit(path: string, html: string, marker: string, fields: Record<string,string>, cookie = "") {
  const action = formAction(html, marker);
  const body = new FormData();
  body.append(action, "");
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  return fetch(`${origin}${path}`, { method:"POST", redirect:"manual", headers:{
    origin, ...(cookie ? { cookie } : {}),
  }, body });
}
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const pool = db();
  const tag = randomBytes(6).toString("hex");
  const email = `smoke-${tag}@example.invalid`;
  const organization = `آزمون موقت ${tag}`;
  const adminEmail = `admin-smoke-${tag}@example.invalid`;
  const adminPassword = randomBytes(24).toString("hex");
  const temporaryPassword = randomBytes(24).toString("hex");
  const newPassword = randomBytes(24).toString("hex");
  const adminId = randomUUID();
  let orgId: string | undefined;
  try {
    await pool.query("INSERT INTO superadmins(id,name,email,password_hash) VALUES($1,$2,$3,$4)", [adminId, "مدیر آزمون", adminEmail, await hashPassword(adminPassword)]);
    const signup = await page("/signup");
    assert.equal(signup.response.status, 200);
    assert.doesNotMatch(signup.html, /name="organization"/);
    const blockedAdmin = await page("/admin");
    assert.match(blockedAdmin.response.headers.get("location") || "", /\/admin\/login/);
    const adminLogin = await page("/admin/login");
    const adminSignedIn = await submit("/admin/login", adminLogin.html, 'name="email"', { email:adminEmail, password:adminPassword });
    assert.ok([303,307].includes(adminSignedIn.status));
    const adminCookie = adminSignedIn.headers.get("set-cookie")?.match(/shiftwise_admin_session=[^;]+/)?.[0];
    assert.ok(adminCookie, "Admin session cookie missing");
    const adminPanel = await page("/admin", adminCookie);
    assert.equal(adminPanel.response.status, 200);
    const created = await submit("/admin", adminPanel.html, 'name="organization"', {
      organization, representative:"نمایندهٔ آزمایشی", email, password:temporaryPassword, timezone:"Asia/Tehran",
    }, adminCookie);
    assert.ok([303,307].includes(created.status), `Create workspace: ${created.status}`);
    const found = await pool.query("SELECT organization_id,must_change_password FROM users WHERE email=$1", [email]);
    assert.equal(found.rowCount, 1);
    assert.equal(found.rows[0].must_change_password, true);
    orgId = found.rows[0].organization_id;
    const defaultShifts = await pool.query("SELECT name FROM shift_templates WHERE organization_id=$1 AND active ORDER BY start_time", [orgId]);
    assert.deepEqual(defaultShifts.rows.map(row => row.name), ["صبح", "عصر", "شب"]);

    const login = await page("/login");
    const registered = await submit("/login", login.html, 'name="email"', {
      email, password:temporaryPassword,
    });
    assert.ok([303,307].includes(registered.status), `Login status: ${registered.status}`);
    assert.match(registered.headers.get("location") || "", /\/change-password/);
    const cookie = registered.headers.get("set-cookie")?.match(/shiftwise_session=[^;]+/)?.[0];
    assert.ok(cookie, "Session cookie missing");
    const blockedDashboard = await page("/dashboard", cookie);
    assert.match(blockedDashboard.response.headers.get("location") || "", /\/change-password/);
    const change = await page("/change-password", cookie);
    const changed = await submit("/change-password", change.html, 'name="currentPassword"', {
      currentPassword:temporaryPassword, newPassword,
    }, cookie);
    assert.ok([303,307].includes(changed.status), `Change password: ${changed.status}`);
    assert.match(changed.headers.get("location") || "", /\/dashboard/);
    const activeCookie = changed.headers.get("set-cookie")?.match(/shiftwise_session=[^;]+/)?.[0];
    assert.ok(activeCookie, "Rotated session cookie missing");

    let dashboard = await page("/dashboard", activeCookie);
    assert.equal(dashboard.response.status, 200);
    assert.doesNotMatch(dashboard.html, /type="date"/);
    assert.match(dashboard.html, /name="weekStart" value="\d{4}-\d{2}-\d{2}"/);
    assert.match(dashboard.html, /تیم و مهارت‌ها/);

    const roleResult = await submit("/dashboard", dashboard.html, 'placeholder="مثلاً اپراتور خط"', { name:"اپراتور" }, activeCookie);
    assert.ok([303,307].includes(roleResult.status), `Role action: ${roleResult.status}`);
    const role = (await pool.query("SELECT id FROM roles WHERE organization_id=$1", [orgId])).rows[0].id;
    dashboard = await page("/dashboard", activeCookie);
    const secondRoleResult = await submit("/dashboard", dashboard.html, 'placeholder="مثلاً اپراتور خط"', { name:"بازرس آزمایشی" }, activeCookie);
    assert.ok([303,307].includes(secondRoleResult.status));
    const secondRole = (await pool.query("SELECT id FROM roles WHERE organization_id=$1 AND name=$2", [orgId, "بازرس آزمایشی"])).rows[0].id;

    dashboard = await page("/dashboard", activeCookie);
    const workerResult = await submit("/dashboard", dashboard.html, 'placeholder="نام و نام خانوادگی"', {
      name:"کارمند آزمایشی", email:"", roleIds:role,
    }, activeCookie);
    assert.ok([303,307].includes(workerResult.status), `Worker action: ${workerResult.status}`);

    dashboard = await page("/dashboard", activeCookie);
    const shiftResult = await submit("/dashboard", dashboard.html, 'name="startTime"', {
      name:"آزمایشی", startTime:"07:00", endTime:"15:00",
    }, activeCookie);
    assert.ok([303,307].includes(shiftResult.status), `Shift action: ${shiftResult.status}`);
    const shift = (await pool.query("SELECT id FROM shift_templates WHERE organization_id=$1 AND name=$2", [orgId, "آزمایشی"])).rows[0].id;

    dashboard = await page("/dashboard", activeCookie);
    const staffing = { [`need:${role}`]:"1", [`need:${secondRole}`]:"3" };
    const coverageResult = await submit("/dashboard", dashboard.html, `name="shiftId" value="${shift}"`, {
      weekday:"6", shiftId:shift, ...staffing,
    }, activeCookie);
    assert.ok([303,307].includes(coverageResult.status), `Coverage action: ${coverageResult.status}`);
    const staffingRows = await pool.query("SELECT role_id,required_count FROM coverage WHERE organization_id=$1 AND shift_id=$2 ORDER BY role_id", [orgId, shift]);
    assert.deepEqual(new Map(staffingRows.rows.map(row => [row.role_id, row.required_count])), new Map([[role, 1], [secondRole, 3]]));
    dashboard = await page("/dashboard", activeCookie);
    const updatedCoverage = await submit("/dashboard", dashboard.html, `name="shiftId" value="${shift}"`, {
      weekday:"6", shiftId:shift, ...staffing, [`need:${secondRole}`]:"0",
    }, activeCookie);
    assert.ok([303,307].includes(updatedCoverage.status));
    assert.deepEqual((await pool.query("SELECT role_id,required_count FROM coverage WHERE organization_id=$1 AND shift_id=$2", [orgId, shift])).rows,
      [{ role_id:role, required_count:1 }]);

    const otherShift = (await pool.query("SELECT id FROM shift_templates WHERE organization_id=$1 AND name=$2", [orgId, "عصر"])).rows[0].id;
    dashboard = await page("/dashboard", activeCookie);
    const otherCoverage = await submit("/dashboard", dashboard.html, 'aria-label="تعداد بازرس آزمایشی در شیفت عصر روز یکشنبه"', {
      weekday:"7", shiftId:otherShift, [`need:${role}`]:"0", [`need:${secondRole}`]:"2",
    }, activeCookie);
    assert.ok([303,307].includes(otherCoverage.status));
    assert.deepEqual((await pool.query("SELECT weekday,required_count FROM coverage WHERE organization_id=$1 AND shift_id=$2", [orgId, shift])).rows,
      [{ weekday:6, required_count:1 }]);
    assert.equal((await pool.query("SELECT required_count FROM coverage WHERE organization_id=$1 AND shift_id=$2 AND weekday=7", [orgId, otherShift])).rows[0].required_count, 2);
    dashboard = await page("/dashboard", activeCookie);
    const clearedCoverage = await submit("/dashboard", dashboard.html, 'aria-label="تعداد بازرس آزمایشی در شیفت عصر روز یکشنبه"', {
      weekday:"7", shiftId:otherShift, [`need:${role}`]:"0", [`need:${secondRole}`]:"0",
    }, activeCookie);
    assert.ok([303,307].includes(clearedCoverage.status));
    assert.equal((await pool.query("SELECT id FROM coverage WHERE organization_id=$1 AND shift_id=$2", [orgId, otherShift])).rowCount, 0);

    dashboard = await page("/dashboard", activeCookie);
    const generated = await submit("/dashboard", dashboard.html, 'name="weekStart"', { weekStart:"2026-09-26" }, activeCookie);
    assert.ok([303,307].includes(generated.status), `Generate action: ${generated.status}`);
    const runs = await pool.query("SELECT id,status,required_count,assigned_count,algorithm FROM schedule_runs WHERE organization_id=$1", [orgId]);
    assert.equal(runs.rowCount, 1);
    assert.deepEqual([runs.rows[0].status,runs.rows[0].required_count,runs.rows[0].assigned_count], ["complete",1,1]);
    assert.equal(runs.rows[0].algorithm, "CP-SAT");

    dashboard = await page("/dashboard", activeCookie);
    assert.match(dashboard.html, /دریافت CSV/);
    const csv = await fetch(`${origin}/api/export?run=${runs.rows[0].id}`, { headers:{ cookie:activeCookie } });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("content-disposition") || "", /roster-1405-07-04\.csv/);
    const csvText = await csv.text();
    assert.match(csvText, /کارمند آزمایشی/);
    assert.match(csvText, /تاریخ شمسی/);
    assert.match(csvText, /۴ مهر ۱۴۰۵/);

    dashboard = await page("/dashboard", activeCookie);
    const removedShift = await submit("/dashboard", dashboard.html, 'aria-label="حذف شیفت آزمایشی"', { shiftId:shift }, activeCookie);
    assert.ok([303,307].includes(removedShift.status), `Remove shift: ${removedShift.status}`);
    assert.equal((await pool.query("SELECT active FROM shift_templates WHERE id=$1", [shift])).rows[0].active, false);
    dashboard = await page("/dashboard", activeCookie);
    assert.equal(dashboard.response.status, 200);
    assert.match(dashboard.html, /دریافت CSV/);

    let details = await page(`/admin/organizations/${orgId}`, adminCookie);
    assert.equal(details.response.status, 200);
    const renamedOrganization = `${organization} ویرایش‌شده`;
    const edited = await submit(`/admin/organizations/${orgId}`, details.html, 'name="organization"', {
      organizationId:orgId!, organization:renamedOrganization, timezone:"Asia/Tehran",
    }, adminCookie);
    assert.ok([303,307].includes(edited.status));
    assert.equal((await pool.query("SELECT name FROM organizations WHERE id=$1", [orgId])).rows[0].name, renamedOrganization);

    details = await page(`/admin/organizations/${orgId}`, adminCookie);
    const disabled = await submit(`/admin/organizations/${orgId}`, details.html, 'name="status"', {
      organizationId:orgId!, status:"disable",
    }, adminCookie);
    assert.ok([303,307].includes(disabled.status));
    assert.equal((await pool.query("SELECT active FROM organizations WHERE id=$1", [orgId])).rows[0].active, false);
    const revoked = await page("/dashboard", activeCookie);
    assert.match(revoked.response.headers.get("location") || "", /\/login/);
    const denied = await submit("/login", login.html, 'name="email"', { email, password:newPassword });
    assert.match(denied.headers.get("location") || "", /\/login\?error=/);
    assert.equal(denied.headers.get("set-cookie"), null);
    const blockedCsv = await fetch(`${origin}/api/export?run=${runs.rows[0].id}`, { headers:{ cookie:activeCookie } });
    assert.equal(blockedCsv.status, 401);

    details = await page(`/admin/organizations/${orgId}`, adminCookie);
    const enabled = await submit(`/admin/organizations/${orgId}`, details.html, 'name="status"', {
      organizationId:orgId!, status:"enable",
    }, adminCookie);
    assert.ok([303,307].includes(enabled.status));
    const resumed = await submit("/login", login.html, 'name="email"', { email, password:newPassword });
    assert.match(resumed.headers.get("location") || "", /\/dashboard/);

    details = await page(`/admin/organizations/${orgId}`, adminCookie);
    await submit(`/admin/organizations/${orgId}`, details.html, 'name="status"', {
      organizationId:orgId!, status:"disable",
    }, adminCookie);
    details = await page(`/admin/organizations/${orgId}`, adminCookie);
    const deleted = await submit(`/admin/organizations/${orgId}`, details.html, 'name="confirmation"', {
      organizationId:orgId!, confirmation:renamedOrganization,
    }, adminCookie);
    assert.ok([303,307].includes(deleted.status));
    assert.equal((await pool.query("SELECT id FROM organizations WHERE id=$1", [orgId])).rowCount, 0);
    console.log("Admin organization management, access revocation, scheduling, and deletion passed.");
  } finally {
    if (orgId) {
      await pool.query("DELETE FROM schedule_runs WHERE organization_id=$1", [orgId]);
      await pool.query("DELETE FROM organizations WHERE id=$1", [orgId]);
    }
    await pool.query("DELETE FROM superadmins WHERE id=$1", [adminId]);
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
