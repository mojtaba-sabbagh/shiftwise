import Link from "next/link";
import { LayoutGrid, ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { signIn } from "@/app/actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await currentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#eef5f0] px-4 py-12"><div className="w-full max-w-md"><Link href="/" className="mb-10 flex items-center justify-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#176f62] text-white"><LayoutGrid size={19}/></span><span className="display text-2xl font-bold">شیفت‌یار.</span></Link><div className="card p-8 sm:p-10"><p className="text-xs font-bold text-[#1b9275]">نمایندهٔ سازمان</p><h1 className="mt-3 text-3xl font-bold">ورود به محیط کار</h1><p className="mt-2 text-sm text-[#738982]">با اطلاعاتی که مدیر سامانه در اختیارتان گذاشته وارد شوید.</p>{error && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ec] p-3 text-sm text-[#a54835]">{error}</p>}<form action={signIn} className="mt-8 space-y-5"><div><label className="label" htmlFor="email">نشانی ایمیل</label><input id="email" name="email" type="email" autoComplete="email" required className="field" placeholder="you@company.com"/></div><div><label className="label" htmlFor="password">رمز عبور</label><input id="password" name="password" type="password" autoComplete="current-password" required className="field"/></div><button className="btn btn-primary mt-2 w-full py-3.5">ورود <ArrowRight size={16}/></button></form><p className="mt-7 text-center text-sm text-[#778e85]">دسترسی ندارید؟ <Link href="/signup" className="font-bold text-[#147963]">نحوهٔ دریافت دسترسی</Link></p><Link href="/admin/login" className="mt-3 block text-center text-xs font-bold text-[#658b76]">ورود مدیر سامانه</Link></div></div></main>;
}
