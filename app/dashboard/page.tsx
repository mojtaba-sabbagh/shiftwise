import Link from "next/link";
import { DateTime } from "luxon";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Factory,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Plus,
  Repeat,
  Settings2,
  ShieldCheck,
  Trash2,
  Users2,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadOrganization } from "@/lib/data";
import { faDate, faDateTime, faNumber } from "@/lib/format";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { RosterTable } from "./RosterTable";
import { RotationPatterns } from "./RotationPatterns";
import { ShiftCoverage } from "./ShiftCoverage";
import { WorkersTable } from "./WorkersTable";
import {
  addRole,
  addTimeOff,
  addWorker,
  generateRoster,
  removeTimeOff,
  signOut,
  updateRules,
} from "@/app/actions";

const field = "mini-input";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireUser();
  const today = DateTime.now().setZone(user.timezone);
  const weekStart = today.minus({ days: (today.weekday + 1) % 7 }).toISODate()!;
  const data = await loadOrganization(user.organizationId, user.timezone, weekStart);
  const params = await searchParams;
  const run = data.lastRun;
  const roleNames = new Map(data.roles.map(r => [r.id, r.name]));
  const filled = run?.assignedCount || 0;
  const required = run?.requiredCount || 0;

  return (
    <div className="dashboard-layout shell grid min-h-screen grid-cols-[238px_1fr] bg-[#f5f8f6]">
      <aside className="dashboard-side sticky top-0 flex h-screen flex-col bg-[#173d38] px-4 py-6 text-white">
        <Link href="/" className="mb-12 flex items-center gap-2 px-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#56c5a1] text-[#134639]">
            <LayoutGrid size={18} />
          </span>
          <span className="display text-[22px] font-bold tracking-tight">
            شیفت‌یار<span className="text-[#72dbaf]">.</span>
          </span>
        </Link>
        <p className="mb-3 px-3 text-[10px] font-bold tracking-[.15em] text-[#8db1a7]">
          محیط کار
        </p>
        <nav className="space-y-1">
          <a href="#overview" className="sidebar-link active">
            <LayoutDashboard size={17} /> نمای کلی
          </a>
          <a href="#roster" className="sidebar-link">
            <CalendarDays size={17} /> برنامهٔ شیفت
          </a>
          <a href="#team" className="sidebar-link">
            <Users2 size={17} /> کارکنان و نقش‌ها
          </a>
          <a href="#coverage" className="sidebar-link">
            <Factory size={17} /> پوشش شیفت‌ها
          </a>
          <a href="#time-off" className="sidebar-link">
            <Clock3 size={17} /> مرخصی‌ها
          </a>
          <a href="#rules" className="sidebar-link">
            <Settings2 size={17} /> قوانین برنامه‌ریزی
          </a>
          <a href="#rotation" className="sidebar-link">
            <Repeat size={17} /> الگوهای چرخش
          </a>
        </nav>
        <div className="mt-auto hidden rounded-xl border border-[#47736b] bg-[#28534a] p-4 lg:block">
          <ShieldCheck size={19} className="text-[#9de4bc]" />
          <p className="mt-3 text-xs font-bold">برنامه بر اساس قوانین شما</p>
          <p className="mt-1 text-[11px] leading-5 text-[#afcac0]">
            پیش از ارائه به کارکنان، برنامهٔ تولیدشده را بررسی کنید.
          </p>
        </div>
        <form action={signOut} className="mt-5">
          <button className="sidebar-link w-full">
            <LogOut size={17} /> خروج
          </button>
        </form>
      </aside>

      <main className="dashboard-main min-w-0 px-9 pb-20 pt-7 xl:px-12" id="overview">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfebe4] pb-6">
          <div className="text-xs text-[#8aa099]">
            محیط کار <ChevronRight size={13} className="mx-1 inline" />{" "}
            <strong className="text-[#315d51]">نمای کلی</strong>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge bg-[#e8f4ed] text-[#287e63]">
              <span className="size-1.5 rounded-full bg-[#34b37f]" /> {user.timezone}
            </span>
            <span className="grid size-9 place-items-center rounded-full bg-[#e2efe7] text-xs font-bold text-[#2c725a]">
              {user.name
                .split(" ")
                .map(n => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
          </div>
        </div>

        {(params.notice || params.error) && (
          <div
            role="status"
            className={`mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
              params.error
                ? "border-[#f1c6b8] bg-[#fff1eb] text-[#9d4638]"
                : "border-[#bce5ca] bg-[#eaf8ee] text-[#287455]"
            }`}
          >
            {params.error ? <CircleAlert size={17} /> : <CheckCircle2 size={17} />}
            <span>{params.error || params.notice}</span>
          </div>
        )}

        <section className="mt-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#259475]">
              <span className="size-2 rounded-full bg-[#31b98a]" /> محیط کار شما
            </div>
            <h1 className="text-3xl font-bold text-[#183c35] sm:text-4xl">
              خوش آمدید، {user.name.split(" ")[0]}.
            </h1>
            <p className="mt-2 text-sm text-[#72877e]">
              کارکنان، شیفت‌ها و نیاز سازمان {user.organizationName} را برنامه‌ریزی کنید.
            </p>
          </div>
          <a href="#roster" className="btn btn-light">
            مشاهدهٔ برنامه <ArrowRight size={15} />
          </a>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<Users2 size={19} />}
            label="کارکنان فعال"
            value={faNumber(data.workers.length)}
            detail={`${faNumber(data.roles.length)} نقش تعریف‌شده`}
            tone="green"
          />
          <Metric
            icon={<Clock3 size={19} />}
            label="الگوهای شیفت"
            value={faNumber(data.shifts.length)}
            detail={`${faNumber(data.coverage.length)} نیاز پوشش`}
            tone="blue"
          />
          <Metric
            icon={<CalendarDays size={19} />}
            label="جایگاه‌های تکمیل‌شده"
            value={run ? `${faNumber(filled)} / ${faNumber(required)}` : "—"}
            detail={run ? `هفتهٔ ${faDate(run.weekStart)}` : "اولین برنامه را بسازید"}
            tone="orange"
          />
          <Metric
            icon={<Activity size={19} />}
            label="وضعیت پوشش"
            value={
              run ? (run.status === "complete" ? "کامل" : "ناقص") : "هنوز ساخته نشده"
            }
            detail={
              run ? `${faNumber(required - filled)} جایگاه بدون نیرو` : "در انتظار برنامه"
            }
            tone={run?.status === "partial" ? "orange" : "green"}
          />
        </section>

        <section className="mt-7 space-y-5" id="roster">
          {/* ردیف اول: ساخت برنامه + گزارش پوشش */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#e9f6ef] text-[#1c8d70]">
                  <SparkleIcon />
                </span>
                <div>
                  <h2 className="text-lg font-bold">ساخت برنامهٔ شیفت</h2>
                  <p className="text-xs text-[#81958d]">
                    یک برنامهٔ هفتگی تازه بسازید و ذخیره کنید.
                  </p>
                </div>
              </div>
              <form action={generateRoster} className="mt-6">
                <label className="label" htmlFor="weekStart">
                  هفته با شروع شنبه
                </label>
                <JalaliDatePicker
                  id="weekStart"
                  name="weekStart"
                  todayIso={today.toISODate()!}
                  defaultValue={weekStart}
                  saturdaysOnly
                />
                <p className="mt-3 text-xs leading-5 text-[#879b91]">
                  سامانه در همین هفته، مهارت، مرخصی، تداخل، استراحت، ساعت کار، روزهای پیاپی و
                  سقف شیفت شب را بررسی می‌کند.
                </p>
                <button className="btn btn-primary mt-5 w-full py-3">
                  <CalendarDays size={16} /> ساخت برنامه
                </button>
              </form>
            </div>

            <div
              className={`card p-6 ${
                run?.status === "partial" ? "border-[#f0d7b1] bg-[#fffdf8]" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`grid size-8 place-items-center rounded-lg ${
                    run?.status === "partial"
                      ? "bg-[#fff0d7] text-[#af7927]"
                      : "bg-[#e6f5ed] text-[#318567]"
                  }`}
                >
                  {run?.status === "partial" ? (
                    <CircleAlert size={18} />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                </span>
                <h3 className="text-sm font-bold">گزارش پوشش</h3>
              </div>
              <p className="mt-3 text-xs leading-6 text-[#71867c]">
                {run
                  ? run.status === "complete"
                    ? `همهٔ ${required} جایگاه طبق قوانین تعریف‌شده پوشش داده شدند.`
                    : `از ${faNumber(required)} جایگاه، ${faNumber(
                        required - filled,
                      )} جایگاه بدون نیرو مانده است. کمبودها را بررسی و نیاز یا دسترس‌پذیری را اصلاح کنید.`
                  : "گزارش پوشش پس از ساخت برنامه نمایش داده می‌شود."}
              </p>
              {run?.diagnostics.map((d, i) => {
                const [date, coverageId] = d.positionId.split(":");
                const rule = data.coverageRecords.find(c => c.id === coverageId);
                return (
                  <div
                    key={i}
                    className="mt-2 rounded-lg border border-[#f0d8ba] bg-white p-3 text-xs"
                  >
                    <strong className="text-[#715632]">
                      {faDate(date)} · {rule?.shiftName || "شیفت"} · {rule?.roleName || "نقش"}
                    </strong>
                    <p className="mt-1 leading-5 text-[#8d7960]">{d.message}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ردیف دوم: برنامهٔ هفتگی با عرض کامل */}
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6efea] px-6 py-5">
              <div>
                <h2 className="section-title">برنامهٔ هفتگی</h2>
                <p className="mt-1 text-xs text-[#81968d]">
                  {run
                    ? `هفتهٔ ${faDate(run.weekStart)} · ساخته‌شده در ${faDateTime(
                        run.createdAt,
                        user.timezone,
                      )}`
                    : "برنامهٔ تولیدشده در این بخش نمایش داده می‌شود."}
                </p>
              </div>
              {run && (
                <a href={`/api/export?run=${run.id}`} className="btn btn-light py-2 text-xs">
                  <ArrowDownToLine size={15} /> دریافت CSV
                </a>
              )}
            </div>
            {run ? (
              <RosterTable
                weekStart={run.weekStart}
                workers={data.workerRecords
                  .filter(worker =>
                    run.assignments.some(assignment => assignment.workerId === worker.id),
                  )
                  .map(worker => ({
                    id: worker.id,
                    name: worker.name,
                    roles: worker.roleIds
                      .map(id => roleNames.get(id))
                      .filter((name): name is string => Boolean(name)),
                  }))}
                assignments={run.assignments}
              />
            ) : (
              <div className="flex min-h-[270px] flex-col items-center justify-center px-7 text-center">
                <div className="grid size-14 place-items-center rounded-2xl bg-[#e8f5ee] text-[#328264]">
                  <CalendarDays size={26} />
                </div>
                <h3 className="mt-4 text-lg font-bold">برنامهٔ هفته از اینجا آغاز می‌شود</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#81948d]">
                  کارکنان، شیفت‌ها و نیاز هر شیفت را ثبت کنید؛ سپس برنامهٔ هفتهٔ موردنظر را
                  بسازید.
                </p>
              </div>
            )}
          </div>
        </section>

        <section id="team" className="mt-10 scroll-mt-6">
          <SectionHead
            eyebrow="۰۱ / کارکنان"
            title="تیم و مهارت‌ها"
            description="هر کارمند فقط در نقش‌هایی قرار می‌گیرد که برای او تعریف کرده‌اید."
          />
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <div className="card overflow-hidden">
              <div className="border-b border-[#e8f0eb] px-6 py-4 text-sm font-bold">
                کارکنان{" "}
                <span className="ml-1 text-xs font-normal text-[#92a69b]">
                  ({faNumber(data.workerRecords.length)})
                </span>
              </div>
              <WorkersTable workers={data.workerRecords} roles={data.roles} />
            </div>

            <div className="space-y-5">
              <div className="card p-6">
                <h3 className="text-sm font-bold">افزودن کارمند</h3>
                <form action={addWorker} className="mt-4 space-y-3">
                  <input
                    className={field}
                    name="name"
                    placeholder="نام و نام خانوادگی"
                    required
                    maxLength={80}
                  />
                  <input
                    className={field}
                    name="email"
                    type="email"
                    placeholder="ایمیل (اختیاری)"
                  />
                  <div>
                    <span className="label">نقش‌های مجاز</span>
                    <div className="flex flex-wrap gap-2">
                      {data.roles.map(role => (
                        <label
                          key={role.id}
                          className="flex items-center gap-2 rounded-lg border border-[#dfeae3] px-3 py-2 text-xs text-[#416a5d]"
                        >
                          <input name="roleIds" value={role.id} type="checkbox" />
                          {role.name}
                        </label>
                      ))}
                      {!data.roles.length && (
                        <span className="text-xs text-[#9c9180]">
                          ابتدا یک نقش اضافه کنید.
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="btn btn-primary w-full">
                    <Plus size={15} /> افزودن کارمند
                  </button>
                </form>
              </div>

              <div className="card p-6">
                <h3 className="text-sm font-bold">نقش‌ها</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.roles.map(role => (
                    <span key={role.id} className="badge bg-[#edf5ef] text-[#3d775d]">
                      {role.name}
                    </span>
                  ))}
                  {!data.roles.length && (
                    <span className="text-xs text-[#9caea3]">هنوز نقشی ثبت نشده است.</span>
                  )}
                </div>
                <form action={addRole} className="mt-4 flex gap-2">
                  <input
                    className={field}
                    name="name"
                    placeholder="مثلاً اپراتور خط"
                    maxLength={60}
                    required
                  />
                  <button className="btn btn-dark">
                    <Plus size={15} /> افزودن
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <ShiftCoverage data={data} />

        <section id="time-off" className="mt-10 scroll-mt-6">
          <SectionHead
            eyebrow="۰۳ / دسترس‌پذیری"
            title="مرخصی‌ها"
            description="کارمند در شیفت‌های هم‌زمان با مرخصی قرار نمی‌گیرد."
          />
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <div className="card overflow-hidden">
              <div className="border-b border-[#e8f0eb] px-6 py-4 text-sm font-bold">
                مرخصی‌های ثبت‌شده
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>کارمند</th>
                      <th>تاریخ</th>
                      <th>دلیل</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.timeOffRecords.map(t => (
                      <tr key={t.id}>
                        <td className="font-semibold">{t.workerName}</td>
                        <td>
                          {faDate(
                            DateTime.fromISO(t.startsAt)
                              .setZone(user.timezone)
                              .toISODate()!,
                          )}{" "}
                          تا{" "}
                          {faDate(
                            DateTime.fromISO(t.endsAt)
                              .setZone(user.timezone)
                              .minus({ days: 1 })
                              .toISODate()!,
                          )}
                        </td>
                        <td>{t.reason || "—"}</td>
                        <td>
                          <form action={removeTimeOff}>
                            <input type="hidden" name="timeOffId" value={t.id} />
                            <button
                              aria-label={`حذف مرخصی ${t.workerName}`}
                              className="text-[#9aaba0] hover:text-[#b65e4a]"
                            >
                              <Trash2 size={15} />
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                    {!data.timeOffRecords.length && (
                      <tr>
                        <td colSpan={4} className="py-9 text-center text-[#9caca2]">
                          مرخصی ثبت نشده است.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-bold">ثبت مرخصی</h3>
              <form action={addTimeOff} className="mt-4 space-y-3">
                <select name="workerId" className={field} required defaultValue="">
                  <option value="" disabled>
                    انتخاب کارمند
                  </option>
                  {data.workerRecords.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="startDate">
                      روز آغاز
                    </label>
                    <JalaliDatePicker
                      id="startDate"
                      name="startDate"
                      todayIso={today.toISODate()!}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="endDate">
                      روز پایان
                    </label>
                    <JalaliDatePicker
                      id="endDate"
                      name="endDate"
                      todayIso={today.toISODate()!}
                    />
                  </div>
                </div>
                <input
                  name="reason"
                  className={field}
                  placeholder="دلیل (اختیاری)"
                  maxLength={120}
                />
                <button className="btn btn-dark w-full">
                  <Plus size={15} /> ثبت مرخصی
                </button>
              </form>
            </div>
          </div>
        </section>

        <section id="rules" className="mt-10 scroll-mt-6">
          <SectionHead
            eyebrow="۰۴ / محدودیت‌ها"
            title="قوانین برنامه‌ریزی"
            description="محدودیت‌های سازمان خود را مشخص کنید. این مقادیر جایگزین بررسی قوانین کار نیستند."
          />
          <div className="card mt-5 p-6">
            <form
              action={updateRules}
              className="form-grid grid grid-cols-2 gap-4 lg:grid-cols-5"
            >
              <RuleField
                name="minRestHours"
                label="حداقل استراحت (ساعت)"
                value={data.rules.minRestHours}
                min={0}
                max={36}
              />
              <RuleField
                name="maxWeeklyHours"
                label="حداکثر ساعت هفتگی"
                value={data.rules.maxWeeklyHours}
                min={1}
                max={168}
              />
              <RuleField
                name="maxConsecutiveDays"
                label="حداکثر روزهای پیاپی"
                value={data.rules.maxConsecutiveDays}
                min={1}
                max={7}
              />
              <RuleField
                name="maxNightShifts"
                label="حداکثر شیفت شب"
                value={data.rules.maxNightShifts}
                min={0}
                max={7}
              />
              <RuleField
                name="nightStartHour"
                label="شروع شب (۰ تا ۲۳)"
                value={data.rules.nightStartHour}
                min={0}
                max={23}
              />
              <div className="col-span-full flex flex-wrap items-center justify-between gap-3 border-t border-[#e8f0eb] pt-4">
                <p className="max-w-lg text-xs leading-5 text-[#82968b]">
                  شیفت شب از این ساعت یا پیش از ۰۶:۰۰ شروع می‌شود. ساعت هفتگی بر اساس روز
                  آغاز شیفت محاسبه می‌شود. برای اعمال تغییرات، برنامه را دوباره بسازید.
                </p>
                <button className="btn btn-primary">ذخیرهٔ قوانین</button>
              </div>
            </form>
          </div>
        </section>

        <RotationPatterns data={data} />

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#dce8df] pt-6 text-[11px] text-[#92a69a]">
          <span>شیفت‌یار · {user.organizationName}</span>
          <span>برنامهٔ پیشنهادی را پیش از انتشار بررسی کنید.</span>
        </footer>
      </main>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone: string;
}) {
  const palette: Record<string, string> = {
    green: "bg-[#e7f5eb] text-[#238663]",
    blue: "bg-[#e8f0f9] text-[#5078a4]",
    orange: "bg-[#fff2df] text-[#ae8035]",
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-[#788d83]">{label}</p>
        <span className={`grid size-9 place-items-center rounded-lg ${palette[tone]}`}>
          {icon}
        </span>
      </div>
      <div className="display mt-3 text-3xl font-bold text-[#234d40]">{value}</div>
      <p className="mt-1 text-[11px] text-[#9aad9e]">{detail}</p>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[.15em] text-[#289475]">{eyebrow}</p>
      <h2 className="mt-1 section-title">{title}</h2>
      <p className="mt-1 text-sm text-[#82958c]">{description}</p>
    </div>
  );
}

function RuleField({
  name,
  label,
  value,
  min,
  max,
}: {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={value}
        className="field"
        required
      />
    </div>
  );
}

function SparkleIcon() {
  return <span className="text-xl">✦</span>;
}