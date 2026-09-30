import { randomInt } from "node:crypto";
import { eligible, generate, type Assignment, type Input, type Position, type Result, type Worker } from "./scheduler";

type Score = { hard: number; soft: number };
type Candidate = { genes: number[]; score: Score };
type Proposal = { i: number; worker: number; j?: number; other?: number };
export type CoopResult = Result & { algorithm: "COOP1-SHIFT"; evaluations: number; seed: number; searchScore: Score };

function rngFromSeed(seed: number) {
  let state = seed >>> 0 || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function compare(a: Score, b: Score) { return a.hard - b.hard || a.soft - b.soft; }
function chooseWeighted(weights: number[], random: () => number) {
  const total = weights.reduce((a, b) => a + b, 0);
  let draw = random() * total;
  for (let i = 0; i < weights.length; i++) if ((draw -= weights[i]) <= 0) return i;
  return weights.length - 1;
}
function overlaps(a: Position, b: Position) { return a.startMs < b.endMs && b.startMs < a.endMs; }
function eligibleDomain(worker: Worker, position: Position, input: Input) {
  return worker.roleIds.includes(position.roleId) && !input.timeOff.some(leave =>
    leave.workerId === worker.id && position.startMs < Date.parse(leave.endsAt) && Date.parse(leave.startsAt) < position.endMs);
}
function consecutiveExcess(positions: Position[], limit: number) {
  const dates = [...new Set(positions.map(p => p.date))].sort();
  let consecutive = 1, excess = 0;
  for (let i = 1; i < dates.length; i++) {
    const previous = Date.parse(`${dates[i - 1]}T00:00:00Z`);
    const next = Date.parse(`${dates[i]}T00:00:00Z`);
    consecutive = next - previous === 86400000 ? consecutive + 1 : 1;
    excess = Math.max(excess, consecutive - limit);
  }
  return excess;
}

/** Factory-specific (hard, soft) objective for the paper's discrete operator pattern. */
function evaluate(genes: number[], positions: Position[], workers: Worker[], input: Input): Score {
  let hard = 0;
  const byWorker = workers.map(() => [] as Position[]);
  for (let i = 0; i < genes.length; i++) {
    if (genes[i] < 0) hard++;
    else byWorker[genes[i]].push(positions[i]);
  }
  const hours: number[] = [];
  for (const own of byWorker) {
    own.sort((a, b) => a.startMs - b.startMs);
    let minutes = 0, nights = 0;
    for (let i = 0; i < own.length; i++) {
      minutes += own[i].minutes;
      nights += Number(own[i].night);
      if (i > 0) {
        if (overlaps(own[i - 1], own[i])) hard++;
        if (own[i].startMs < own[i - 1].endMs + input.rules.minRestHours * 3600000) hard++;
      }
    }
    hard += Math.ceil(Math.max(0, minutes - input.rules.maxWeeklyHours * 60) / 60);
    hard += Math.max(0, nights - input.rules.maxNightShifts);
    hard += consecutiveExcess(own, input.rules.maxConsecutiveDays);
    hours.push(minutes);
  }
  const mean = hours.reduce((a, b) => a + b, 0) / Math.max(1, workers.length);
  const soft = hours.reduce((a, b) => a + (b - mean) ** 2, 0);
  return { hard, soft };
}

function project(genes: number[], positions: Position[], workers: Worker[], domains: number[][], input: Input): Assignment[] {
  const assigned: Assignment[] = [];
  const order = positions.map((_, i) => i).sort((a, b) => domains[a].length - domains[b].length || positions[a].startMs - positions[b].startMs);
  for (const index of order) {
    const preferred = genes[index];
    const options = [preferred, ...domains[index].filter(i => i !== preferred)].filter(i => i >= 0);
    for (const workerIndex of options) {
      if (eligible(workers[workerIndex], positions[index], assigned, input)) {
        assigned.push({ position: positions[index], workerId: workers[workerIndex].id });
        break;
      }
    }
  }
  return assigned.sort((a, b) => a.position.startMs - b.position.startMs);
}

/** Adapted COOP1: ranked BBO migration, refreshed discrete GWO leaders, bounded repair. */
export function generateWithCoop1(input: Input, suppliedSeed?: number): CoopResult {
  const baseline = generate(input);
  const positions = baseline.positions;
  const workers = input.workers;
  const seed = suppliedSeed ?? randomInt(1, 0x7fffffff);
  const random = rngFromSeed(seed);
  const domains = positions.map(position => workers.map((worker, i) => eligibleDomain(worker, position, input) ? i : -1).filter(i => i >= 0));
  const workerIndex = new Map(workers.map((w, i) => [w.id, i]));
  const assignedBaseline = new Map(baseline.assignments.map(a => [a.position.id, workerIndex.get(a.workerId)!]));
  const first = positions.map(p => assignedBaseline.get(p.id) ?? -1);
  const randomGene = (i: number) => domains[i].length ? domains[i][Math.floor(random() * domains[i].length)] : -1;
  const populationSize = 40;
  const budget = Math.min(1200, Math.max(240, positions.length * 30));
  const population: Candidate[] = [];
  let evaluations = 0;
  let historical: Candidate | undefined;
  const score = (genes: number[]) => {
    const evaluated = evaluate(genes, positions, workers, input);
    evaluations++;
    if (!historical || compare(evaluated, historical.score) < 0) historical = { genes: genes.slice(), score: evaluated };
    return evaluated;
  };
  for (let i = 0; i < populationSize; i++) {
    const genes = i === 0 ? first.slice() : positions.map((_, j) => randomGene(j));
    population.push({ genes, score: score(genes) });
  }
  let previous = Infinity, stale = 0, repairCursor = 0;
  function accept(index: number, genes: number[]) {
    const next = score(genes);
    if (compare(next, population[index].score) <= 0) population[index] = { genes, score: next };
  }
  while (evaluations < budget) {
    // Freeze donors and ranks during migration, protecting the two best parents.
    let order = population.map((_, i) => i).sort((a, b) => compare(population[a].score, population[b].score));
    const ranks = new Map(order.map((index, rank) => [index, rank]));
    const snapshot = population.map(item => item.genes.slice());
    const weights = population.map((_, i) => 1 - ranks.get(i)! / (populationSize - 1));
    for (const index of order.slice(2)) {
      if (evaluations >= budget) break;
      const child = population[index].genes.slice();
      const fraction = evaluations / budget;
      for (let j = 0; j < positions.length; j++) {
        if (random() < .25 * ranks.get(index)! / (populationSize - 1)) child[j] = snapshot[chooseWeighted(weights, random)][j];
        if (random() < .05 - .04 * fraction) child[j] = randomGene(j);
      }
      accept(index, child);
    }
    // Leaders include accepted migration changes, matching the paper's refreshed ordering.
    order = population.map((_, i) => i).sort((a, b) => compare(population[a].score, population[b].score));
    const leaders = order.slice(0, 3).map(i => population[i].genes.slice());
    for (const index of order.slice(2)) {
      if (evaluations >= budget) break;
      const child = population[index].genes.slice();
      const fraction = evaluations / budget;
      for (let j = 0; j < positions.length; j++) if (random() < .35 - .20 * fraction) child[j] = leaders[chooseWeighted([3,2,1], random)][j];
      accept(index, child);
    }
    const bestIndex = population.map((_, i) => i).sort((a, b) => compare(population[a].score, population[b].score))[0];
    const best = population[bestIndex];
    stale = best.score.hard < previous ? 0 : stale + 1;
    previous = best.score.hard;
    if (evaluations >= budget || (best.score.hard > 2 && stale < 2) || (best.score.hard === 0 && stale < 2)) continue;
    // Attribute blame to unassigned positions and workers involved in global conflicts.
    const blame = positions.map((_, i) => best.genes[i] < 0 ? 10 : 0);
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
      if (best.genes[i] < 0 || best.genes[i] !== best.genes[j]) continue;
      const a = positions[i], b = positions[j];
      if (overlaps(a, b) || (a.startMs <= b.startMs && b.startMs < a.endMs + input.rules.minRestHours * 3600000)
        || (b.startMs < a.startMs && a.startMs < b.endMs + input.rules.minRestHours * 3600000)) {
        blame[i]++; blame[j]++;
      }
    }
    const peak = Math.max(...blame);
    const targetChoices = blame.map((amount, i) => amount === peak ? i : -1).filter(i => i >= 0);
    const target = targetChoices[Math.floor(random() * targetChoices.length)];
    const relocate: Proposal[] = domains[target].filter(w => w !== best.genes[target]).map(w => ({ i:target, worker:w }));
    const swaps: Proposal[] = positions.map((_, j) => j).filter(j => j !== target &&
      domains[target].includes(best.genes[j]) && domains[j].includes(best.genes[target]))
      .map(j => ({ i:target, worker:best.genes[j], j, other:best.genes[target] }));
    const actions = repairCursor++ % 2 === 0 ? [relocate, swaps] : [swaps, relocate];
    const proposals = actions.find(group => group.length) || [];
    const parent = best.genes.slice();
    const sampled = new Set<number>();
    while (sampled.size < Math.min(8, proposals.length) && evaluations < budget) {
      const index = Math.floor(random() * proposals.length);
      if (sampled.has(index)) continue;
      sampled.add(index);
      const proposal = proposals[index];
      const child = parent.slice();
      child[proposal.i] = proposal.worker;
      if (proposal.j !== undefined && proposal.other !== undefined) child[proposal.j] = proposal.other;
      accept(bestIndex, child);
    }
  }
  const best = historical!;
  const assignment = project(best.genes, positions, workers, domains, input);
  const fairness = (values: Assignment[]) => {
    const loads = workers.map(w => values.filter(a => a.workerId === w.id).reduce((n, a) => n + a.position.minutes, 0));
    const mean = loads.reduce((a, b) => a + b, 0) / Math.max(1, workers.length);
    return loads.reduce((a, b) => a + (b - mean) ** 2, 0);
  };
  const finalAssignments = assignment.length > baseline.assignments.length ||
    (assignment.length === baseline.assignments.length && fairness(assignment) < fairness(baseline.assignments))
    ? assignment : baseline.assignments;
  const covered = new Set(finalAssignments.map(a => a.position.id));
  const uncovered = positions.filter(p => !covered.has(p.id)).map(p => baseline.uncovered.find(d => d.positionId === p.id) || ({
    positionId:p.id, message:"در برنامهٔ تولیدشده، محدودیت‌های سراسری مانع پوشش این جایگاه شدند.",
  }));
  return { positions, assignments:finalAssignments, uncovered, algorithm:"COOP1-SHIFT", evaluations, seed, searchScore:best.score };
}
