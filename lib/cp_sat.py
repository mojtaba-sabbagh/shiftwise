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

    deviations = None
    deviation_target = None
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
            deviation_target = int(round(solver.ObjectiveValue()))

    # Pass 3: soft rotation preference. Coverage (and, when it was computed, the
    # balance optimum) are now hard constraints, so maximizing adherence to the
    # representative's rotation cycles only reorders existing shift types — it
    # can never drop a covered position or cost extra hours. Pattern steps name
    # shift-template ids, with the literal "off" marking a rest day.
    patterns = data.get("patterns") or []
    worker_patterns = data.get("workerPatterns") or []
    if patterns and status == cp_model.OPTIMAL:
        # Re-assert the coverage optimum so the reward objective can only reorder
        # shifts, never drop a covered position (needed when the balance pass was
        # skipped, e.g. a single worker).
        model.Add(covered == len(best))
        if deviations is not None and deviation_target is not None:
            model.Add(sum(deviations) <= deviation_target)

        reward_terms = []
        for w, indices in enumerate(by_worker):
            applicable = worker_patterns[w] if w < len(worker_patterns) else []
            if not applicable:
                continue
            allowed = {}
            for index in applicable:
                steps = patterns[index]["steps"]
                weight = patterns[index].get("weight", 1)
                for i in range(len(steps)):
                    a, b = steps[i], steps[(i + 1) % len(steps)]
                    allowed[(a, b)] = max(allowed.get((a, b), 0), weight)

            work, idle = {}, {}
            for date in data["dates"]:
                present = {}
                for p in indices:
                    if positions[p]["date"] == date:
                        present.setdefault(positions[p]["shiftId"], []).append(assignments[p, w])
                for sid, variables in present.items():
                    state = model.NewBoolVar(f"y{w}_{date}_{sid}")
                    model.AddMaxEquality(state, variables)
                    work[(date, sid)] = state
                # A worker is "off" on a day exactly when they hold no shift there.
                busy = model.NewBoolVar(f"busy{w}_{date}")
                day_vars = [assignments[p, w] for p in indices if positions[p]["date"] == date]
                if day_vars:
                    model.AddMaxEquality(busy, day_vars)
                else:
                    model.Add(busy == 0)
                off = model.NewBoolVar(f"off{w}_{date}")
                model.Add(off + busy == 1)
                idle[date] = off

            for i in range(len(data["dates"]) - 1):
                d0, d1 = data["dates"][i], data["dates"][i + 1]
                for (a, b), weight in allowed.items():
                    first = idle[d0] if a == "off" else work.get((d0, a))
                    second = idle[d1] if b == "off" else work.get((d1, b))
                    if first is None or second is None:
                        continue  # that shift type is not available for this worker
                    pair = model.NewBoolVar(f"tr{w}_{i}_{len(reward_terms)}")
                    model.Add(pair <= first)
                    model.Add(pair <= second)
                    model.Add(pair >= first + second - 1)
                    reward_terms.append(weight * pair)

        if reward_terms:
            model.Maximize(sum(reward_terms))
            solver.parameters.max_time_in_seconds = 4
            preferred = solver.Solve(model)
            branches += solver.NumBranches()
            if preferred in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                best = [(p, w) for (p, w), variable in assignments.items() if solver.Value(variable)]

    return {"assignments": best, "evaluations": branches}


if __name__ == "__main__":
    try:
        print(json.dumps(solve(json.load(sys.stdin))))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
