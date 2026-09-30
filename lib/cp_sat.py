"""Solve one Shiftwise week with Google OR-Tools CP-SAT.

Input and output are JSON over standard input/output; diagnostics go to stderr.
"""

import json
import sys

from ortools.sat.python import cp_model


def solve(data):
    positions = data["positions"]
    workers = data["workers"]
    rules = data["rules"]
    model = cp_model.CpModel()
    assignments = {}
    by_worker = [[] for _ in workers]
    by_position = [[] for _ in positions]
    for p, position in enumerate(positions):
        for w in position["eligible"]:
            variable = model.NewBoolVar(f"p{p}_w{w}")
            assignments[p, w] = variable
            by_worker[w].append(p)
            by_position[p].append(variable)
        model.Add(sum(by_position[p]) <= 1)

    rest_ms = rules["minRestHours"] * 3600000
    for w, indices in enumerate(by_worker):
        indices.sort(key=lambda p: positions[p]["startMs"])
        for i, p in enumerate(indices):
            for q in indices[i + 1:]:
                if positions[q]["startMs"] >= positions[p]["endMs"] + rest_ms:
                    break
                model.Add(assignments[p, w] + assignments[q, w] <= 1)
        model.Add(sum(positions[p]["minutes"] * assignments[p, w] for p in indices)
                  <= rules["maxWeeklyHours"] * 60)
        model.Add(sum(assignments[p, w] for p in indices if positions[p]["night"])
                  <= rules["maxNightShifts"])

        # A day counts once, even if a worker has two compatible shifts that day.
        days = []
        for date in data["dates"]:
            shifts = [assignments[p, w] for p in indices if positions[p]["date"] == date]
            day = model.NewBoolVar(f"day{len(days)}_w{w}")
            model.AddMaxEquality(day, shifts) if shifts else model.Add(day == 0)
            days.append(day)
        limit = rules["maxConsecutiveDays"]
        for start in range(len(days) - limit):
            model.Add(sum(days[start:start + limit + 1]) <= limit)

    # Coverage is the primary objective. A separate pass balances minutes only
    # after the coverage optimum has been proved.
    covered = sum(assignments.values())
    model.Maximize(covered)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = data["seed"]
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"CP-SAT found no schedule within its time limit (status {solver.StatusName(status)}).")
    branches = solver.NumBranches()
    best = [(p, w) for (p, w), variable in assignments.items() if solver.Value(variable)]

    if status == cp_model.OPTIMAL and len(workers) > 1 and assignments:
        model.Add(covered == len(best))
        total = sum(positions[p]["minutes"] * variable for (p, _), variable in assignments.items())
        deviations = []
        max_minutes = rules["maxWeeklyHours"] * 60
        for w, indices in enumerate(by_worker):
            load = sum(positions[p]["minutes"] * assignments[p, w] for p in indices)
            deviation = model.NewIntVar(0, len(workers) * max_minutes + len(positions) * 960, f"dev{w}")
            model.AddAbsEquality(deviation, len(workers) * load - total)
            deviations.append(deviation)
        model.Minimize(sum(deviations))
        for (p, w), variable in assignments.items():
            model.AddHint(variable, int((p, w) in best))
        solver.parameters.max_time_in_seconds = 5
        balanced = solver.Solve(model)
        branches += solver.NumBranches()
        if balanced in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            best = [(p, w) for (p, w), variable in assignments.items() if solver.Value(variable)]

    return {"assignments": best, "evaluations": branches}


if __name__ == "__main__":
    try:
        print(json.dumps(solve(json.load(sys.stdin))))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
