import { Plus, Trash2 } from "lucide-react";
import { addShift, removeShift } from "@/app/actions";
import { faNumber } from "@/lib/format";
import type { OrganizationData } from "@/lib/data";
import { ShiftRequirementMatrix } from "./ShiftRequirementMatrix";

const weekdays = [
  { value: 6, label: "شنبه" }, { value: 7, label: "یکشنبه" },
  { value: 1, label: "دوشنبه" }, { value: 2, label: "سه‌شنبه" },
  { value: 3, label: "چهارشنبه" }, { value: 4, label: "پنجشنبه" },
  { value: 5, label: "جمعه" },
];

export function ShiftCoverage({ data }: { data: OrganizationData }) {
  return <section id="coverage" className="mt-10 scroll-mt-6">
    <div className="mb-5">
      <span className="text-sm font-bold text-[#29906e]">۰۲ / نیاز سازمان</span>
        <h2 className="section-title mt-2">شیفت‌ها</h2>
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card overflow-hidden">
        <h3 className="border-b border-[#e8f0eb] px-6 py-4 text-base font-bold">الگوهای شیفت</h3>
        {data.shifts.map(shift => <div key={shift.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8f0eb] px-6 py-3 last:border-0">
          <div><strong className="text-sm text-[#244b40]">{shift.name}</strong><span className="mr-2 text-sm text-[#71877b]">{shift.startTime.slice(0, 5)} تا {shift.endTime.slice(0, 5)}</span></div>
          <form action={removeShift}>
            <input type="hidden" name="shiftId" value={shift.id}/>
            <button className="btn-link inline-flex items-center gap-1 text-[#aa5e51]" aria-label={`حذف شیفت ${shift.name}`}><Trash2 size={16}/> حذف</button>
          </form>
        </div>)}
        {!data.shifts.length && <p className="px-6 py-5 text-sm text-[#82968b]">هنوز شیفتی تعریف نشده است.</p>}
      </div>
      <div className="card p-6">
        <h3 className="text-base font-bold">افزودن شیفت</h3>
        <p className="mt-2 text-sm leading-7 text-[#71877b]">سه شیفت صبح، عصر و شب برای محیط‌های کار جدید پیش‌فرض هستند. تعداد موردنیاز هر روز را از جدول همان روز تنظیم کنید.</p>
        <form action={addShift} className="mt-4 space-y-3">
          <label className="block"><span className="label">نام شیفت</span><input name="name" className="mini-input" placeholder="مثلاً صبح" required maxLength={60}/></label>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">شروع</span><input name="startTime" type="time" className="mini-input" defaultValue="07:00" required/></label>
            <label><span className="label">پایان</span><input name="endTime" type="time" className="mini-input" defaultValue="15:00" required/></label>
          </div>
          <button className="btn btn-dark w-full"><Plus size={15}/> افزودن شیفت</button>
        </form>
        <p className="mt-4 text-sm text-[#71877b]">{faNumber(data.shifts.length)} الگوی شیفت · {faNumber(data.coverage.length)} نیاز ثبت‌شده برای روزها و شیفت‌ها</p>
      </div>
    </div>
    <div className="mb-5">
      <h2 className="section-title mt-2">تعداد تخصص‌ها به تفکیک روز-شیفت</h2>
      <p className="mt-2 text-sm text-[#71877b]">هر روز را باز کنید؛ هر شیفت یک سطر دارد و تعداد افراد موردنیاز هر تخصص در ستون همان نقش ثبت می‌شود.</p>
    </div>
    <div className="space-y-5">
      <div className="space-y-4">
        {weekdays.map((day, index) => {
          const dayCoverage = data.coverage.filter(item => item.weekday === day.value);
          const shiftCount = new Set(dayCoverage.map(item => item.shiftId)).size;
          return <div key={day.value} className="card overflow-hidden">
            <details open={index === 0}>
              <summary className="cursor-pointer px-6 py-5 text-base font-bold text-[#244b40]">
                {day.label} <span className="mr-2 font-normal text-[#71877b]">{faNumber(shiftCount)} شیفت دارای نیاز · {faNumber(dayCoverage.reduce((sum, item) => sum + item.count, 0))} جایگاه</span>
              </summary>
              <div className="min-w-0 border-t border-[#e8f0eb] px-4 py-5 sm:px-6">
                {data.shifts.length && data.roles.length
                  ? <ShiftRequirementMatrix day={day} shifts={data.shifts} roles={data.roles} coverage={dayCoverage}/>
                  : <p className="text-sm text-[#71877b]">برای ثبت نیاز این روز، ابتدا شیفت و تخصص تعریف کنید.</p>}
              </div>
            </details>
          </div>;
        })}
      </div>
    </div>
  </section>;
}
