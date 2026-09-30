"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { faDate, faNumber } from "@/lib/format";
import { addDays, jalaliMonthLength, jalaliMonthStart, jalaliMonthTitle, saturdayIndex } from "@/lib/jalali";
import styles from "./jalali-date-picker.module.css";

const weekdays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export function JalaliDatePicker({
  id, name, todayIso, defaultValue = "", saturdaysOnly = false,
}: {
  id: string; name: string; todayIso: string; defaultValue?: string; saturdaysOnly?: boolean;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const [view, setView] = useState(() => jalaliMonthStart(defaultValue || todayIso));
  const [open, setOpen] = useState(false);
  const offset = saturdayIndex(view);
  const length = jalaliMonthLength(view);
  const choose = (iso: string) => { setSelected(iso); setOpen(false); };
  const jumpToToday = () => {
    const target = saturdaysOnly ? addDays(todayIso, -saturdayIndex(todayIso)) : todayIso;
    setView(jalaliMonthStart(target));
    choose(target);
  };

  return <div className={styles.root}>
    <input type="hidden" name={name} value={selected}/>
    <button id={id} type="button" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(!open)}>
      <span className={selected ? styles.value : styles.placeholder}>{selected ? faDate(selected) : "انتخاب تاریخ شمسی"}</span>
      <CalendarDays size={18} aria-hidden="true"/>
    </button>
    {open && <div role="dialog" aria-label="انتخاب تاریخ شمسی" className={styles.popover}
      onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
      <div className={styles.header}>
        <button type="button" aria-label="ماه قبل" onClick={() => setView(jalaliMonthStart(addDays(view, -1)))}><ChevronRight size={19}/></button>
        <strong>{jalaliMonthTitle(view)}</strong>
        <button type="button" aria-label="ماه بعد" onClick={() => setView(jalaliMonthStart(addDays(view, length)))}><ChevronLeft size={19}/></button>
      </div>
      <div className={styles.grid}>
        {weekdays.map((day, index) => <span key={index} className={styles.weekday}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`}/>)}
        {Array.from({ length }, (_, index) => {
          const iso = addDays(view, index);
          const disabled = saturdaysOnly && saturdayIndex(iso) !== 0;
          return <button type="button" key={iso} disabled={disabled} aria-label={faDate(iso)}
            aria-pressed={selected === iso} onClick={() => choose(iso)}
            className={selected === iso ? styles.selected : iso === todayIso ? styles.today : styles.day}>
            {faNumber(index + 1)}
          </button>;
        })}
      </div>
      <div className={styles.footer}>
        <button type="button" onClick={jumpToToday}>{saturdaysOnly ? "شنبهٔ این هفته" : "امروز"}</button>
        <button type="button" onClick={() => setOpen(false)}>بستن</button>
      </div>
    </div>}
  </div>;
}
