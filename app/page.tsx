import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, CalendarDays, Check, CheckCircle2, Clock3, FileDown, Menu, ShieldCheck, Sparkles, Users2 } from "lucide-react";
import { currentUser } from "@/lib/auth";
import styles from "./home.module.css";

const days = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه"];
const team = [
  { name: "علی رضایی", role: "اپراتور", shifts: ["صبح", "صبح", "—", "عصر", "صبح"] },
  { name: "سارا محمدی", role: "سرپرست", shifts: ["عصر", "عصر", "صبح", "—", "عصر"] },
  { name: "مریم احمدی", role: "اپراتور", shifts: ["—", "شب", "شب", "صبح", "صبح"] },
  { name: "رضا کریمی", role: "اپراتور", shifts: ["صبح", "—", "عصر", "عصر", "شب"] },
];
const shiftStyles: Record<string, string> = { "صبح": styles.morning, "عصر": styles.evening, "شب": styles.night, "—": styles.empty };
const features = [
  { icon: Users2, number: "۰۱", title: "تیم و مهارت‌ها، یک‌جا", description: "اعضای تیم، نقش‌ها و مهارت‌هایشان را تعریف کنید تا هر شیفت به فرد مناسب سپرده شود." },
  { icon: ShieldCheck, number: "۰۲", title: "قوانین در دل برنامه", description: "مرخصی، فاصلهٔ استراحت و محدودیت ساعت کار را در زمان برنامه‌ریزی لحاظ کنید." },
  { icon: CalendarDays, number: "۰۳", title: "تصویر روشن از هفته", description: "پوشش شیفت‌ها و کمبودها را ببینید، برنامه را مرور کنید و خروجی بگیرید." },
];

