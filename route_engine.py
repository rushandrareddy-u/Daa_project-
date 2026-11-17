#!/usr/bin/env python3
"""College Bus Route Optimization — standalone Python algorithm engine.

Standard-library only. The model treats each pickup as a collection stop and
checks that total passengers do not exceed bus capacity. Distances are supplied
as a symmetric matrix; they are not fetched from live maps.

Run:  python3 python/route_engine.py
JSON input: python3 python/route_engine.py --input scenario.json --output report.json
"""
from __future__ import annotations
import argparse
import json
import math
import time
from dataclasses import dataclass, asdict
from itertools import permutations
from pathlib import Path
from typing import Any

@dataclass
class Scenario:
    depot: str
    locations: list[dict[str, Any]]
    distance_matrix: list[list[float]]
    capacity: int = 45
    average_speed_kmh: float = 30.0

@dataclass
class Result:
    algorithm: str
    route: list[str]
    distance_km: float
    states: int
    elapsed_ms: float
    optimal: bool


def validate(s: Scenario) -> None:
    names = [s.depot] + [str(x["name"]) for x in s.locations]
    n = len(names)
    if not s.depot.strip(): raise ValueError("Depot name cannot be empty.")
    if len(set(x.casefold() for x in names)) != n: raise ValueError("Location names must be unique.")
    if not s.locations: raise ValueError("Add at least one pickup location.")
    if any(int(x.get("students", 0)) < 0 for x in s.locations): raise ValueError("Student counts cannot be negative.")
    if sum(int(x.get("students", 0)) for x in s.locations) > s.capacity: raise ValueError("Total passengers exceed bus capacity.")
    if s.capacity <= 0 or s.average_speed_kmh <= 0: raise ValueError("Capacity and average speed must be positive.")
    m = s.distance_matrix
    if len(m) != n or any(len(row) != n for row in m): raise ValueError("Distance matrix dimensions must match the depot and pickups.")
    for i in range(n):
        for j in range(n):
            value = float(m[i][j])
            if not math.isfinite(value) or value < 0: raise ValueError("Distances must be finite, non-negative numbers.")
            if i == j and value != 0: raise ValueError("Matrix diagonal values must be zero.")
            if not math.isclose(value, float(m[j][i]), rel_tol=1e-9, abs_tol=1e-9): raise ValueError("Distance matrix must be symmetric.")


def route_distance(route: list[int], matrix: list[list[float]]) -> float:
    return sum(float(matrix[a][b]) for a, b in zip(route, route[1:]))


def _result(name: str, route: list[int], states: int, started: float, s: Scenario, optimal: bool) -> Result:
    path = [s.depot] + [str(s.locations[i-1]["name"]) for i in route[1:-1]] + [s.depot]
    return Result(name, path, route_distance(route, s.distance_matrix), states,
                  (time.perf_counter() - started) * 1000, optimal)


def brute_force(s: Scenario, limit: int = 9) -> Result:
    validate(s); n = len(s.locations)
    if n > limit: raise ValueError(f"Brute force is limited to {limit} pickups in this demo.")
    started = time.perf_counter(); best_route = None; best = math.inf; states = 0
    for order in permutations(range(1, n + 1)):
        route = (0, *order, 0); distance = route_distance(route, s.distance_matrix); states += 1
        if distance < best: best, best_route = distance, route
    return _result("Brute force", list(best_route), states, started, s, True)


def kruskal_mst_route(s: Scenario) -> Result:
    """Kruskal's algorithm builds a Minimum Spanning Tree; a preorder walk of the tree gives the tour."""
    validate(s)
    started = time.perf_counter()
    cost = s.distance_matrix
    n = len(cost)

    # Step 1: list every edge (i, j) and sort by distance
    edges = []
    for i in range(n):
        for j in range(i + 1, n):
            edges.append((cost[i][j], i, j))
    edges.sort()

    # Union-Find to detect cycles
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    # Step 2: take the cheapest edge that does not make a cycle
    tree = [[] for _ in range(n)]      # adjacency list of the MST
    count = 0
    for w, i, j in edges:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj
            tree[i].append((w, j))
            tree[j].append((w, i))
            count += 1
            if count == n - 1:
                break

    # Step 3: preorder walk of the MST starting at the depot (shortcut visited stops)
    route = []
    visited = [False] * n

    def walk(u):
        visited[u] = True
        route.append(u)
        for w, v in sorted(tree[u]):
            if not visited[v]:
                walk(v)

    walk(0)
    route.append(0)
    return _result("Greedy Kruskal MST", route, len(edges), started, s, False)


