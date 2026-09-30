"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toggleWorker } from "@/app/actions";
import { faNumber } from "@/lib/format";

type WorkerRow = { id: string; name: string; roleIds: string[]; active: boolean };
type Role = { id: string; name: string };

const PER_PAGE = 10;

export function WorkersTable({ workers, roles }: { workers: WorkerRow[]; roles: Role[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const roleNames = new Map(roles.map(role => [role.id, role.name]));
  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? workers.filter(worker => worker.name.toLowerCase().includes(trimmed))
    : workers;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const items = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const first = total ? (currentPage - 1) * PER_PAGE + 1 : 0;
  const last = Math.min(currentPage * PER_PAGE, total);
  const pageStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => pageStart + index);

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <label className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-[#d8e6e0] bg-white px-3 focus-within:border-[#168a75]">
        <span className="sr-only">جستجوی نام کارمند</span>
        <Search size={18} aria-hidden="true" className="shrink-0 text-[#81968d]"/>
        <input type="search" value={query} autoComplete="off"
          onChange={event => { setQuery(event.target.value); setPage(1); }}
          placeholder="جستجوی نام کارمند"
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none"/>
      </label>
      <p role="status" className="text-sm text-[#71877b]">
        نمایش {faNumber(first)} تا {faNumber(last)} از {faNumber(total)} نفر
      </p>
    </div>
    <div className="table-wrap">
      <table>
        <thead><tr><th>نام</th><th>نقش‌های مجاز</th><th>وضعیت</th><th></th></tr></thead>
        <tbody>
          {items.map(worker => <tr key={worker.id}>
            <td className="font-semibold">{worker.name}</td>
            <td>{worker.roleIds.map(id => roleNames.get(id)).filter(Boolean).join(", ")}</td>
            <td>
              <span className={`badge ${worker.active ? "bg-[#e9f7ee] text-[#2f8a65]" : "bg-[#f0f2f0] text-[#89958c]"}`}>
                {worker.active ? "فعال" : "غیرفعال"}
              </span>
            </td>
            <td>
              <form action={toggleWorker}>
                <input type="hidden" name="workerId" value={worker.id}/>
                <button className="btn-link">{worker.active ? "غیرفعال‌سازی" : "فعال‌سازی"}</button>
              </form>
            </td>
          </tr>)}
          {!total && <tr><td colSpan={4} className="py-9 text-center text-[#98aaa0]">
            {trimmed ? "کارمندی با این نام پیدا نشد." : "هنوز کارمندی ثبت نشده است."}
          </td></tr>}
        </tbody>
      </table>
    </div>
    {totalPages > 1 && <nav aria-label="صفحه‌بندی کارکنان"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6efea] px-6 py-4">
      <span className="text-sm text-[#71877b]">صفحهٔ {faNumber(currentPage)} از {faNumber(totalPages)}</span>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" aria-label="صفحهٔ قبل" disabled={currentPage === 1}
          onClick={() => setPage(currentPage - 1)}
          className="btn btn-light px-2 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronRight size={17}/>
        </button>
        {pages.map(number => <button key={number} type="button"
          aria-label={`صفحهٔ ${faNumber(number)}`}
          aria-current={number === currentPage ? "page" : undefined}
          onClick={() => setPage(number)}
          className={`btn px-3 ${number === currentPage ? "btn-primary" : "btn-light"}`}>
          {faNumber(number)}
        </button>)}
        <button type="button" aria-label="صفحهٔ بعد" disabled={currentPage === totalPages}
          onClick={() => setPage(currentPage + 1)}
          className="btn btn-light px-2 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft size={17}/>
        </button>
      </div>
    </nav>}
  </>;
}