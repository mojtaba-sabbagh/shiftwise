import { Plus, Trash2 } from "lucide-react";
import { addShift, removeShift, saveShiftStaffing } from "@/app/actions";
import { faNumber } from "@/lib/format";
import type { OrganizationData } from "@/lib/data";

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
      <h2 className="section-title mt-2">شیفت‌ها و تعداد تخصص‌ها</h2>
      <p className="mt-2 text-sm text-[#71877b]">برای هر شیفت و هر روز، تعداد افراد موردنیاز هر تخصص را مشخص کنید. صفر یعنی آن تخصص در آن روز و شیفت نیاز نیست.</p>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        {data.shifts.map((shift, index) => <div key={shift.id} className="card overflow-hidden">
          <details open={index === 0}>
            <summary className="cursor-pointer px-6 py-5 text-base font-bold text-[#244b40]">
              {shift.name} <span className="mr-2 font-normal text-[#71877b]">{shift.startTime.slice(0, 5)} تا {shift.endTime.slice(0, 5)}{shift.endTime <= shift.startTime ? " (روز بعد)" : ""}</span>
            </summary>
            <div className="border-t border-[#e8f0eb] px-6 py-5">
              {data.roles.length ? <form action={saveShiftStaffing}>
                <input type="hidden" name="shiftId" value={shift.id}/>
                <div className="table-wrap">
                  <table className="min-w-[520px]">
                    <thead><tr><th>روز هفته</th>{data.roles.map(role => <th key={role.id} className="text-center">{role.name}</th>)}</tr></thead>
                    <tbody>{weekdays.map(day => <tr key={day.value}>
                      <th scope="row" className="text-right">{day.label}</th>
                      {data.roles.map(role => {
                        const count = data.coverage.find(item => item.weekday === day.value && item.shiftId === shift.id && item.roleId === role.id)?.count ?? 0;
                        return <td key={role.id} className="text-center">
                          <input type="number" name={`need:${day.value}:${role.id}`} min={0} max={50} required
                            aria-label={`تعداد ${role.name} در شیفت ${shift.name} روز ${day.label}`}
                            defaultValue={count} className="mini-input mx-auto w-20 text-center"/>
                        </td>;
                      })}
                    </tr>)}</tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm text-[#71877b]">تغییرات این جدول برای همهٔ هفته‌های آینده اعمال می‌شود. پس از ذخیره، برنامه را دوباره بسازید.</p>
                <button className="btn btn-primary mt-4">ذخیرهٔ تعداد تخصص‌ها</button>
              </form> : <p className="text-sm text-[#71877b]">ابتدا در بخش «تیم و مهارت‌ها» تخصص‌ها را ثبت کنید.</p>}
            </div>
          </details>
          <form action={removeShift} className="border-t border-[#e8f0eb] px-6 py-3">
            <input type="hidden" name="shiftId" value={shift.id}/>
            <button className="btn-link inline-flex items-center gap-2 text-[#aa5e51]" aria-label={`حذف شیفت ${shift.name}`}>
              <Trash2 size={16}/> حذف شیفت از برنامه‌های آینده
            </button>
          </form>
        </div>)}
        {!data.shifts.length && <div className="card p-8 text-center text-sm text-[#82968b]">هنوز شیفت فعالی ثبت نشده است. از فرم روبه‌رو یک شیفت اضافه کنید.</div>}
      </div>
      <div className="card h-fit p-6">
        <h3 className="text-base font-bold">افزودن شیفت</h3>
        <p className="mt-2 text-sm leading-7 text-[#71877b]">سه شیفت صبح، عصر و شب هنگام ایجاد محیط کار به‌صورت پیش‌فرض ساخته می‌شوند. می‌توانید شیفت دیگری اضافه کنید.</p>
        <form action={addShift} className="mt-4 space-y-3">
          <label className="block"><span className="label">نام شیفت</span><input name="name" className="mini-input" placeholder="مثلاً صبح" required maxLength={60}/></label>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">شروع</span><input name="startTime" type="time" className="mini-input" defaultValue="07:00" required/></label>
            <label><span className="label">پایان</span><input name="endTime" type="time" className="mini-input" defaultValue="15:00" required/></label>
          </div>
          <button className="btn btn-dark w-full"><Plus size={15}/> افزودن شیفت</button>
        </form>
        <p className="mt-4 text-sm text-[#71877b]">{faNumber(data.shifts.length)} شیفت فعال · {faNumber(data.coverage.length)} نیاز ثبت‌شده</p>
      </div>
    </div>
  </section>;
}
