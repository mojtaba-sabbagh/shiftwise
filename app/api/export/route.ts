import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { faDate, faDateTime } from "@/lib/format";
import { jalaliParts } from "@/lib/jalali";

const escapeCsv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user || user.mustChangePassword) return new NextResponse("برای دریافت فایل ابتدا وارد شوید و رمز موقت را تغییر دهید.", { status: 401 });
  const runId = request.nextUrl.searchParams.get("run");
  if (!runId || !/^[a-f0-9-]{36}$/i.test(runId)) return new NextResponse("شناسهٔ برنامه نامعتبر است.", { status: 400 });
  const run = await db().query("SELECT id,week_start::text FROM schedule_runs WHERE id=$1 AND organization_id=$2", [runId, user.organizationId]);
  if (!run.rowCount) return new NextResponse("برنامه یافت نشد.", { status: 404 });
  const result = await db().query(`SELECT a.shift_date::text AS date,s.name AS shift,w.name AS worker,r.name AS role,
    a.starts_at,a.ends_at FROM schedule_assignments a JOIN workers w ON w.id=a.worker_id
    JOIN roles r ON r.id=a.role_id JOIN shift_templates s ON s.id=a.shift_id
    WHERE a.run_id=$1 ORDER BY a.starts_at,w.name`, [runId]);
  const rows = [["تاریخ شمسی", "شیفت", "نقش", "کارمند", "آغاز (شمسی)", "پایان (شمسی)"],
    ...result.rows.map(row => [faDate(row.date), row.shift, row.role, row.worker,
      faDateTime(row.starts_at.toISOString(), user.timezone), faDateTime(row.ends_at.toISOString(), user.timezone)])];
  const csv = "\uFEFF" + rows.map(row => row.map(escapeCsv).join(",")).join("\r\n");
  const { year, month, day } = jalaliParts(run.rows[0].week_start);
  const filename = `roster-${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}.csv`;
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}
