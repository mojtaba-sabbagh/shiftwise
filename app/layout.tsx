import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "شیفت‌یار | شرکت هوشمند فناوران برتر ایرانیان",
  description: "شیفت‌یار، راهکار برنامه‌ریزی شیفت شرکت هوشمند فناوران برتر ایرانیان؛ مدیریت تیم، نیاز شیفت و پوشش برنامهٔ هفتگی.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
