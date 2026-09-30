const numeric = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
});
const monthTitle = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric", month: "long", timeZone: "UTC",
});

function latinDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, digit => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660);
  });
}
function asDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Invalid ISO date");
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error("Invalid ISO date");
  return date;
}
export function addDays(iso: string, days: number) {
  const date = asDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function jalaliParts(iso: string) {
  const parts = numeric.formatToParts(asDate(iso));
  const number = (type: string) => Number(latinDigits(parts.find(part => part.type === type)!.value));
  return { year: number("year"), month: number("month"), day: number("day") };
}
export function jalaliMonthTitle(iso: string) { return monthTitle.format(asDate(iso)); }
export function jalaliMonthStart(iso: string) {
  const { day } = jalaliParts(iso);
  return addDays(iso, 1 - day);
}
export function jalaliMonthLength(start: string) {
  const first = jalaliParts(start);
  let length = 1;
  while (length < 32) {
    const next = jalaliParts(addDays(start, length));
    if (next.month !== first.month || next.year !== first.year) return length;
    length++;
  }
  throw new Error("Invalid Jalali month");
}
export function saturdayIndex(iso: string) { return (asDate(iso).getUTCDay() + 1) % 7; }
