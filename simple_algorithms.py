"""Simple, beginner-friendly versions of the four algorithms (standard library only).

Run:  python3 python/simple_algorithms.py
"""
from itertools import permutations

cost = [
    [0, 10, 14, 19, 21, 16, 12],
    [10, 0, 7, 12, 15, 18, 20],
    [14, 7, 0, 8, 13, 11, 17],
    [19, 12, 8, 0, 9, 10, 15],
    [21, 15, 13, 9, 0, 6, 12],
    [16, 18, 11, 10, 6, 0, 8],
    [12, 20, 17, 15, 12, 8, 0],
]
n = len(cost)


def route_cost(route):
    total = 0
    for i in range(len(route) - 1):
        total += cost[route[i]][route[i + 1]]
    return total


# ---------------- 1. Brute Force ----------------
def brute_force():
    cities = range(1, n)
    min_cost = float('inf')
    best_route = []
    for p in permutations(cities):
        route = (0,) + p + (0,)
        total = route_cost(route)
        if total < min_cost:
            min_cost = total
            best_route = route
    return best_route, min_cost


# ---------------- 2. Greedy: Kruskal's MST + preorder walk ----------------
def kruskal_route():
    # list all edges and sort them by cost
    edges = []
    for i in range(n):
        for j in range(i + 1, n):
            edges.append((cost[i][j], i, j))
    edges.sort()

    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            x = parent[x]
        return x

    tree = [[] for _ in range(n)]
    for w, i, j in edges:
        a, b = find(i), find(j)
        if a != b:                      # no cycle -> take the edge
            parent[a] = b
            tree[i].append((w, j))
            tree[j].append((w, i))

    # preorder walk of the tree from the depot
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
    return route, route_cost(route)


# ---------------- 3. Held-Karp Dynamic Programming ----------------
def held_karp():
    # dp[(mask, last)] = (min cost to visit the cities in mask and end at last, previous city)
    dp = {}
    for j in range(1, n):
        dp[(1 << j, j)] = (cost[0][j], 0)

    for mask in range(2, 1 << n, 2):            # masks only use bits 1..n-1
        for last in range(1, n):
            if mask & (1 << last):
                prev_mask = mask ^ (1 << last)
                for k in range(1, n):
                    if (prev_mask, k) in dp:
                        c = dp[(prev_mask, k)][0] + cost[k][last]
                        if (mask, last) not in dp or c < dp[(mask, last)][0]:
                            dp[(mask, last)] = (c, k)

    full = (1 << n) - 2                         # all cities visited
    best, last = min((dp[(full, j)][0] + cost[j][0], j) for j in range(1, n))

    path, mask = [], full                       # walk back to rebuild the route
    while last != 0:
        path.append(last)
        mask, last = mask ^ (1 << last), dp[(mask, last)][1]
    return [0] + path[::-1] + [0], best


# ---------------- 4. Divide and Conquer heuristic ----------------
def divide_and_conquer():
    def solve(group):
        if len(group) <= 3:                     # base case: try every order
            best = min(permutations(group), key=lambda p: route_cost([0, *p, 0]))
            return list(best)
        # split into two halves around the farthest pair
        a, b = max(((i, j) for i in group for j in group if i < j),
                   key=lambda pair: cost[pair[0]][pair[1]])
        ordered = sorted(group, key=lambda x: cost[x][a] - cost[x][b])
        half = (len(ordered) + 1) // 2
        left, right = solve(ordered[:half]), solve(ordered[half:])
        # merge: try both orders and both orientations, keep the cheapest
        best, best_cost = None, float('inf')
        for x, y in ((left, right), (right, left)):
            for xr in (x, x[::-1]):
                for yr in (y, y[::-1]):
                    path = xr + yr
                    c = route_cost([0, *path, 0])
                    if c < best_cost:
                        best, best_cost = path, c
        return best

    order = solve(list(range(1, n)))
    route = [0] + order + [0]
    return route, route_cost(route)


if __name__ == "__main__":
    for name, fn in [("Brute Force", brute_force), ("Kruskal MST (greedy)", kruskal_route),
                     ("Held-Karp DP", held_karp), ("Divide & Conquer", divide_and_conquer)]:
        route, total = fn()
        print(f"{name}: Best Route: {tuple(route)}  Minimum Cost: {total}")
