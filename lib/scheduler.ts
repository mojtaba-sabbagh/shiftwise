import { DateTime } from "luxon";

export type Worker = { id: string; name: string; roleIds: string[] };
export type Role = { id: string; name: string; color: string };
export type Shift = { id: string; name: string; startTime: string; endTime: string };
export type Coverage = { id: string; shiftId: string; roleId: string; weekday: number; count: number };
export type TimeOff = { workerId: string; startsAt: string; endsAt: string };
export type Rules = {
  minRestHours: number;
  maxWeeklyHours: number;
  maxConsecutiveDays: number;
  maxNightShifts: number;
  nightStartHour: number;
};
export type Input = {
  weekStart: string;
  timezone: string;
  workers: Worker[];
  roles: Role[];
  shifts: Shift[];
  coverage: Coverage[];
  timeOff: TimeOff[];
  rules: Rules;
};
export type Position = {
  id: string;
  date: string;
  roleId: string;
  shiftId: string;
  startsAt: string;
  endsAt: string;
  startMs: number;
  endMs: number;
  minutes: number;
  night: boolean;
};
export type Assignment = { position: Position; workerId: string };
export type Diagnostic = { positionId: string; message: string };
export type Result = { positions: Position[]; assignments: Assignment[]; uncovered: Diagnostic[] };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function hash(seed: number) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}

export function expandPositions(input: Input): Position[] {
  const week = DateTime.fromISO(input.weekStart, { zone: input.timezone });
  if (!week.isValid || week.weekday !== 6 || week.toISODate() !== input.weekStart) {
    throw new Error("برای آغاز هفته، یک شنبهٔ معتبر انتخاب کنید.");
  }
  if (input.coverage.length > 500 || input.workers.length > 300) {
    throw new Error("این نسخه حداکثر ۵۰۰ قانون پوشش و ۳۰۰ کارمند را برای هر سازمان پشتیبانی می‌کند.");
  }
  const shifts = new Map(input.shifts.map(s => [s.id, s]));
  const positions: Position[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = week.plus({ days: offset });
    for (const demand of input.coverage.filter(c => c.weekday === date.weekday)) {
      const shift = shifts.get(demand.shiftId);
      if (!shift) continue;
      const start = DateTime.fromISO(`${date.toISODate()}T${shift.startTime}`, { zone: input.timezone });
      let end = DateTime.fromISO(`${date.toISODate()}T${shift.endTime}`, { zone: input.timezone });
      if (!start.isValid || !end.isValid) throw new Error("ساعت محلی یکی از شیفت‌ها نامعتبر است.");
      if (end <= start) end = end.plus({ days: 1 });
      const minutes = Math.round(end.diff(start, "minutes").minutes);
      if (minutes <= 0 || minutes > 16 * 60) throw new Error("طول شیفت باید بیش از صفر و حداکثر ۱۶ ساعت باشد.");
      for (let index = 0; index < demand.count; index++) {
        positions.push({
          id: `${date.toISODate()}:${demand.id}:${index}`,
          date: date.toISODate()!, roleId: demand.roleId, shiftId: demand.shiftId,
          startsAt: start.toUTC().toISO()!, endsAt: end.toUTC().toISO()!,
          startMs: start.toMillis(), endMs: end.toMillis(), minutes,
          night: start.hour >= input.rules.nightStartHour || start.hour < 6,
        });
      }
    }
  }
  if (positions.length > 500) throw new Error("این نسخه حداکثر ۵۰۰ جایگاه موردنیاز را در هفته پشتیبانی می‌کند.");
  return positions;
}

function daysAreConsecutive(days: string[], limit: number) {
  const unique = [...new Set(days)].sort();
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    const difference = DateTime.fromISO(unique[i]).diff(DateTime.fromISO(unique[i - 1]), "days").days;
    run = difference === 1 ? run + 1 : 1;
    if (run > limit) return true;
  }
  return false;
}

export function eligible(worker: Worker, position: Position, current: Assignment[], input: Input): boolean {
  if (!worker.roleIds.includes(position.roleId)) return false;
  if (input.timeOff.some(leave => leave.workerId === worker.id &&
    overlaps(position.startMs, position.endMs, Date.parse(leave.startsAt), Date.parse(leave.endsAt)))) return false;
  const own = current.filter(a => a.workerId === worker.id);
  const restMs = input.rules.minRestHours * 3600000;
  if (own.some(a => overlaps(position.startMs - restMs, position.endMs + restMs,
    a.position.startMs, a.position.endMs))) return false;
  if (own.reduce((sum, a) => sum + a.position.minutes, position.minutes) > input.rules.maxWeeklyHours * 60) return false;
  if (position.night && own.filter(a => a.position.night).length >= input.rules.maxNightShifts) return false;
  if (daysAreConsecutive([...own.map(a => a.position.date), position.date], input.rules.maxConsecutiveDays)) return false;
  return true;
}

