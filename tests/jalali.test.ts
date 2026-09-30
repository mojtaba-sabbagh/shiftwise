import assert from "node:assert/strict";
import test from "node:test";
import { faDate } from "../lib/format";
import { addDays, jalaliMonthLength, jalaliMonthStart, jalaliParts, saturdayIndex } from "../lib/jalali";

test("Jalali picker crosses Nowruz and leap month boundaries", () => {
  assert.deepEqual(jalaliParts("2026-03-20"), { year: 1404, month: 12, day: 29 });
  assert.deepEqual(jalaliParts("2026-03-21"), { year: 1405, month: 1, day: 1 });
  assert.equal(jalaliMonthStart("2026-03-20"), "2026-02-20");
  assert.equal(jalaliMonthLength("2026-02-20"), 29);
  assert.equal(addDays("2026-02-20", 29), "2026-03-21");
  assert.equal(jalaliMonthLength(jalaliMonthStart("2025-03-20")), 30);
});

test("calendar uses Saturday as the first day and Persian display dates", () => {
  assert.equal(saturdayIndex("2026-09-26"), 0);
  assert.equal(saturdayIndex("2026-09-27"), 1);
  assert.deepEqual(jalaliParts("2026-09-26"), { year: 1405, month: 7, day: 4 });
  assert.match(faDate("2026-09-26"), /۱۴۰۵/);
  assert.doesNotMatch(faDate("2026-09-26"), /2026/);
});
