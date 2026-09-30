"use server";

import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, currentUser, endSession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { db, transaction } from "@/lib/db";
import { loadOrganization } from "@/lib/data";
import { generateWithCpSat } from "@/lib/cp-sat";
import { faNumber } from "@/lib/format";

const fieldLabels: Record<string, string> = {
  name:"نام", organization:"سازمان", email:"ایمیل", password:"رمز عبور", timezone:"منطقهٔ زمانی",
  workerId:"کارمند", roleId:"نقش", shiftId:"شیفت", weekday:"روز هفته", count:"تعداد",
  startTime:"ساعت آغاز", endTime:"ساعت پایان", startDate:"روز آغاز", endDate:"روز پایان",
  minRestHours:"حداقل استراحت", maxWeeklyHours:"حداکثر ساعت هفتگی", maxConsecutiveDays:"حداکثر روزهای پیاپی",
  maxNightShifts:"حداکثر شیفت شب", nightStartHour:"آغاز شب", weekStart:"آغاز هفته",
};

function value(form: FormData, key: string, max = 120) {
  const text = String(form.get(key) || "").trim();
  if (!text || text.length > max) throw new Error(`فیلد ${fieldLabels[key] || key} باید بین ۱ تا ${faNumber(max)} نویسه باشد.`);
  return text;
}
function uuid(form: FormData, key: string) {
  const id = value(form, key, 36);
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error(`شناسهٔ ${fieldLabels[key] || key} نامعتبر است.`);
  return id;
}
function integer(form: FormData, key: string, min: number, max: number) {
  const raw = value(form, key, 3);
  const number = Number(raw);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`مقدار ${fieldLabels[key] || key} باید بین ${faNumber(min)} و ${faNumber(max)} باشد.`);
  return number;
}
function feedback(path: string, kind: "notice" | "error", message: string) {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}
async function dashboardAction(work: () => Promise<string>) {
  let message: string;
  try { message = await work(); }
  catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    feedback("/dashboard", "error", error instanceof Error ? error.message : "خطایی رخ داد.");
  }
  revalidatePath("/dashboard");
  feedback("/dashboard", "notice", message!);
}

export async function signIn(form: FormData) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const result = await db().query(`SELECT u.id,u.password_hash,
    COALESCE((to_jsonb(u)->>'must_change_password')::boolean,false) AS must_change_password,
    COALESCE((to_jsonb(o)->>'active')::boolean,true) AS organization_active
    FROM users u JOIN organizations o ON o.id=u.organization_id WHERE u.email=$1`, [email]);
  const valid = result.rowCount && await verifyPassword(password, result.rows[0].password_hash);
  if (!valid) feedback("/login", "error", "ایمیل یا رمز عبور نادرست است.");
  if (!result.rows[0].organization_active) feedback("/login", "error", "محیط کار این سازمان غیرفعال است. با مدیر سامانه تماس بگیرید.");
  await createSession(result.rows[0].id);
  redirect(result.rows[0].must_change_password ? "/change-password" : "/dashboard");
}

export async function signOut() { await endSession(); redirect("/"); }

export async function changePassword(form: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const current = String(form.get("currentPassword") || "");
  const next = String(form.get("newPassword") || "");
  if (next.length < 12 || next.length > 256) feedback("/change-password", "error", "رمز جدید باید دست‌کم ۱۲ نویسه داشته باشد.");
  if (current === next) feedback("/change-password", "error", "رمز جدید باید با رمز موقت متفاوت باشد.");
  const result = await db().query("SELECT password_hash FROM users WHERE id=$1", [user.id]);
  if (!result.rowCount || !await verifyPassword(current, result.rows[0].password_hash)) feedback("/change-password", "error", "رمز فعلی نادرست است.");
  await db().query("UPDATE users SET password_hash=$2,must_change_password=false WHERE id=$1", [user.id, await hashPassword(next)]);
  await db().query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function addRole(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    const name = value(form, "name", 60);
    try { await db().query("INSERT INTO roles(id,organization_id,name) VALUES($1,$2,$3)", [randomUUID(), user.organizationId, name]); }
    catch (error) { if ((error as { code?: string }).code === "23505") throw new Error("این نقش از قبل ثبت شده است."); throw error; }
    return `نقش «${name}» افزوده شد.`;
  });
}

