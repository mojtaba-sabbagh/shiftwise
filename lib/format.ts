export const weekdays = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه", "یکشنبه"];
export const faNumber = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
export function faDate(isoDate: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year:"numeric", month:"long", day:"numeric", timeZone:"UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
}
export function faDateTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", timeZone:timezone }).format(new Date(iso));
}
