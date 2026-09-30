import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, Pencil, Power, Trash2, Users2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { faDate, faNumber } from "@/lib/format";
import { deleteOrganization, setOrganizationActive, updateOrganization } from "../../actions";

type Organization = {
  id: string; name: string; timezone: string; active: boolean; created_at: Date;
  workers: number; roles: number; shifts: number; coverage: number; schedules: number;
};
type Representative = { id: string; name: string; email: string };
type RecentRun = { id: string; week_start: string; status: string; assigned_count: number; required_count: number };

const timezones = ["Asia/Tehran", "UTC", "Asia/Dubai", "Europe/London", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];

export default async function OrganizationDetails({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const [organization, representatives, recent, feedback] = await Promise.all([
    db().query<Organization>(`SELECT o.id,o.name,o.timezone,o.active,o.created_at,
      (SELECT count(*)::int FROM workers WHERE organization_id=o.id) AS workers,
      (SELECT count(*)::int FROM roles WHERE organization_id=o.id) AS roles,
      (SELECT count(*)::int FROM shift_templates WHERE organization_id=o.id) AS shifts,
      (SELECT count(*)::int FROM coverage WHERE organization_id=o.id) AS coverage,
      (SELECT count(*)::int FROM schedule_runs WHERE organization_id=o.id) AS schedules
      FROM organizations o WHERE o.id=$1`, [id]),
    db().query<Representative>("SELECT id,name,email FROM users WHERE organization_id=$1 ORDER BY created_at", [id]),
    db().query<RecentRun>("SELECT id,week_start::text,status,assigned_count,required_count FROM schedule_runs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 5", [id]),
    searchParams,
  ]);
  if (!organization.rowCount) notFound();
  const org = organization.rows[0];
  const availableZones = [...new Set([org.timezone, ...timezones])];

  return <main className="min-h-screen bg-[#f4f8f4]">
    <header className="border-b border-[#e0ebe2] bg-white"><div className="shell flex flex-wrap items-center justify-between gap-4 px-6 py-5">
      <Link href="/admin" className="flex items-center gap-2 text-[#2c6c4d]"><ArrowRight size={18}/><span className="font-bold">فهرست سازمان‌ها</span></Link>
      <span className="text-sm font-bold text-[#557560]">مدیریت محیط کار · {org.name}</span>
    </div></header>
    <div className="shell px-6 py-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold text-[#268455]">جزئیات سازمان</p><h1 className="mt-2 text-3xl font-bold text-[#1b4430]">{org.name}</h1><p className="mt-2 text-sm text-[#738a79]">منطقهٔ زمانی: {org.timezone}</p></div>
        <span className={`badge px-4 py-2 ${org.active ? "bg-[#e4f4e7] text-[#247c4e]" : "bg-[#f7e8e4] text-[#a64d40]"}`}>{org.active ? "محیط کار فعال" : "محیط کار غیرفعال"}</span>
      </div>
      {(feedback.error || feedback.notice) && <p role="status" className={`mb-6 rounded-xl border p-4 text-sm ${feedback.error ? "border-[#f0c9be] bg-[#fff1ed] text-[#a14939]" : "border-[#c5e7cf] bg-[#edfaee] text-[#2c8052]"}`}>{feedback.error || feedback.notice}</p>}
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "نمایندگان", count: representatives.rowCount || 0, icon: Users2 },
          { label: "کارکنان و نقش‌ها", count: org.workers, detail: `${faNumber(org.roles)} نقش`, icon: Users2 },
          { label: "الگوها و نیاز پوشش", count: org.shifts, detail: `${faNumber(org.coverage)} نیاز هفتگی`, icon: Building2 },
          { label: "برنامه‌های ساخته‌شده", count: org.schedules, icon: CalendarDays },
        ].map(item => <div key={item.label} className="card p-5"><span className="flex items-center gap-2 text-sm font-bold text-[#6b8674]"><item.icon size={19}/>{item.label}</span><strong className="mt-3 block text-2xl text-[#214b35]">{faNumber(item.count)}</strong>{"detail" in item && <p className="mt-1 text-xs text-[#849a89]">{item.detail}</p>}</div>)}
      </div>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)]">
        <div className="space-y-7">
          <section className="card overflow-hidden"><div className="border-b border-[#e8efe8] px-6 py-5"><h2 className="text-lg font-bold">نمایندگان سازمان</h2></div>
            {representatives.rowCount ? <div className="divide-y divide-[#e8efe8]">{representatives.rows.map(rep => <div key={rep.id} className="flex flex-wrap justify-between gap-2 px-6 py-4"><strong className="text-[#28523b]">{rep.name}</strong><span className="text-sm text-[#6c8775]" dir="ltr">{rep.email}</span></div>)}</div> : <p className="px-6 py-8 text-sm text-[#849a89]">نماینده‌ای ثبت نشده است.</p>}
          </section>
          <section className="card overflow-hidden"><div className="border-b border-[#e8efe8] px-6 py-5"><h2 className="text-lg font-bold">برنامه‌های اخیر</h2></div>
            {recent.rowCount ? <div className="divide-y divide-[#e8efe8]">{recent.rows.map(run => <div key={run.id} className="flex flex-wrap justify-between gap-2 px-6 py-4 text-sm"><span>هفتهٔ {faDate(run.week_start)}</span><span className="text-[#64836c]">{faNumber(run.assigned_count)} از {faNumber(run.required_count)} جایگاه · {run.status === "complete" ? "کامل" : "ناقص"}</span></div>)}</div> : <p className="px-6 py-8 text-sm text-[#849a89]">هنوز برنامه‌ای ساخته نشده است.</p>}
          </section>
        </div>
        <div className="space-y-7">
          <section className="card p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><Pencil size={19} className="text-[#278657]"/> ویرایش سازمان</h2>
            <form action={updateOrganization} className="mt-5 space-y-4"><input type="hidden" name="organizationId" value={org.id}/><div><label htmlFor="organization" className="label">نام سازمان</label><input id="organization" name="organization" className="field" defaultValue={org.name} required maxLength={120}/></div><div><label htmlFor="timezone" className="label">منطقهٔ زمانی</label><select id="timezone" name="timezone" className="field" defaultValue={org.timezone}>{availableZones.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></div><button className="btn btn-primary w-full">ذخیرهٔ تغییرات</button></form>
          </section>
          <section className="card p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><Power size={19} className="text-[#278657]"/> وضعیت دسترسی</h2>
            <p className="mt-3 text-sm text-[#728879]">{org.active ? "با غیرفعال‌سازی، نمایندگان از سامانه خارج می‌شوند و تا فعال‌سازی دوباره نمی‌توانند وارد شوند یا شیفت‌بندی کنند." : "نمایندگان این سازمان اکنون به محیط کار دسترسی ندارند. با فعال‌سازی دوباره باید وارد حساب خود شوند."}</p>
            <form action={setOrganizationActive} className="mt-5"><input type="hidden" name="organizationId" value={org.id}/><input type="hidden" name="status" value={org.active ? "disable" : "enable"}/><button className={`btn w-full ${org.active ? "border border-[#dcae9f] bg-[#fff1ed] text-[#a14939]" : "btn-primary"}`}>{org.active ? "غیرفعال کردن سازمان" : "فعال کردن دوبارهٔ سازمان"}</button></form>
          </section>
          <section className="card border-[#efd5cf] p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-[#9e473d]"><Trash2 size={19}/> حذف سازمان</h2>
            <p className="mt-3 text-sm text-[#886b66]">حذف دائمی است و حساب‌ها، کارکنان، شیفت‌ها و برنامه‌های این سازمان را پاک می‌کند. ابتدا سازمان را غیرفعال کنید، سپس نام آن را برای تأیید وارد کنید.</p>
            <form action={deleteOrganization} className="mt-5 space-y-3"><input type="hidden" name="organizationId" value={org.id}/><label className="label" htmlFor="confirmation">برای تأیید، «{org.name}» را بنویسید</label><input id="confirmation" name="confirmation" className="field" required autoComplete="off" disabled={org.active}/><button disabled={org.active} className="btn w-full bg-[#a84b40] text-white disabled:cursor-not-allowed disabled:opacity-50">حذف دائمی سازمان</button></form>
          </section>
        </div>
      </div>
    </div>
  </main>;
}
