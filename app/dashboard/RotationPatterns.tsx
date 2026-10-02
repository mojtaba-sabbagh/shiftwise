import { Trash2 } from "lucide-react";
import { removeRotationPattern } from "@/app/actions";
import { faNumber } from "@/lib/format";
import type { OrganizationData } from "@/lib/data";
import { RotationPatternBuilder } from "./RotationPatternBuilder";

export function RotationPatterns({ data }: { data: OrganizationData }) {
  const shiftNames = new Map(data.shifts.map(shift => [shift.id, shift.name]));
  const label = (token: string) => (token === "off" ? "تعطیل" : shiftNames.get(token) || "شیفت");

  return (
    <section id="rotation" className="mt-10 scroll-mt-6">
      <div className="mb-5">
        <span className="text-sm font-bold text-[#29906e]">۰۵ / ترجیح چرخش</span>
        <h2 className="section-title mt-2">الگوهای چرخش (محدودیت نرم)</h2>
        <p className="mt-2 text-sm leading-7 text-[#71877b]">
          ترتیب دلخواه شیفت‌ها را برای هر نقش تعریف کنید؛ مثلاً صبح ← عصر ← شب ← تعطیل. این الگوها یک
          محدودیت نرم‌اند: تنها پس از تأمین کامل پوشش، رعایت محدودیت‌های سخت و حفظ تعادل ساعت کاری
          اعمال می‌شوند و هیچ جایگاهی را فدا نمی‌کنند.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <h3 className="border-b border-[#e8f0eb] px-6 py-4 text-base font-bold">الگوهای تعریف‌شده</h3>
          {data.rotationPatterns.map(pattern => (
            <div
              key={pattern.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8f0eb] px-6 py-3 last:border-0"
            >
              <div>
                <strong className="text-sm text-[#244b40]">{pattern.name}</strong>
                <span className="badge mr-2 bg-[#edf5ef] text-[#3d775d]">{pattern.roleName}</span>
                <span className="badge mr-2 bg-[#fff0d7] text-[#af7927]">وزن {faNumber(pattern.weight)}</span>
                <p className="mt-1 text-xs text-[#71877b]">{pattern.steps.map(label).join(" ← ")}</p>
              </div>
              <form action={removeRotationPattern}>
                <input type="hidden" name="patternId" value={pattern.id} />
                <button
                  className="btn-link inline-flex items-center gap-1 text-[#aa5e51]"
                  aria-label={`حذف الگوی ${pattern.name}`}
                >
                  <Trash2 size={16} /> حذف
                </button>
              </form>
            </div>
          ))}
          {!data.rotationPatterns.length && (
            <p className="px-6 py-5 text-sm text-[#82968b]">هنوز الگوی چرخشی تعریف نشده است.</p>
          )}
        </div>
        <div className="card p-6">
          <h3 className="text-base font-bold">افزودن الگوی چرخش</h3>
          {data.roles.length && data.shifts.length ? (
            <RotationPatternBuilder roles={data.roles} shifts={data.shifts} />
          ) : (
            <p className="mt-3 text-sm text-[#71877b]">برای تعریف الگو، ابتدا نقش و شیفت بسازید.</p>
          )}
        </div>
      </div>
    </section>
  );
}
