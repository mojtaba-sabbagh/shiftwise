"use server";

import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSession, endAdminSession, hashPassword, requireAdmin, verifyPassword } from "@/lib/auth";
import { db, transaction } from "@/lib/db";

function field(form: FormData, key: string, max = 120) {
  const value = String(form.get(key) || "").trim();
  if (!value || value.length > max) throw new Error("اطلاعات واردشده کامل یا معتبر نیست.");
  return value;
}
function representative(form: FormData) {
  const name = field(form, "representative", 120);
  const email = field(form, "email", 254).toLowerCase();
  const password = String(form.get("password") || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || password.length > 256) {
    throw new Error("ایمیل معتبر و رمز موقت با دست‌کم ۱۲ نویسه وارد کنید.");
  }
  return { name, email, password };
}
function feedback(kind: "error" | "notice", message: string) {
  redirect(`/admin?${kind}=${encodeURIComponent(message)}`);
}
function organizationId(form: FormData) {
  const id = field(form, "organizationId", 36);
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("شناسهٔ سازمان نامعتبر است.");
  return id;
}
function detailFeedback(id: string, kind: "error" | "notice", message: string) {
  redirect(`/admin/organizations/${id}?${kind}=${encodeURIComponent(message)}`);
}

export async function adminSignIn(form: FormData) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const result = await db().query("SELECT id,password_hash FROM superadmins WHERE email=$1", [email]);
  if (!result.rowCount || !await verifyPassword(password, result.rows[0].password_hash)) {
    redirect("/admin/login?error=" + encodeURIComponent("ایمیل یا رمز عبور نادرست است."));
  }
  await createAdminSession(result.rows[0].id);
  redirect("/admin");
}
export async function adminSignOut() {
  await endAdminSession();
  redirect("/admin/login");
}

export async function createWorkspace(form: FormData) {
  await requireAdmin();
  let message: string;
  try {
    const organization = field(form, "organization", 120);
    const timezone = field(form, "timezone", 80);
    const rep = representative(form);
    if (!DateTime.now().setZone(timezone).isValid) throw new Error("منطقهٔ زمانی نامعتبر است.");
    const passwordHash = await hashPassword(rep.password);
    await transaction(async client => {
      const orgId = randomUUID();
      await client.query("INSERT INTO organizations(id,name,timezone) VALUES($1,$2,$3)", [orgId, organization, timezone]);
      await client.query("INSERT INTO scheduling_rules(organization_id) VALUES($1)", [orgId]);
      for (const shift of [
        { name: "صبح", start: "06:00", end: "14:00" },
        { name: "عصر", start: "14:00", end: "22:00" },
        { name: "شب", start: "22:00", end: "06:00" },
      ]) {
        await client.query("INSERT INTO shift_templates(id,organization_id,name,start_time,end_time) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), orgId, shift.name, shift.start, shift.end]);
      }
      await client.query("INSERT INTO users(id,organization_id,name,email,password_hash,must_change_password) VALUES($1,$2,$3,$4,$5,true)",
        [randomUUID(), orgId, rep.name, rep.email, passwordHash]);
    });
    message = `محیط کار «${organization}» و حساب نماینده ساخته شد.`;
  } catch (error) {
    message = (error as { code?: string }).code === "23505" ? "این ایمیل قبلاً ثبت شده است." : error instanceof Error ? error.message : "ایجاد محیط کار ممکن نشد.";
    feedback("error", message);
  }
  revalidatePath("/admin");
  feedback("notice", message!);
}

export async function addRepresentative(form: FormData) {
  await requireAdmin();
  let message: string;
  try {
    const orgId = field(form, "organizationId", 36);
    if (!/^[a-f0-9-]{36}$/i.test(orgId)) throw new Error("سازمان نامعتبر است.");
    const rep = representative(form);
    const result = await db().query(`INSERT INTO users(id,organization_id,name,email,password_hash,must_change_password)
      SELECT $1,id,$3,$4,$5,true FROM organizations WHERE id=$2 RETURNING id`,
      [randomUUID(), orgId, rep.name, rep.email, await hashPassword(rep.password)]);
    if (!result.rowCount) throw new Error("سازمان یافت نشد.");
    message = "دسترسی نمایندهٔ جدید ایجاد شد.";
  } catch (error) {
    message = (error as { code?: string }).code === "23505" ? "این ایمیل قبلاً ثبت شده است." : error instanceof Error ? error.message : "ایجاد دسترسی ممکن نشد.";
    feedback("error", message);
  }
  revalidatePath("/admin");
  feedback("notice", message!);
}

export async function updateOrganization(form: FormData) {
  await requireAdmin();
  const id = organizationId(form);
  let message: string;
  try {
    const name = field(form, "organization", 120);
    const timezone = field(form, "timezone", 80);
    if (!DateTime.now().setZone(timezone).isValid) throw new Error("منطقهٔ زمانی نامعتبر است.");
    const result = await db().query("UPDATE organizations SET name=$2,timezone=$3 WHERE id=$1 RETURNING id", [id, name, timezone]);
    if (!result.rowCount) throw new Error("سازمان یافت نشد.");
    message = "اطلاعات سازمان به‌روز شد.";
  } catch (error) {
    detailFeedback(id, "error", error instanceof Error ? error.message : "ویرایش سازمان ممکن نشد.");
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/organizations/${id}`);
  detailFeedback(id, "notice", message!);
}

export async function setOrganizationActive(form: FormData) {
  await requireAdmin();
  const id = organizationId(form);
  const status = String(form.get("status") || "");
  if (status !== "enable" && status !== "disable") detailFeedback(id, "error", "وضعیت نامعتبر است.");
  const active = status === "enable";
  let message: string;
  try {
    await transaction(async client => {
      const result = await client.query("UPDATE organizations SET active=$2 WHERE id=$1 RETURNING name", [id, active]);
      if (!result.rowCount) throw new Error("سازمان یافت نشد.");
      if (!active) await client.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id=$1)", [id]);
    });
    message = active ? "محیط کار سازمان فعال شد. نماینده می‌تواند دوباره وارد شود." : "محیط کار غیرفعال شد و نشست‌های نمایندگان پایان یافت.";
  } catch (error) {
    detailFeedback(id, "error", error instanceof Error ? error.message : "تغییر وضعیت ممکن نشد.");
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/organizations/${id}`);
  detailFeedback(id, "notice", message!);
}

export async function deleteOrganization(form: FormData) {
  await requireAdmin();
  const id = organizationId(form);
  try {
    const confirmation = field(form, "confirmation", 120);
    await transaction(async client => {
      const result = await client.query<{ name: string; active: boolean }>("SELECT name,active FROM organizations WHERE id=$1 FOR UPDATE", [id]);
      if (!result.rowCount) throw new Error("سازمان یافت نشد.");
      if (result.rows[0].active) throw new Error("پیش از حذف، سازمان را غیرفعال کنید.");
      if (confirmation !== result.rows[0].name) throw new Error("نام تأیید با نام سازمان یکسان نیست.");
      // Assignments reference workers and roles; remove runs first, then cascade the tenant data.
      await client.query("DELETE FROM schedule_runs WHERE organization_id=$1", [id]);
      await client.query("DELETE FROM organizations WHERE id=$1", [id]);
    });
  } catch (error) {
    detailFeedback(id, "error", error instanceof Error ? error.message : "حذف سازمان ممکن نشد.");
  }
  revalidatePath("/admin");
  feedback("notice", "سازمان و داده‌های مربوط به آن حذف شدند.");
}
