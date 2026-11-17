# 🚌 College Bus Route Optimization — DAA Algorithm Studio

An interactive, offline-first Design and Analysis of Algorithms project for planning a college pickup route. Configure the depot, pickup locations, student counts, bus capacity, average speed and distance matrix. The default dataset has seven pickup locations, so the exhaustive permutation catalogue contains `7! = 5,040` possible visiting orders.

## Run the website

1. Extract the ZIP archive.
2. Open `bus-route/index.html` in Chrome, Edge, Firefox or Safari.
3. The front end runs locally; no build step, server, external library or internet connection is required.

## Main features

- Animated 3D-style bus network with draggable camera, zoom and node inspection.
- Editable depot, bus capacity, average speed, pickup locations and symmetric distance matrix.
- A dedicated **Learn the Algorithms** section placed before the interactive laboratory. Every method has its own explanation and numbered steps beginning at 1.
- Four route strategies: Brute Force, Greedy Kruskal MST, Held–Karp Dynamic Programming, and a Divide-and-Conquer heuristic.
- Start, pause, resume, next-step, restart, stop and run-all controls. The execution log counter restarts at Step 1 whenever a new algorithm is started.
- Live telemetry, algorithm state, execution log and result cards.
- Algorithm comparison, complexity growth chart and measured-state table.
- **Four dedicated method explorers:** Brute Force has its full permutation catalogue; Kruskal MST has a searchable decision-by-decision trace; Held–Karp has a complete DP-state catalogue; Divide-and-Conquer has a recursive split/base-case/merge event catalogue. Every explorer is paginated and draws a graph for the selected item.
- **Brute Force permutation catalogue:** paginated unique permutations, current-page search, page sorting, direct jump to any route number, per-candidate distance, dedicated graph, per-leg breakdown, page statistics and CSV export. Seven pickups produce exactly 5,040 orders.
- Route Intelligence dashboard: route-leg distance chart, passenger-capacity visualization, algorithm quality comparison and operational recommendations.
- Driver Operations Sheet with stop order, pickup count, passenger load, leg distance and cumulative distance. ETA column is intentionally not included.
- Scenario Vault: save, load, delete, import and export datasets in the browser.
- **VIEW CODE button** (top bar and lab controls): plain Python source for each algorithm using your current distance matrix, with copy and .py download.
- Export algorithm comparison as CSV and the route report as JSON.
- Presentation mode and responsive layouts for laptop, tablet and mobile.
- Standalone Python implementation in `python/route_engine.py` using only the Python standard library.

## Algorithm summary

| Strategy | Time complexity | Optimality | Best use |
|---|---:|---|---|
| Brute Force | O(n!) | Exact | Small instances and verification |
| Greedy Kruskal MST + preorder walk | O(n² log n) | Heuristic (≤ 2× optimal with triangle inequality) | Fast route construction |
| Held–Karp DP | O(n² · 2ⁿ) | Exact | Exact solutions for moderate stop counts |
| Divide-and-Conquer | O(n²) intended heuristic | Not guaranteed | Demonstrating decomposition and approximation |

The browser demo limits Brute Force and Held–Karp to keep interactive execution responsive. The Python engine also applies configurable safe limits to exact methods.

## Four complete algorithm explorers

Open **Algorithm Route Explorer**. The numbered explorers are: **09 Brute Force — Complete Route Explorer**, which calculates `n!` unique pickup orders and draws each selected route; **10 Kruskal MST — Complete Decision Explorer**, which lists every candidate scan, nearest-stop selection, move and return; **11 Held–Karp DP — Complete State Explorer**, which lists each computed subset/ending-stop state, cost and predecessor; and **12 Divide & Conquer — Complete Split & Merge Explorer**, which lists each recursive subproblem, group split, base case and merge. Each explorer is searchable, paginated and displays a dedicated graph for the selected row/event.

Examples: 5 pickups = 120 routes; 6 pickups = 720; 7 pickups = 5,040; 8 pickups = 40,320. The catalogue is paginated rather than attempting to display thousands of rows simultaneously. Distance sorting applies to the currently displayed page only.

The Brute Force catalogue is paginated rather than attempting to display thousands of rows simultaneously. Distance sorting applies to the currently displayed page only. The other three explorers show their algorithm-specific trace events rather than falsely treating those methods as exhaustive permutation searches.

## Python route engine

From the extracted `bus-route` folder:

```bash
python3 python/route_engine.py
```

To load a custom scenario:

```bash
python3 python/route_engine.py --input scenario.json --output report.json
```

Example input format:

```json
{
  "depot": "College",
  "capacity": 45,
  "average_speed_kmh": 30,
  "locations": [
    {"name": "North Gate", "students": 8},
    {"name": "Library Junction", "students": 5}
  ],
  "distance_matrix": [
    [0, 7, 12],
    [7, 0, 6],
    [12, 6, 0]
  ]
}
```

The matrix order is depot first, followed by locations in the same order as `locations`. It must be square, symmetric, non-negative and have zero diagonal values. Passenger total must not exceed capacity.

## Model assumptions and limitations

- The route starts and ends at one depot and visits every pickup exactly once.
- Every pickup is treated as a passenger collection stop. Drop-offs, multiple buses, time windows, road closures, live GPS and changing passenger loads are outside this model.
- Bus capacity is validated against the total number of passengers in the scenario.
- Distances are user-provided or sample values, not live road-network distances.
- Estimated travel time is distance divided by the entered average speed; it excludes traffic, boarding and waiting time.
- Browser execution timings vary by device and browser. Compare algorithms on the same machine and scenario.

## Suggested demonstration flow

1. Explain the depot, pickup locations, capacity and distance matrix.
2. Open **Learn the Algorithms** and explain each method. Each method's step list starts at 1.
3. Run the four methods in the 3D Algorithm Laboratory and compare route distance, execution time and search states.
4. Open **Algorithm Route Explorer** and demonstrate the four dedicated explorers: permutation catalogue, Kruskal edge decisions, DP states and divide/merge events.
5. In the Brute Force catalogue, explain that seven pickups have `7! = 5,040` distinct visiting orders. Select different route numbers to show their individual graphs and leg costs.
6. Open the Driver Operations Sheet and demonstrate stop order, passenger load and cumulative distance.
7. Save a named dataset in Scenario Vault, then demonstrate export/import.

## Project files

- `index.html` — page structure and content
- `style.css` — responsive visual design and animations
- `code.js` — Python source shown by the VIEW CODE button
- `script.js` — browser algorithms, 3D canvas, controls, charts and exports
- `python/route_engine.py` — standalone Python algorithms and JSON CLI
- `python/simple_algorithms.py` — beginner-style plain-Python version of all four algorithms
- `python/route_catalog.py` — lazy Python route catalogue and pagination helpers
- `python/test_route_engine.py` and `python/test_route_catalog.py` — automated tests
