import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { currentAdmin } from "@/lib/auth";
import { adminSignIn } from "../actions";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#edf4ee] px-4 py-12"><div className="w-full max-w-md">
    <Link href="/" className="mb-8 block text-center text-sm font-bold text-[#43745c]">شیفت‌یار · شرکت هوشمند فناوران برتر ایرانیان</Link>
    <div className="card p-8 sm:p-10"><span className="grid size-12 place-items-center rounded-xl bg-[#e5f2e8] text-[#247752]"><ShieldCheck size={25}/></span>
      <p className="mt-6 text-xs font-bold text-[#22835c]">مدیریت سامانه</p>
      <h1 className="mt-2 text-3xl font-bold">ورود مدیر ارشد</h1>
      <p className="mt-2 text-sm leading-7 text-[#738b7b]">برای مدیریت سازمان‌ها و ایجاد محیط کار وارد شوید.</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ec] p-3 text-sm text-[#a54835]">{error}</p>}
      <form action={adminSignIn} className="mt-8 space-y-5"><div><label htmlFor="email" className="label">ایمیل مدیر ارشد</label><input id="email" name="email" type="email" autoComplete="username" required className="field"/></div><div><label htmlFor="password" className="label">رمز عبور</label><input id="password" name="password" type="password" autoComplete="current-password" required className="field"/></div><button className="btn btn-primary w-full py-3">ورود به پنل <ArrowLeft size={16}/></button></form>
      <Link href="/login" className="mt-7 block text-center text-xs font-bold text-[#54816b]">ورود نمایندهٔ سازمان</Link>
    </div>
  </div></main>;
}