function objective(assignments: Assignment[], workers: Worker[]) {
  const load = workers.map(w => assignments.filter(a => a.workerId === w.id).reduce((n, a) => n + a.position.minutes, 0));
  const average = load.reduce((a, b) => a + b, 0) / Math.max(1, load.length);
  return load.reduce((a, b) => a + (b - average) ** 2, 0);
}

function tryRepair(missing: Position[], placed: Assignment[], input: Input, domains: Map<string, Worker[]>, random: () => number) {
  for (const position of missing) {
    if (placed.some(a => a.position.id === position.id)) continue;
    const candidates = [...(domains.get(position.id) || [])].sort(() => random() - 0.5);
    for (const worker of candidates) {
      if (eligible(worker, position, placed, input)) {
        placed.push({ position, workerId: worker.id });
        break;
      }
      // Bounded one-move repair: reassign an existing shift, then fill the gap.
      const own = placed.filter(a => a.workerId === worker.id);
      for (const displaced of own) {
        const reduced = placed.filter(a => a !== displaced);
        if (!eligible(worker, position, reduced, input)) continue;
        for (const replacement of domains.get(displaced.position.id) || []) {
          if (replacement.id === worker.id || !eligible(replacement, displaced.position, reduced, input)) continue;
          placed.splice(placed.indexOf(displaced), 1);
          placed.push({ position: displaced.position, workerId: replacement.id }, { position, workerId: worker.id });
          break;
        }
        if (placed.some(a => a.position.id === position.id)) break;
      }
      if (placed.some(a => a.position.id === position.id)) break;
    }
  }
}

export function generate(input: Input): Result {
  const positions = expandPositions(input);
  const domains = new Map(positions.map(position => [position.id,
    input.workers.filter(worker => worker.roleIds.includes(position.roleId) &&
      !input.timeOff.some(leave => leave.workerId === worker.id &&
        overlaps(position.startMs, position.endMs, Date.parse(leave.startsAt), Date.parse(leave.endsAt))))]));
  const ordered = [...positions].sort((a, b) =>
    (domains.get(a.id)!.length - domains.get(b.id)!.length) || (a.startMs - b.startMs));
  let best: Assignment[] = [];
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 64; attempt++) {
    const random = hash(0x9e3779b9 + attempt * 2654435761);
    const placed: Assignment[] = [];
    for (const position of ordered) {
      const available = (domains.get(position.id) || []).filter(w => eligible(w, position, placed, input));
      if (!available.length) continue;
      const ranked = available.map(worker => {
        const own = placed.filter(a => a.workerId === worker.id);
        const minutes = own.reduce((n, a) => n + a.position.minutes, 0);
        const nights = own.filter(a => a.position.night).length;
        return { worker, score: minutes + nights * 90 + random() * (attempt === 0 ? 15 : 720) };
      }).sort((a, b) => a.score - b.score);
      placed.push({ position, workerId: ranked[0].worker.id });
    }
    if (placed.length < positions.length) {
      tryRepair(positions.filter(p => !placed.some(a => a.position.id === p.id)), placed, input, domains, random);
    }
    const score = objective(placed, input.workers);
    if (placed.length > best.length || (placed.length === best.length && score < bestScore)) {
      best = placed;
      bestScore = score;
    }
    if (best.length === positions.length && attempt >= 15) break;
  }
  const assigned = new Set(best.map(a => a.position.id));
  const uncovered = positions.filter(p => !assigned.has(p.id)).map(position => ({
    positionId: position.id,
    message: (domains.get(position.id) || []).length === 0
      ? "کارمند واجد مهارت و در دسترس برای این نقش و شیفت وجود ندارد."
      : "کارمند واجد مهارت وجود دارد، اما محدودیت استراحت، ساعت کار، شیفت شب یا روزهای پیاپی مانع پوشش در این برنامه شده است.",
  }));
  return { positions, assignments: best.sort((a, b) => a.position.startMs - b.position.startMs), uncovered };
}
