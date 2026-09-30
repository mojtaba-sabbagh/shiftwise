import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function Signup() {
  return <main className="grid min-h-screen place-items-center bg-[#eef5f0] px-4 py-12"><div className="card w-full max-w-md p-8 text-center sm:p-10">
    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e7f5eb] text-[#27845b]"><ShieldCheck size={27}/></span>
    <h1 className="mt-6 text-2xl font-bold">دسترسی سازمانی به شیفت‌یار</h1>
    <p className="mt-4 text-sm leading-8 text-[#71877b]">محیط کار هر سازمان را مدیر سامانه ایجاد می‌کند و دسترسی آن را در اختیار نمایندهٔ سازمان قرار می‌دهد. اگر دسترسی دریافت کرده‌اید، وارد شوید.</p>
    <Link href="/login" className="btn btn-primary mt-7 w-full py-3">ورود نمایندهٔ سازمان <ArrowLeft size={16}/></Link>
    <Link href="/" className="mt-5 inline-block text-xs font-bold text-[#54816b]">بازگشت به صفحهٔ اصلی</Link>
  </div></main>;
}