export async function addWorker(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    const name = value(form, "name", 80);
    const email = String(form.get("email") || "").trim().slice(0, 254);
    const selected = [...new Set(form.getAll("roleIds").map(String))];
    if (!selected.length) throw new Error("دست‌کم یک نقش مجاز انتخاب کنید.");
    await transaction(async client => {
      const matching = await client.query("SELECT id FROM roles WHERE organization_id=$1 AND id=ANY($2::uuid[])", [user.organizationId, selected]);
      if (matching.rowCount !== selected.length) throw new Error("یک یا چند نقش نامعتبر است.");
      const id = randomUUID();
      await client.query("INSERT INTO workers(id,organization_id,name,email) VALUES($1,$2,$3,$4)", [id, user.organizationId, name, email || null]);
      for (const roleId of selected) await client.query("INSERT INTO worker_roles(worker_id,role_id) VALUES($1,$2)", [id, roleId]);
    });
    return `کارمند «${name}» افزوده شد.`;
  });
}

export async function toggleWorker(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    const id = uuid(form, "workerId");
    const result = await db().query("UPDATE workers SET active=NOT active WHERE id=$1 AND organization_id=$2 RETURNING active", [id, user.organizationId]);
    if (!result.rowCount) throw new Error("کارمند یافت نشد.");
    return result.rows[0].active ? "کارمند فعال شد." : "کارمند برای برنامه‌های بعدی غیرفعال شد.";
  });
}

export async function addShift(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    const name = value(form, "name", 60);
    const start = value(form, "startTime", 5), end = value(form, "endTime", 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start === end) throw new Error("ساعت آغاز و پایان معتبر و متفاوت وارد کنید.");
    const duration = (Number(end.slice(0, 2)) * 60 + Number(end.slice(3)) - Number(start.slice(0, 2)) * 60 - Number(start.slice(3)) + 1440) % 1440;
    if (duration > 960) throw new Error("طول شیفت نمی‌تواند بیش از ۱۶ ساعت باشد.");
    try { await db().query("INSERT INTO shift_templates(id,organization_id,name,start_time,end_time) VALUES($1,$2,$3,$4,$5)", [randomUUID(), user.organizationId, name, start, end]); }
    catch (error) { if ((error as { code?: string }).code === "23505") throw new Error("نام این شیفت از قبل ثبت شده است."); throw error; }
    return `شیفت «${name}» افزوده شد.`;
  });
}

export async function removeShift(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    const id = uuid(form, "shiftId");
    const result = await db().query("UPDATE shift_templates SET active=false WHERE id=$1 AND organization_id=$2 AND active RETURNING name", [id, user.organizationId]);
    if (!result.rowCount) throw new Error("شیفت فعال پیدا نشد.");
    return `شیفت «${result.rows[0].name}» از برنامه‌های آینده حذف شد. برنامه‌های قبلی حفظ شدند.`;
  });
}

export async function saveShiftDayStaffing(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    const weekday = integer(form, "weekday", 1, 7);
    const shiftId = uuid(form, "shiftId");
    await transaction(async client => {
      const shift = await client.query<{ id: string; name: string }>(
        "SELECT id,name FROM shift_templates WHERE id=$1 AND organization_id=$2 AND active FOR UPDATE", [shiftId, user.organizationId]);
      if (!shift.rowCount) throw new Error("شیفت فعال پیدا نشد.");
      const roles = await client.query<{ id: string; name: string }>("SELECT id,name FROM roles WHERE organization_id=$1 ORDER BY id", [user.organizationId]);
      if (!roles.rowCount) throw new Error("ابتدا تخصص‌ها را تعریف کنید.");
      const entries: { roleId: string; count: number }[] = [];
      for (const role of roles.rows) {
        const raw = String(form.get(`need:${role.id}`) ?? "").trim();
        const count = Number(raw);
        if (!raw || !Number.isInteger(count) || count < 0 || count > 50) {
          throw new Error(`تعداد «${role.name}» در شیفت «${shift.rows[0].name}» باید بین صفر و ۵۰ باشد.`);
        }
        entries.push({ roleId: role.id, count });
      }
      for (const entry of entries) {
        if (entry.count === 0) {
          await client.query("DELETE FROM coverage WHERE organization_id=$1 AND shift_id=$2 AND role_id=$3 AND weekday=$4", [user.organizationId, shiftId, entry.roleId, weekday]);
        } else {
          await client.query(`INSERT INTO coverage(id,organization_id,shift_id,role_id,weekday,required_count)
            VALUES($1,$2,$3,$4,$5,$6)
            ON CONFLICT(organization_id,shift_id,role_id,weekday) DO UPDATE SET required_count=EXCLUDED.required_count`,
            [randomUUID(), user.organizationId, shiftId, entry.roleId, weekday, entry.count]);
        }
      }
    });
    return "نیاز این روز و شیفت ذخیره شد. برای اعمال تغییرات، برنامه را دوباره بسازید.";
  });
}

