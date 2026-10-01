"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { faNumber } from "@/lib/format";
import { addDays, jalaliParts, saturdayIndex  } from "@/lib/jalali";
import { rosterPage } from "@/lib/roster-page";

type WorkerRow = { id: string; name: string; roles: string[] };
type Assignment = { workerId: string; date: string; shiftId: string; shiftName: string; roleName: string };
const weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

export function RosterTable({ weekStart, workers, assignments }: {
  weekStart: string; workers: WorkerRow[]; assignments: Assignment[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { items, total, totalPages, currentPage } = rosterPage(workers, query, page);
  const dates = weekdays.map((label, index) => ({ label, iso: addDays(weekStart, index) }));
  const first = total ? (currentPage - 1) * 10 + 1 : 0;
  const last = Math.min(currentPage * 10, total);
  const pageStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => pageStart + index);

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <label className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-[#d8e6e0] bg-white px-3 focus-within:border-[#168a75]">
        <span className="sr-only">جستجوی نام کارمند در برنامهٔ هفتگی</span>
        <Search size={18} aria-hidden="true" className="shrink-0 text-[#81968d]"/>
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}
          placeholder="جستجوی نام کارمند" className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none" autoComplete="off"/>
      </label>
      <p role="status" className="text-sm text-[#71877b]">نمایش {faNumber(first)} تا {faNumber(last)} از {faNumber(total)} نفر</p>
    </div>
    <div className="table-wrap">
      <table className="min-w-[760px]">
        <thead><tr><th>کارمند</th>{dates.map(day => <th key={day.iso} className="text-center">
          {day.label}<span className="mt-1 block text-base font-bold tracking-normal text-[#3f675c]">{faNumber(jalaliParts(day.iso).day)}</span>
        </th>)}</tr></thead>
        <tbody>{items.map(worker => <tr key={worker.id}>
          <td className="min-w-[140px] font-bold text-[#244b40]">{worker.name}
            <span className="mt-0.5 block text-[10px] font-normal text-[#96a79f]">{worker.roles.join("، ")}</span>
          </td>
          {dates.map(day => <td key={day.iso} className="min-w-[89px] p-2 text-center">
            {assignments.filter(item => item.workerId === worker.id && item.date === day.iso).map((item, index) =>
              <div key={`${item.shiftId}:${index}`} className="mb-1 rounded-lg bg-[#e8f4ed] px-1.5 py-1.5 text-[10px] font-semibold text-[#267e62]">
                <span className="block">{item.shiftName}</span><span className="block opacity-70">{item.roleName}</span>
              </div>)}
          </td>)}
        </tr>)}
        {!total && <tr><td colSpan={8} className="py-9 text-center text-[#82968b]">{query.trim() ? "کارمندی با این نام در برنامه پیدا نشد." : "هنوز کارمندی در این برنامه قرار نگرفته است."}</td></tr>}
        </tbody>
      </table>
    </div>
    {totalPages > 1 && <nav aria-label="صفحه‌بندی برنامهٔ هفتگی" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6efea] px-6 py-4">
      <span className="text-sm text-[#71877b]">صفحهٔ {faNumber(currentPage)} از {faNumber(totalPages)}</span>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" aria-label="صفحهٔ قبل" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="btn btn-light px-2 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={17}/></button>
        {pages.map(number => <button key={number} type="button" aria-label={`صفحهٔ ${faNumber(number)}`} aria-current={number === currentPage ? "page" : undefined}
          onClick={() => setPage(number)} className={`btn px-3 ${number === currentPage ? "btn-primary" : "btn-light"}`}>{faNumber(number)}</button>)}
        <button type="button" aria-label="صفحهٔ بعد" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="btn btn-light px-2 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={17}/></button>
      </div>
    </nav>}
  </>;
}
