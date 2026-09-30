"use client";

import { useState } from "react";
import { CircleHelp, Minus, Plus, Save } from "lucide-react";
import { saveShiftDayStaffing } from "@/app/actions";
import { faNumber } from "@/lib/format";
import type { Coverage, Role, Shift } from "@/lib/scheduler";
import styles from "./shift-requirement-matrix.module.css";

type Day = { value: number; label: string };
type Props = { day: Day; shifts: Shift[]; roles: Role[]; coverage: Coverage[] };

function cellKey(shiftId: string, roleId: string) { return `${shiftId}:${roleId}`; }

function CountStepper({ value, name, label, formId, onChange }: {
  value: string; name: string; label: string; formId?: string; onChange: (value: string) => void;
}) {
  const number = Number(value || 0);
  return <div className={styles.stepper}>
    <button type="button" aria-label={`کم کردن ${label}`} disabled={number <= 0}
      onClick={() => onChange(String(Math.max(0, number - 1)))}><Minus size={16}/></button>
    <input type="number" name={name} form={formId} min={0} max={50} required
      aria-label={label} value={value} onChange={event => {
        const next = event.target.value;
        if (next === "" || (/^\d{1,2}$/.test(next) && Number(next) <= 50)) onChange(next);
      }}/>
    <button type="button" aria-label={`افزودن ${label}`} disabled={number >= 50}
      onClick={() => onChange(String(Math.min(50, number + 1)))}><Plus size={16}/></button>
  </div>;
}

export function ShiftRequirementMatrix({ day, shifts, roles, coverage }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    coverage.map(item => [cellKey(item.shiftId, item.roleId), String(item.count)]),
  ));
  const current = (shiftId: string, roleId: string) => values[cellKey(shiftId, roleId)] ?? "0";
  const change = (shiftId: string, roleId: string, value: string) =>
    setValues(previous => ({ ...previous, [cellKey(shiftId, roleId)]: value }));
  const total = (shiftId: string) => roles.reduce((sum, role) => sum + Number(current(shiftId, role.id) || 0), 0);
  const label = (shift: Shift, role: Role) => `تعداد ${role.name} در شیفت ${shift.name} روز ${day.label}`;
  const formId = (shift: Shift) => `staffing-${day.value}-${shift.id}`;

  return <>
    <div className={styles.hint}>
      <span>تعداد نیروی موردنیاز در هر شیفت</span>
      <span title="صفر یعنی این تخصص در این شیفت نیاز نیست. اگر همهٔ تعدادها صفر باشند، شیفت در این روز اجرا نمی‌شود."
        aria-label="صفر یعنی این تخصص در این شیفت نیاز نیست. اگر همهٔ تعدادها صفر باشند، شیفت در این روز اجرا نمی‌شود."
        tabIndex={0} className={styles.help}><CircleHelp size={18}/></span>
    </div>

    <div className={styles.desktop}>
      {shifts.map(shift => <form key={shift.id} id={formId(shift)} action={saveShiftDayStaffing}>
        <input type="hidden" name="weekday" value={day.value}/>
        <input type="hidden" name="shiftId" value={shift.id}/>
      </form>)}
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead><tr>
            <th scope="col" className={styles.shiftColumn}>شیفت و ساعت</th>
            {roles.map(role => <th scope="col" key={role.id}>{role.name}</th>)}
            <th scope="col" className={styles.totalColumn}>جمع کل</th>
            <th scope="col" className={styles.actionColumn}>ثبت</th>
          </tr></thead>
          <tbody>{shifts.map((shift, index) => <tr key={shift.id} className={index % 2 ? styles.altRow : undefined}>
            <th scope="row" className={`${styles.shiftColumn} ${styles[`tone${index % 3}`]}`}>
              <strong>{shift.name}</strong>
              <span>{shift.startTime.slice(0, 5)} تا {shift.endTime.slice(0, 5)}{shift.endTime <= shift.startTime ? " · روز بعد" : ""}</span>
            </th>
            {roles.map(role => <td key={role.id}>
              <CountStepper name={`need:${role.id}`} formId={formId(shift)}
                label={label(shift, role)} value={current(shift.id, role.id)}
                onChange={value => change(shift.id, role.id, value)}/>
            </td>)}
            <td className={styles.totalColumn}><strong aria-live="polite">{faNumber(total(shift.id))} نفر</strong></td>
            <td className={styles.actionColumn}>
              <button type="submit" form={formId(shift)} className={styles.saveButton}
                aria-label={`ذخیرهٔ نیاز شیفت ${shift.name} در ${day.label}`}><Save size={16}/> ذخیره</button>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>

    <div className={styles.mobile}>
      {shifts.map((shift, index) => <form key={shift.id} action={saveShiftDayStaffing} className={styles.mobileCard}>
        <input type="hidden" name="weekday" value={day.value}/>
        <input type="hidden" name="shiftId" value={shift.id}/>
        <div className={`${styles.mobileHeader} ${styles[`tone${index % 3}`]}`}>
          <div><strong>شیفت {shift.name}</strong><span>{shift.startTime.slice(0, 5)} تا {shift.endTime.slice(0, 5)}</span></div>
          <b aria-live="polite">{faNumber(total(shift.id))} نفر</b>
        </div>
        <div className={styles.mobileRoles}>{roles.map(role => <div key={role.id} className={styles.mobileRole}>
          <span>{role.name}</span>
          <CountStepper name={`need:${role.id}`} label={label(shift, role)}
            value={current(shift.id, role.id)} onChange={value => change(shift.id, role.id, value)}/>
        </div>)}</div>
        <button type="submit" className={styles.saveButton}><Save size={16}/> ذخیرهٔ شیفت {shift.name}</button>
      </form>)}
    </div>
  </>;
}
