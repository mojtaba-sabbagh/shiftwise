"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addRotationPattern } from "@/app/actions";

type RoleOption = { id: string; name: string };
type ShiftOption = { id: string; name: string; startTime: string; endTime: string };

const OFF = "off";
// Must match ALL_ROLES in app/actions.ts; selecting this applies one cycle to
// every role of the organization at once.
const ALL_ROLES_SENTINEL = "__all__";

// Builds the ordered cycle by clicking shift buttons in sequence; the token
// "off" is a rest day. The whole sequence is submitted as a JSON hidden field.
export function RotationPatternBuilder({ roles, shifts }: { roles: RoleOption[]; shifts: ShiftOption[] }) {
  const [steps, setSteps] = useState<string[]>([]);
  const shiftName = new Map(shifts.map(shift => [shift.id, shift.name]));
  const label = (token: string) => (token === OFF ? "تعطیل" : shiftName.get(token) || "شیفت");

  return (
    <form action={addRotationPattern} className="mt-4 space-y-3">
      <label className="block">
        <span className="label">نقش</span>
        <select name="roleId" className="mini-input" required defaultValue="">
          <option value="" disabled>
            انتخاب نقش
          </option>
          <option value={ALL_ROLES_SENTINEL}>همه نقش‌ها</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="label">نام الگو</span>
          <input name="name" className="mini-input" placeholder="مثلاً چرخش صبح‌عصر‌شب" required maxLength={60} />
        </label>
        <label>
          <span className="label">وزن (۱ تا ۱۰)</span>
          <input name="weight" type="number" min={1} max={10} defaultValue={3} className="mini-input" required />
        </label>
      </div>
      <div>
        <span className="label">گام‌های چرخش (به ترتیب بزنید)</span>
        <div className="flex flex-wrap gap-1.5">
          {shifts.map(shift => (
            <button
              type="button"
              key={shift.id}
              onClick={() => setSteps(current => [...current, shift.id])}
              className="badge bg-[#edf5ef] text-[#3d775d]"
            >
              {shift.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSteps(current => [...current, OFF])}
            className="badge bg-[#fff0d7] text-[#af7927]"
          >
            تعطیل
          </button>
        </div>
      </div>
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-[#dfeae3] p-2">
        {steps.length ? (
          steps.map((token, index) => (
            <button
              type="button"
              key={`${token}-${index}`}
              onClick={() => setSteps(current => current.filter((_, i) => i !== index))}
              className="badge bg-[#e8f0f9] text-[#5078a4]"
              title="حذف این گام"
            >
              {label(token)} ✕
            </button>
          ))
        ) : (
          <span className="text-xs text-[#9caea3]">هنوز گامی اضافه نشده است.</span>
        )}
      </div>
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <p className="text-xs leading-5 text-[#879b91]">
        الگو یک چرخه است؛ پس از آخرین گام دوباره از گام نخست ادامه می‌یابد. این ترجیح فقط پس از تأمین
        پوشش و محدودیت‌های سخت اعمال می‌شود.
      </p>
      <button className="btn btn-dark w-full" disabled={steps.length < 2}>
        <Plus size={15} /> ذخیرهٔ الگو
      </button>
    </form>
  );
}