export async function addTimeOff(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    const workerId = uuid(form, "workerId");
    const start = DateTime.fromISO(value(form, "startDate", 10), { zone: user.timezone }).startOf("day");
    const last = DateTime.fromISO(value(form, "endDate", 10), { zone: user.timezone }).startOf("day");
    if (!start.isValid || !last.isValid || last < start || last.diff(start, "days").days > 365) throw new Error("بازهٔ مرخصی معتبر، حداکثر به طول یک سال، انتخاب کنید.");
    const result = await db().query(`INSERT INTO time_off(id,organization_id,worker_id,starts_at,ends_at,reason)
      SELECT $1,$2,w.id,$4,$5,$6 FROM workers w WHERE w.id=$3 AND w.organization_id=$2 RETURNING id`,
      [randomUUID(), user.organizationId, workerId, start.toUTC().toISO(), last.plus({ days: 1 }).toUTC().toISO(), String(form.get("reason") || "").trim().slice(0, 120)]);
    if (!result.rowCount) throw new Error("کارمند یافت نشد.");
    return "مرخصی ذخیره شد.";
  });
}

export async function removeTimeOff(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    await db().query("DELETE FROM time_off WHERE id=$1 AND organization_id=$2", [uuid(form, "timeOffId"), user.organizationId]);
    return "مرخصی حذف شد.";
  });
}

export async function updateRules(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    const rest = integer(form, "minRestHours", 0, 36), hours = integer(form, "maxWeeklyHours", 1, 168);
    const days = integer(form, "maxConsecutiveDays", 1, 7), nights = integer(form, "maxNightShifts", 0, 7);
    const nightStart = integer(form, "nightStartHour", 0, 23);
    await db().query(`UPDATE scheduling_rules SET min_rest_hours=$2,max_weekly_hours=$3,max_consecutive_days=$4,
      max_night_shifts=$5,night_start_hour=$6 WHERE organization_id=$1`, [user.organizationId, rest, hours, days, nights, nightStart]);
    return "قوانین به‌روز شد. برای اعمال آن‌ها برنامهٔ تازه بسازید.";
  });
}

export async function generateRoster(form: FormData) {
  await dashboardAction(async () => {
    const user = await requireUser();
    const weekStart = value(form, "weekStart", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error("تاریخ معتبر برای آغاز هفته انتخاب کنید.");
    const data = await loadOrganization(user.organizationId, user.timezone, weekStart);
    if (!data.roles.length || !data.workers.length || !data.shifts.length || !data.coverage.length) {
      throw new Error("پیش از ساخت برنامه، نقش، کارمند دارای مهارت، شیفت و نیاز پوشش ثبت کنید.");
    }
    const result = await generateWithCpSat(data);
    await transaction(async client => {
      // Serialize schedule saves for this organization. Each run is retained for audit.
      const organization = await client.query("SELECT active FROM organizations WHERE id=$1 FOR UPDATE", [user.organizationId]);
      if (!organization.rows[0]?.active) throw new Error("محیط کار این سازمان غیرفعال است.");
      const runId = randomUUID();
      await client.query(`INSERT INTO schedule_runs(id,organization_id,week_start,status,required_count,assigned_count,diagnostics,algorithm,evaluation_count,seed)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`, [runId, user.organizationId, weekStart,
        result.uncovered.length ? "partial" : "complete", result.positions.length, result.assignments.length,
        JSON.stringify(result.uncovered), result.algorithm, result.evaluations, result.seed]);
      for (const assignment of result.assignments) {
        const p = assignment.position;
        await client.query(`INSERT INTO schedule_assignments(id,run_id,worker_id,role_id,shift_id,shift_date,starts_at,ends_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [randomUUID(), runId, assignment.workerId, p.roleId, p.shiftId, p.date, p.startsAt, p.endsAt]);
      }
    });
    return result.uncovered.length ? `برنامه با ${faNumber(result.uncovered.length)} جایگاه بدون نیرو ذخیره شد. گزارش پوشش را بررسی کنید.` : "برنامهٔ کامل ساخته و ذخیره شد.";
  });
}
