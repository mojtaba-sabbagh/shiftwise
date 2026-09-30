import Link from "next/link";
import { ArrowLeft, Building2, LogOut, Plus, ShieldCheck, Users2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { faNumber } from "@/lib/format";
import { addRepresentative, adminSignOut, createWorkspace } from "./actions";

type Organization = { id: string; name: string; timezone: string; active: boolean; created_at: Date; representatives: number; schedules: number };

export default async function AdminPanel({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const admin = await requireAdmin();
  const { rows } = await db().query<Organization>(`SELECT o.id,o.name,o.timezone,o.active,o.created_at,
    (SELECT count(*)::int FROM users u WHERE u.organization_id=o.id) AS representatives,
    (SELECT count(*)::int FROM schedule_runs r WHERE r.organization_id=o.id) AS schedules
    FROM organizations o ORDER BY o.created_at DESC`);
  const { error, notice } = await searchParams;
  return <div className="min-h-screen bg-[#f4f8f4]">
    <header className="border-b border-[#e0ebe2] bg-white"><div className="shell flex flex-wrap items-center justify-between gap-4 px-6 py-5">
      <Link href="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#175d42] text-white"><ShieldCheck size={21}/></span><span><strong className="block text-lg text-[#214b35]">پنل مدیر ارشد</strong><small className="text-[#819889]">شیفت‌یار · مدیریت سازمان‌ها</small></span></Link>
      <div className="flex items-center gap-4"><span className="text-xs font-bold text-[#557560]">{admin.name}</span><form action={adminSignOut}><button className="btn btn-light"><LogOut size={15}/> خروج</button></form></div>
    </div></header>
    <main className="shell px-6 py-10">
      <div className="mb-8"><p className="text-xs font-bold text-[#268455]">مدیریت دسترسی سازمانی</p><h1 className="mt-2 text-3xl font-bold text-[#1b4430]">محیط‌های کار</h1><p className="mt-2 text-sm text-[#738a79]">برای هر سازمان محیطی جداگانه بسازید و حساب نمایندهٔ آن را ایجاد کنید.</p></div>
      {(error || notice) && <p role="status" className={`mb-6 rounded-xl border p-4 text-sm ${error ? "border-[#f0c9be] bg-[#fff1ed] text-[#a14939]" : "border-[#c5e7cf] bg-[#edfaee] text-[#2c8052]"}`}>{error || notice}</p>}
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)]">
        <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-[#e8efe8] px-6 py-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Building2 size={19} className="text-[#30875a]"/> سازمان‌ها</h2><span className="badge bg-[#e8f5e9] text-[#267c4f]">{faNumber(rows.length)} سازمان</span></div>
          {rows.length ? <div className="divide-y divide-[#e8efe8]">{rows.map(org => <div key={org.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"><div><h3 className="font-bold text-[#265038]">{org.name}</h3><p className="mt-1 text-xs text-[#849a89]">{org.timezone}</p><span className={`badge mt-2 ${org.active ? "bg-[#e8f5e9] text-[#267c4f]" : "bg-[#f5eae7] text-[#a45445]"}`}>{org.active ? "فعال" : "غیرفعال"}</span></div><div className="flex flex-wrap items-center gap-3 text-xs text-[#60846c]"><span className="flex items-center gap-1"><Users2 size={15}/>{faNumber(org.representatives)} حساب</span><span>{faNumber(org.schedules)} برنامه</span><Link href={`/admin/organizations/${org.id}`} className="btn btn-light">مشاهده و مدیریت <ArrowLeft size={16}/></Link></div></div>)}</div> : <p className="px-6 py-12 text-center text-sm text-[#85998a]">هنوز سازمانی ثبت نشده است.</p>}
        </section>
        <div className="space-y-6"><section className="card p-6"><div className="flex items-center gap-2"><Plus size={20} className="text-[#278657]"/><h2 className="text-lg font-bold">ساخت محیط کار جدید</h2></div><p className="mt-2 text-xs leading-6 text-[#7a9080]">حساب نماینده هم‌زمان ساخته می‌شود. رمز موقت را از راهی امن در اختیار او قرار دهید؛ در اولین ورود باید آن را تغییر دهد.</p>
          <form action={createWorkspace} className="mt-6 space-y-4"><div><label htmlFor="organization" className="label">نام سازمان</label><input id="organization" name="organization" className="field" required maxLength={120}/></div><div><label htmlFor="timezone" className="label">منطقهٔ زمانی</label><select id="timezone" name="timezone" className="field" defaultValue="Asia/Tehran"><option value="Asia/Tehran">تهران</option><option value="UTC">زمان جهانی</option><option value="Asia/Dubai">دبی</option><option value="Europe/London">لندن</option></select></div><div><label htmlFor="representative" className="label">نام نماینده</label><input id="representative" name="representative" className="field" required maxLength={120}/></div><div><label htmlFor="email" className="label">ایمیل نماینده</label><input id="email" name="email" type="email" className="field" required maxLength={254}/></div><div><label htmlFor="password" className="label">رمز موقت نماینده · حداقل ۱۲ نویسه</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} className="field" required/></div><button className="btn btn-primary w-full py-3"><Plus size={16}/> ایجاد محیط و نماینده</button></form>
        </section>
        {rows.length > 0 && <section className="card p-6"><h2 className="text-base font-bold">افزودن نماینده به سازمان موجود</h2><form action={addRepresentative} className="mt-5 space-y-3"><select name="organizationId" className="field" required defaultValue=""><option value="" disabled>انتخاب سازمان</option>{rows.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select><input name="representative" className="field" placeholder="نام نماینده" required maxLength={120}/><input name="email" type="email" className="field" placeholder="ایمیل نماینده" required maxLength={254}/><input name="password" type="password" autoComplete="new-password" className="field" placeholder="رمز موقت · حداقل ۱۲ نویسه" required minLength={12} maxLength={256}/><button className="btn btn-dark w-full"><Users2 size={15}/> ایجاد دسترسی نماینده</button></form></section>}
        </div>
      </div>
    </main>
  </div>;
}
