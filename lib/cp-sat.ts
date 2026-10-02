import { randomInt } from "node:crypto";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { DateTime } from "luxon";
import { expandPositions, type Assignment, type Input, type Result } from "./scheduler";

export type CpSatResult = Result & { algorithm: "CP-SAT"; evaluations: number; seed: number };

type SolverOutput = { assignments: [number, number][]; evaluations: number };

function runSolver(data: object): Promise<SolverOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ process.env.SHIFTWISE_PYTHON || "python", [join(process.cwd(), "lib", "cp_sat.py")], {
      stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    });
    let stdout = "", stderr = "";
    const timeout = setTimeout(() => child.kill(), 25000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => { clearTimeout(timeout); reject(error); });
    child.on("close", code => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`CP-SAT: ${stderr.trim() || `solver exited with code ${code}`}`));
      try { resolve(JSON.parse(stdout) as SolverOutput); }
      catch { reject(new Error("CP-SAT returned an invalid response.")); }
    });
    child.stdin.on("error", error => reject(error));
    child.stdin.end(JSON.stringify(data));
  });
}

export async function generateWithCpSat(input: Input, suppliedSeed?: number): Promise<CpSatResult> {
  const positions = expandPositions(input);
  const seed = suppliedSeed ?? randomInt(1, 0x7fffffff);
  const dates = Array.from({ length: 7 }, (_, i) => DateTime.fromISO(input.weekStart, { zone: input.timezone }).plus({ days: i }).toISODate()!);
  const patterns = (input.patterns ?? []).filter(p => p.steps.length >= 2);
  const payload = {
    positions: positions.map(position => ({
      startMs: position.startMs, endMs: position.endMs, date: position.date,
      minutes: position.minutes, night: position.night, shiftId: position.shiftId,
      eligible: input.workers.flatMap((worker, i) =>
        worker.roleIds.includes(position.roleId) && !input.timeOff.some(leave =>
          leave.workerId === worker.id && position.startMs < Date.parse(leave.endsAt) && Date.parse(leave.startsAt) < position.endMs)
          ? [i] : []),
    })),
    workers: input.workers.map(worker => worker.id), rules: input.rules, dates, seed,
    patterns: patterns.map(p => ({ weight: p.weight, steps: p.steps })),
    // For each worker, the indexes (into `patterns`) of the cycles their roles define.
    workerPatterns: input.workers.map(worker =>
      patterns.flatMap((pattern, index) => worker.roleIds.includes(pattern.roleId) ? [index] : [])),
  };
  const solved = await runSolver(payload);
  const assignments: Assignment[] = solved.assignments.map(([p, w]) => ({ position: positions[p], workerId: input.workers[w].id }))
    .sort((a, b) => a.position.startMs - b.position.startMs);
  const assigned = new Set(assignments.map(item => item.position.id));
  const uncovered = positions.filter(position => !assigned.has(position.id)).map(position => ({
    positionId: position.id,
    message: payload.positions[positions.indexOf(position)].eligible.length === 0
      ? "کارمند واجد مهارت و در دسترس برای این نقش و شیفت وجود ندارد."
      : "کارمند واجد مهارت وجود دارد، اما محدودیت استراحت، ساعت کار، شیفت شب یا روزهای پیاپی مانع پوشش در این برنامه شده است.",
  }));
  return { positions, assignments, uncovered, algorithm: "CP-SAT", evaluations: solved.evaluations, seed };
}
