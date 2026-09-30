import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { changePassword, signOut } from "@/app/actions";

export default async function ChangePassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/dashboard");
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#eef5f0] px-4 py-12"><div className="card w-full max-w-md p-8 sm:p-10">
    <span className="grid size-12 place-items-center rounded-xl bg-[#e7f5eb] text-[#27845b]"><KeyRound size={24}/></span>
    <h1 className="mt-5 text-2xl font-bold">انتخاب رمز عبور جدید</h1>
    <p className="mt-3 text-sm leading-7 text-[#738982]">دسترسی شما به محیط کار {user.organizationName} ایجاد شده است. پیش از شروع، رمز موقت را تغییر دهید.</p>
    {error && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ec] p-3 text-sm text-[#a54835]">{error}</p>}
    <form action={changePassword} className="mt-7 space-y-4"><div><label className="label" htmlFor="currentPassword">رمز موقت</label><input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" className="field" required/></div><div><label className="label" htmlFor="newPassword">رمز جدید · حداقل ۱۲ نویسه</label><input id="newPassword" name="newPassword" type="password" autoComplete="new-password" className="field" required minLength={12} maxLength={256}/></div><button className="btn btn-primary w-full py-3">ذخیرهٔ رمز و ورود</button></form>
    <form action={signOut} className="mt-5 text-center"><button className="text-xs font-bold text-[#668879]">خروج از حساب</button></form>
  </div></main>;
}