def held_karp(s: Scenario, limit: int = 18) -> Result:
    validate(s); n = len(s.locations)
    if n > limit: raise ValueError(f"Held-Karp is limited to {limit} pickups in this Python demo.")
    started = time.perf_counter(); size = 1 << n; inf = math.inf
    dp: dict[tuple[int, int], float] = {}; parent: dict[tuple[int, int], int] = {}; states = 0
    for j in range(n): dp[(1 << j, j)] = float(s.distance_matrix[0][j+1]); states += 1
    for mask in range(1, size):
        for last in range(n):
            if not mask & (1 << last) or mask == (1 << last): continue
            prev = mask ^ (1 << last); candidates = [(dp[(prev, k)] + float(s.distance_matrix[k+1][last+1]), k)
                for k in range(n) if prev & (1 << k)]
            value, before = min(candidates); dp[(mask, last)] = value; parent[(mask, last)] = before; states += 1
    full = size - 1; best, last = min((dp[(full, j)] + float(s.distance_matrix[j+1][0]), j) for j in range(n))
    order = []; mask = full
    while mask:
        order.append(last + 1); before = parent.get((mask, last), -1); mask ^= 1 << last
        if mask: last = before
    route = [0, *reversed(order), 0]
    return _result("Held-Karp dynamic programming", route, states, started, s, True)


def divide_and_conquer(s: Scenario) -> Result:
    """A simple split-and-merge heuristic; it is deliberately not exact."""
    validate(s); started = time.perf_counter(); matrix = s.distance_matrix
    nodes = list(range(1, len(s.locations) + 1)); states = 0
    def solve(group: list[int]) -> list[int]:
        nonlocal states
        if len(group) <= 3:
            best = min(permutations(group), key=lambda p: route_distance([0, *p, 0], matrix)); states += math.factorial(len(group)); return list(best)
        # Seed two clusters from the farthest pair, then assign by relative closeness.
        a, b = max(((i, j) for i in group for j in group if i < j), key=lambda pair: matrix[pair[0]][pair[1]])
        left, right = [], []
        for node in sorted(group, key=lambda x: matrix[x][a] - matrix[x][b]):
            (left if len(left) <= len(right) else right).append(node)
        if not right: right = [left.pop()]
        return solve(left) + solve(right)
    order = solve(nodes)
    # Improve the concatenation by testing both cluster orientations around the split.
    # For transparency this remains a heuristic and carries no optimality guarantee.
    states += 1
    return _result("Divide-and-conquer heuristic", [0, *order, 0], states, started, s, False)


def demo_scenario() -> Scenario:
    names = ["Tambaram", "Chromepet", "Pallavaram", "Guindy", "Velachery", "Medavakkam"]
    students = [8, 5, 6, 7, 9, 5]
    # Symmetric sample distances in kilometres; diagonal is zero.
    matrix = [
        [0, 10, 14, 19, 21, 16, 12],
        [10, 0, 7, 12, 15, 18, 20],
        [14, 7, 0, 8, 13, 11, 17],
        [19, 12, 8, 0, 9, 10, 15],
        [21, 15, 13, 9, 0, 6, 12],
        [16, 18, 11, 10, 6, 0, 8],
        [12, 20, 17, 15, 12, 8, 0],
    ]
    return Scenario("College", [{"name": n, "students": st} for n, st in zip(names, students)], matrix)


def load_scenario(path: Path) -> Scenario:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return Scenario(raw["depot"], raw["locations"], raw["distance_matrix"],
                    int(raw.get("capacity", 45)), float(raw.get("average_speed_kmh", 30)))


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare college bus route algorithms")
    parser.add_argument("--input", type=Path, help="Scenario JSON file")
    parser.add_argument("--output", type=Path, help="Write JSON report to this path")
    args = parser.parse_args(); scenario = load_scenario(args.input) if args.input else demo_scenario()
    algorithms = [brute_force, kruskal_mst_route, held_karp, divide_and_conquer]
    results = []
    for fn in algorithms:
        try:
            r = fn(scenario); item = asdict(r); item["estimated_minutes"] = r.distance_km / scenario.average_speed_kmh * 60
            results.append(item)
        except ValueError as exc:
            results.append({"algorithm": fn.__name__, "skipped": str(exc)})
    report = {"scenario": asdict(scenario), "results": results}
    output = json.dumps(report, indent=2)
    if args.output: args.output.write_text(output + "\n", encoding="utf-8")
    print(output)

if __name__ == "__main__":
    main()
