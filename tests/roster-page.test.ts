import assert from "node:assert/strict";
import test from "node:test";
import { rosterPage } from "../lib/roster-page";

test("weekly roster has ten workers per page and keeps the last partial page", () => {
  const workers = Array.from({ length: 23 }, (_, index) => ({ name: `کارمند ${index + 1}`, id: index + 1 }));
  const first = rosterPage(workers, "", 1);
  const second = rosterPage(workers, "", 2);
  const last = rosterPage(workers, "", 3);
  assert.deepEqual([first.items.length, second.items.length, last.items.length], [10, 10, 3]);
  assert.deepEqual(last.items.map(worker => worker.id), [21, 22, 23]);
  assert.equal(last.totalPages, 3);
  assert.equal(rosterPage(workers, "", 99).currentPage, 3);
});

test("name search handles Persian letter variants and recalculates pages", () => {
  const workers = [
    { name: "علی کریمی" }, { name: "علي كريمي" }, { name: "مریم محمدی" },
  ];
  const result = rosterPage(workers, "  علي  كريمي  ", 2);
  assert.deepEqual(result.items, workers.slice(0, 2));
  assert.equal(result.total, 2);
  assert.equal(result.totalPages, 1);
  assert.equal(result.currentPage, 1);
  assert.deepEqual(rosterPage(workers, "ناموجود", 1).items, []);
});