export default async function Home() {
  const user = await currentUser();
  const workHref = user ? (user.mustChangePassword ? "/change-password" : "/dashboard") : "/login";
  return (
    <div className={styles.page}>
      <header className={styles.header}><div className={styles.container}>
        <nav className={styles.nav} aria-label="ناوبری اصلی">
          <Link href="/" className={styles.brand} aria-label="شیفت‌یار، صفحهٔ اصلی">
            <span className={styles.brandLogo}><Image src="/logo-full.png" alt="لوگوی شرکت هوشمند فناوران برتر ایرانیان" width={1136} height={736} priority /></span>
            <span className={styles.brandText}><strong>شیفت‌یار</strong><small>شرکت هوشمند فناوران برتر ایرانیان</small></span>
          </Link>
          <div className={styles.navLinks}><a href="#features">امکانات</a><a href="#how-it-works">نحوهٔ کار</a></div>
          <div className={styles.navActions}><Link href="/admin/login" className={styles.loginLink}>مدیر سامانه</Link><Link href={workHref} className={styles.navCta}>{user ? "محیط کار" : "ورود سازمانی"}<ArrowUpLeft size={16} /></Link></div>
        </nav>
      </div></header>
      <main>
        <section className={styles.hero}><div className={styles.container + " " + styles.heroGrid}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span className={styles.eyebrowDot} />راهکار هوشمند برنامه‌ریزی شیفت</div>
            <h1>برنامه‌ریزی شیفت،<br /><span>با خیال راحت.</span></h1>
            <p className={styles.heroDescription}>از چیدمان نیروها تا بررسی پوشش هر شیفت، همه‌چیز را در یک فضای ساده و روشن مدیریت کنید. زمان کمتری صرف هماهنگی کنید و با اطمینان بیشتری برای تیم تصمیم بگیرید.</p>
            <div className={styles.heroActions}><Link href={workHref} className={styles.primaryButton}>ورود به محیط کار<ArrowLeft size={19} /></Link><a href="#how-it-works" className={styles.textButton}>آشنایی با سامانه <ArrowLeft size={17} /></a></div>
            <div className={styles.heroNotes}><span><CheckCircle2 size={17} /> متناسب با مهارت‌ها</span><span><CheckCircle2 size={17} /> با در نظر گرفتن استراحت</span></div>
          </div>
          <div className={styles.heroVisual} aria-label="نمای نمونهٔ برنامهٔ هفتگی شیفت‌ها">
            <div className={styles.orbitOne} /><div className={styles.orbitTwo} />
            <div className={styles.previewCard}>
              <div className={styles.previewTop}><div className={styles.previewHeading}><span className={styles.previewIcon}><CalendarDays size={22} /></span><div><span className={styles.previewOverline}>نگاهی به محیط کار</span><h2>برنامهٔ هفتگی تیم</h2></div></div><span className={styles.previewMenu}><Menu size={19} /></span></div>
              <div className={styles.previewBody}>
                <div className={styles.previewSummary}><div><span className={styles.weekLabel}>هفتهٔ نمونه</span><strong>یک هفته، یک برنامهٔ روشن</strong></div><span className={styles.readyPill}><Check size={14} /> آمادهٔ بررسی</span></div>
                <div className={styles.scheduleScroller}><div className={styles.schedule}>
                  <div className={styles.scheduleRow + " " + styles.scheduleHead}><span>اعضای تیم</span>{days.map(day => <span key={day}>{day}</span>)}</div>
                  {team.map(person => <div className={styles.scheduleRow} key={person.name}><span className={styles.person}><span className={styles.avatar}>{person.name.charAt(0)}</span><span><b>{person.name}</b><small>{person.role}</small></span></span>{person.shifts.map((shift, index) => <span key={index}><span className={styles.shift + " " + shiftStyles[shift]}>{shift}</span></span>)}</div>)}
                </div></div>
                <div className={styles.previewBottom}><span><span className={styles.statusDot} /> پوشش شیفت‌ها در یک نگاه</span><span><FileDown size={16} /> خروجی برنامه</span></div>
              </div>
            </div>
            <div className={styles.floatingCard}><span className={styles.floatingIcon}><Sparkles size={20} /></span><span><strong>برنامه‌ریزی دقیق‌تر</strong><small>با توجه به نیاز واقعی تیم</small></span></div>
          </div>
        </div></section>
        <section className={styles.trustStrip} aria-label="ویژگی‌های کلیدی"><div className={styles.container}><span><CheckCircle2 size={19} /> پوشش قابل بررسی</span><span><Clock3 size={19} /> زمان‌بندی منظم</span><span><ShieldCheck size={19} /> رعایت محدودیت‌ها</span><span><Users2 size={19} /> مناسب تیم‌های شیفتی</span></div></section>
        <section id="features" className={styles.features}><div className={styles.container}>
          <div className={styles.sectionIntro}><div><span className={styles.sectionKicker}>امکانات شیفت‌یار</span><h2>همهٔ جزئیات مهم،<br /><span>در یک مسیر ساده.</span></h2></div><p>اطلاعات تیم و نیازهای کاری را یک‌جا جمع کنید تا برنامه‌ای بسازید که هم خوانا باشد و هم قابل بررسی.</p></div>
          <div className={styles.featureGrid}>{features.map(feature => <article className={styles.featureCard} key={feature.number}><div className={styles.featureTop}><span className={styles.featureIcon}><feature.icon size={26} strokeWidth={1.7} /></span><span className={styles.featureNumber}>{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.description}</p></article>)}</div>
        </div></section>
        <section id="how-it-works" className={styles.process}><div className={styles.container + " " + styles.processGrid}><div><span className={styles.processKicker}>از شروع تا برنامهٔ آماده</span><h2>سه قدم تا یک هفتهٔ<br />منظم‌تر برای تیم شما</h2><p>بدون پیچیدگی‌های معمول، اطلاعات موردنیاز را ثبت کنید و نتیجه را به‌روشنی ببینید.</p><Link href={workHref} className={styles.processLink}>شروع برنامه‌ریزی <ArrowLeft size={17} /></Link></div><div className={styles.steps}><div><span>۱</span><div><h3>تیم را بشناسید</h3><p>افراد، نقش‌ها و مهارت‌هایشان را اضافه کنید.</p></div></div><div><span>۲</span><div><h3>نیاز هر شیفت را مشخص کنید</h3><p>الگوی شیفت‌ها، ظرفیت و محدودیت‌های کاری را تعریف کنید.</p></div></div><div><span>۳</span><div><h3>برنامه را بسازید و بررسی کنید</h3><p>پوشش هفته را ببینید و برای استفاده خروجی بگیرید.</p></div></div></div></div></section>
        <section className={styles.finalSection}><div className={styles.container}><div className={styles.finalCard}><div><span>وقت برنامه‌ریزی بهتر است</span><h2>هفتهٔ بعد را با اطمینان بیشتری شروع کنید.</h2><p>پس از دریافت دسترسی از مدیر سامانه، برنامهٔ شیفت تیم‌تان را بسازید.</p></div><Link href={workHref} className={styles.finalButton}>ورود به شیفت‌یار<ArrowLeft size={18} /></Link></div></div></section>
      </main>
      <footer className={styles.footer}><div className={styles.container}><div className={styles.footerBrand}><span className={styles.footerLogo}><Image src="/logo-full.png" alt="" width={1136} height={736} /></span><span><strong>شیفت‌یار</strong><small>محصول شرکت هوشمند فناوران برتر ایرانیان</small></span></div><span className={styles.footerTagline}>برنامه‌ریزی روشن برای تیم‌های پرتلاش.</span></div></footer>
    </div>
  );
}
