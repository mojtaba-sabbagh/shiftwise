import assert from "node:assert/strict";
import test from "node:test";
import { eligible, expandPositions, generate, type Input } from "../lib/scheduler";
import { generateWithCoop1 } from "../lib/coop1";
import { generateWithCpSat } from "../lib/cp-sat";

const base = (): Input => ({
  weekStart: "2026-09-26", timezone: "Asia/Tehran",
  workers: [
    { id:"a", name:"الف", roleIds:["operator"] },
    { id:"b", name:"ب", roleIds:["operator", "quality"] },
    { id:"c", name:"ج", roleIds:["quality"] },
  ],
  roles: [{ id:"operator", name:"اپراتور", color:"#126" }, { id:"quality", name:"کنترل کیفیت", color:"#216" }],
  shifts: [{ id:"day", name:"صبح", startTime:"07:00:00", endTime:"15:00:00" },
    { id:"night", name:"شب", startTime:"22:00:00", endTime:"06:00:00" }],
  coverage: [
    { id:"d1", weekday:1, shiftId:"day", roleId:"operator", count:1 },
    { id:"d2", weekday:1, shiftId:"day", roleId:"quality", count:1 },
  ],
  timeOff: [],
  rules: { minRestHours:11, maxWeeklyHours:40, maxConsecutiveDays:6, maxNightShifts:3, nightStartHour:22 },
});

test("fills skill-specific simultaneous positions without double booking", () => {
  const input = base();
  const result = generate(input);
  assert.equal(result.uncovered.length, 0);
  assert.equal(result.assignments.length, 2);
  assert.equal(new Set(result.assignments.map(a => a.workerId)).size, 2);
  for (const assignment of result.assignments) {
    const worker = input.workers.find(w => w.id === assignment.workerId)!;
    assert.ok(worker.roleIds.includes(assignment.position.roleId));
    assert.ok(eligible(worker, assignment.position, result.assignments.filter(a => a !== assignment), input));
  }
});

test("overnight shift ends the following day and enforces rest", () => {
  const input = base();
  input.workers = [input.workers[0]];
  input.coverage = [
    { id:"night-required", weekday:1, shiftId:"night", roleId:"operator", count:1 },
    { id:"day-required", weekday:2, shiftId:"day", roleId:"operator", count:1 },
  ];
  const positions = expandPositions(input);
  const night = positions.find(p => p.shiftId === "night")!;
  const morning = positions.find(p => p.shiftId === "day")!;
  assert.equal(night.minutes, 480);
  assert.equal(new Date(night.endsAt).getUTCDate(), 29);
  assert.equal(eligible(input.workers[0], morning, [{ workerId:"a", position:night }], input), false);
  assert.equal(generate(input).uncovered.length, 1);
});

test("leave and missing skills produce an explicit uncovered position", () => {
  const input = base();
  input.workers = [input.workers[0]];
  input.coverage = [{ id:"q", weekday:1, shiftId:"day", roleId:"quality", count:1 }];
  assert.match(generate(input).uncovered[0].message, /واجد مهارت/);
  input.coverage = [{ id:"a", weekday:1, shiftId:"day", roleId:"operator", count:1 }];
  input.timeOff = [{ workerId:"a", startsAt:"2026-09-28T00:00:00+03:30", endsAt:"2026-09-29T00:00:00+03:30" }];
  assert.equal(generate(input).assignments.length, 0);
});

test("weekly hours and maximum night shifts cap assignments", () => {
  const input = base();
  input.workers = [input.workers[0]];
  input.coverage = [1,2,3].map((weekday,i) => ({ id:`n${i}`, weekday, shiftId:"night", roleId:"operator", count:1 }));
  input.rules.maxWeeklyHours = 24;
  input.rules.maxNightShifts = 2;
  const result = generate(input);
  assert.equal(result.assignments.length, 2);
  assert.equal(result.uncovered.length, 1);
});

test("adapted cooperative search preserves feasibility and a bounded shared budget", () => {
  const input = base();
  const result = generateWithCoop1(input, 1400);
  assert.equal(result.algorithm, "COOP1-SHIFT");
  assert.equal(result.evaluations, 240);
  assert.equal(result.uncovered.length, 0);
  for (const assignment of result.assignments) {
    const worker = input.workers.find(w => w.id === assignment.workerId)!;
    assert.ok(eligible(worker, assignment.position, result.assignments.filter(a => a !== assignment), input));
  }
  assert.deepEqual(generateWithCoop1(input, 1400).assignments, result.assignments);
});

test("CP-SAT is feasible, deterministic with a seed, and records its algorithm", async () => {
  const input = base();
  const result = await generateWithCpSat(input, 1400);
  assert.equal(result.algorithm, "CP-SAT");
  assert.equal(result.assignments.length, 2);
  assert.equal(result.uncovered.length, 0);
  for (const assignment of result.assignments) {
    const worker = input.workers.find(w => w.id === assignment.workerId)!;
    assert.ok(eligible(worker, assignment.position, result.assignments.filter(a => a !== assignment), input));
  }
  assert.deepEqual((await generateWithCpSat(input, 1400)).assignments, result.assignments);
});

test("CP-SAT maximizes coverage across conflicting shifts and accounts for leave", async () => {
  const input = base();
  input.workers = [{ id:"a", name:"A", roleIds:["operator"] }];
  input.coverage = [
    { id:"night", weekday:1, shiftId:"night", roleId:"operator", count:1 },
    { id:"morning", weekday:2, shiftId:"day", roleId:"operator", count:1 },
    { id:"later", weekday:4, shiftId:"day", roleId:"operator", count:1 },
  ];
  const result = await generateWithCpSat(input, 1);
  assert.equal(result.assignments.length, 2);
  assert.equal(result.uncovered.length, 1);
  assert.ok(result.assignments.some(a => a.position.shiftId === "day" && a.position.date === "2026-10-01"));
  input.timeOff = [{ workerId:"a", startsAt:"2026-10-01T00:00:00+03:30", endsAt:"2026-10-02T00:00:00+03:30" }];
  assert.equal((await generateWithCpSat(input, 1)).assignments.length, 1);
});

test("CP-SAT enforces consecutive days, weekly hours, and night limits", async () => {
  const input = base();
  input.workers = [{ id:"a", name:"A", roleIds:["operator"] }];
  input.coverage = [1,2,3,4].map(weekday => ({ id:`d${weekday}`, weekday, shiftId:"day", roleId:"operator", count:1 }));
  input.rules.maxConsecutiveDays = 2;
  assert.equal((await generateWithCpSat(input, 2)).assignments.length, 3);
  input.rules.maxWeeklyHours = 16;
  assert.equal((await generateWithCpSat(input, 2)).assignments.length, 2);
  input.coverage = [1,2,3].map(weekday => ({ id:`n${weekday}`, weekday, shiftId:"night", roleId:"operator", count:1 }));
  input.rules.maxWeeklyHours = 40;
  input.rules.maxNightShifts = 1;
  assert.equal((await generateWithCpSat(input, 2)).assignments.length, 1);
});
