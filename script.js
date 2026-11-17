'use strict';
/* =====================================================================
   COLLEGE BUS ROUTE OPTIMIZATION — Algorithm Laboratory
   Layers: input -> validation -> graph model -> algorithm engine (generators)
           -> execution state stream -> visualization -> results -> comparison
   PART 1 (below) has NO dependency on the DOM.
   ===================================================================== */
const ALGS = ['brute', 'greedy', 'dp', 'dc'];
const NAME = { brute: 'Brute Force', greedy: 'Greedy (Kruskal MST)', dp: 'Dynamic Programming (Held-Karp)', dc: 'Divide & Conquer Heuristic' };
const SHORT = { brute: 'Brute Force', greedy: 'Kruskal MST', dp: 'Dynamic Programming', dc: 'Divide & Conquer' };
const LIM = { brute: 9, dp: 12 };               // safe demo sizes (pickup locations)
const DEFPTS = { College: [11, 3], Tambaram: [0, 0], Chromepet: [6, 7], Pallavaram: [9, 10], Guindy: [14, 16], Velachery: [15, 8], Medavakkam: [8, -2], Sholinganallur: [18, 2] };
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const popcount = x => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };

/** Builds a symmetric distance matrix (strings, editable by the user) from rough coordinates. */
function generateDistanceMatrix(points) {
  return points.map((a, i) => points.map((b, j) => (i === j ? '0' : String(Math.max(1, Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) * 1.3))))));
}
function defaultState() {
  const names = Object.keys(DEFPTS), st = [8, 5, 6, 7, 9, 5, 4];
  return { depot: 'College', cap: 45, speed: 30, locs: names.slice(1).map((n, i) => ({ name: n, s: st[i] })), D: generateDistanceMatrix(names.map(n => DEFPTS[n])) };
}
const totalStudents = S => S.locs.reduce((a, l) => a + (Number(l.s) || 0), 0);

/** Validates the raw input. Returns a list of human-readable errors (empty = valid). */
function validateInput(S, alg) {
  const e = [], names = [S.depot.trim(), ...S.locs.map(l => l.name.trim())], n = names.length;
  if (!names[0]) e.push('Please enter a depot name.');
  if (!S.locs.length) e.push('Add at least one pickup location.');
  S.locs.forEach((l, i) => { if (!l.name.trim()) e.push(`Please enter a pickup location (row ${i + 1}).`); });
  const seen = new Set();
  names.forEach(x => { const k = x.toLowerCase(); if (x && seen.has(k)) e.push(`Location already exists: ${x}.`); seen.add(k); });
  S.locs.forEach(l => { if (!(String(l.s).trim() !== '' && Number.isInteger(Number(l.s)) && Number(l.s) >= 0)) e.push(`Student count for "${l.name || '?'}" must be a whole number ≥ 0.`); });
  if (!(Number(S.cap) > 0)) e.push('Bus capacity must be greater than 0.');
  else if (totalStudents(S) > Number(S.cap)) e.push(`Bus capacity exceeded: ${totalStudents(S)} students > capacity ${S.cap}.`);
  if (!(Number(S.speed) > 0)) e.push('Average speed must be greater than 0.');
  let miss = 0, neg = 0, bad = 0, diag = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = String((S.D[i] || [])[j] ?? '').trim();
    if (i === j) { if (v !== '0') diag++; continue; }
    if (v === '') miss++; else if (isNaN(Number(v))) bad++; else if (Number(v) < 0) neg++;
  }
  if (miss) e.push('Please enter all required distances.');
  if (bad) e.push('Distances must be numeric.');
  if (neg) e.push('Distance cannot be negative.');
  if (diag) e.push('Diagonal distances must be 0.');
  const m = S.locs.length;
  if (alg === 'brute' && m > LIM.brute) e.push(`Brute force is computationally expensive for this input size (${m}! = ${fact(m).toExponential(2)} routes). Limit: ${LIM.brute} locations.`);
  if (alg === 'dp' && m > LIM.dp) e.push(`Dynamic programming demonstration is limited to a manageable number of locations (max ${LIM.dp}).`);
  return e;
}
/** Graph model used by every algorithm. Index 0 = depot. */
function buildGraph(S) {
  const names = [S.depot.trim(), ...S.locs.map(l => l.name.trim())];
  return { names, M: S.D.slice(0, names.length).map(r => r.slice(0, names.length).map(v => Number(v) || 0)), students: [0, ...S.locs.map(l => Number(l.s) || 0)], cap: Number(S.cap), speed: Number(S.speed) };
}
/** Exact distance of a route given as location names: ["College","A",...,"College"]. */
function calculateRouteDistance(route, G) {
  let d = 0;
  for (let i = 0; i < route.length - 1; i++) d += G.M[G.names.indexOf(route[i])][G.names.indexOf(route[i + 1])];
  return d;
}

/* ---------- ALGORITHM 1: BRUTE FORCE (exhaustive permutation search) ---------- */
function* bruteForce(G) {
  const n = G.names.length - 1, total = fact(n);
  let best = Infinity, bestRoute = null, checked = 0;
  const used = Array(n + 1).fill(false), path = [0];
  function* rec() {                                     // DFS over the permutation tree
    if (path.length === n + 1) {                         // leaf = one complete permutation
      const route = [...path, 0].map(i => G.names[i]);
      const distance = calculateRouteDistance(route, G);
      checked++;
      const improved = distance < best;
      if (improved) { best = distance; bestRoute = route; }
      yield { type: 'candidate', route, distance, checked, total, best, bestRoute, improved };
      return;
    }
    for (let i = 1; i <= n; i++) if (!used[i]) { used[i] = true; path.push(i); yield* rec(); path.pop(); used[i] = false; }
  }
  yield* rec();
  return { route: bestRoute, distance: best, states: checked, optimal: true };
}

/* ---------- ALGORITHM 2: KRUSKAL MST (greedy) + PREORDER TOUR ----------
   1) Sort all edges by distance. 2) Greedily add the cheapest edge that does not form a cycle (Union-Find)
   until n-1 edges form a Minimum Spanning Tree. 3) Walk the tree in preorder from the depot (shortcutting
   repeated stops) and return to the depot. Heuristic: tour <= 2 x optimal when distances obey the triangle inequality. */
function* kruskalMST(G) {
  const n = G.names.length, M = G.M, parent = [...Array(n).keys()];
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const edges = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push({ a: i, b: j, w: M[i][j] });
  edges.sort((x, y) => x.w - y.w || x.a - y.a || x.b - y.b);            // Step 1: sort edges
  const adj = Array.from({ length: n }, () => []), mst = [];
  let evals = edges.length, mstCost = 0;
  yield { type: 'start', current: G.names[0], edges: edges.length };
  for (const e of edges) {                                              // Step 2: Kruskal
    if (mst.length === n - 1) break;
    const ra = find(e.a), rb = find(e.b), take = ra !== rb;
    if (take) { parent[ra] = rb; mst.push(e); adj[e.a].push({ to: e.b, w: e.w }); adj[e.b].push({ to: e.a, w: e.w }); mstCost += e.w; }
    yield { type: 'edge', from: G.names[e.a], to: G.names[e.b], distance: e.w, accepted: take, mstEdges: mst.length, mstCost };
  }
  const route = [G.names[0]], visited = new Set([0]); let cur = 0, total = 0;
  function* walk(u) {                                                   // Step 3: preorder walk of the MST
    for (const c of adj[u].slice().sort((x, y) => x.w - y.w || x.to - y.to)) if (!visited.has(c.to)) {
      visited.add(c.to);
      const d = M[cur][c.to];                                           // direct leg (shortcut)
      yield { type: 'select', current: G.names[cur], candidate: G.names[c.to], distance: d, candidates: [] };
      total += d; cur = c.to; route.push(G.names[c.to]);
      yield { type: 'move', to: G.names[c.to], route: [...route], added: d, total };
      yield* walk(c.to);
    }
  }
  yield* walk(0);
  const back = M[cur][0]; total += back; route.push(G.names[0]);
  yield { type: 'return', route: [...route], added: back, total };
  return { route, distance: total, states: evals, optimal: false };
}

/* ---------- ALGORITHM 3: HELD-KARP DYNAMIC PROGRAMMING ----------
   dp[mask][last] = min distance leaving the depot, visiting exactly the pickups in `mask`, ending at `last`. */
function* heldKarpDP(G) {
  const m = G.names.length - 1, N = 1 << m, M = G.M;
  const dp = new Float64Array(N * m).fill(Infinity), par = new Int16Array(N * m).fill(-1);
  const nm = mask => { const a = []; for (let k = 0; k < m; k++) if (mask >> k & 1) a.push(G.names[k + 1]); return a; };
  let states = 0, lookups = 0, trans = 0;
  const masks = [];
  for (let x = 1; x < N; x++) masks.push(x);
  masks.sort((a, b) => popcount(a) - popcount(b) || a - b);   // process subsets by size (layers)
  for (const mask of masks) for (let last = 0; last < m; last++) {
    if (!(mask >> last & 1)) continue;
    const prev = mask ^ (1 << last);
    let d = Infinity, from = -1, fromDist = null;
    if (prev === 0) { d = M[0][last + 1]; trans++; }          // base: depot -> last
    else for (let k = 0; k < m; k++) if (prev >> k & 1) {
      lookups++; trans++;                                      // reuse a stored sub-solution
      const c = dp[prev * m + k] + M[k + 1][last + 1];
      if (c < d) { d = c; from = k; fromDist = dp[prev * m + k]; }
    }
    dp[mask * m + last] = d; par[mask * m + last] = from; states++;
    yield { type: 'dp-state', mask, size: popcount(mask), subset: nm(mask), last: G.names[last + 1], distance: d, base: prev === 0,
      from: from < 0 ? null : { subset: nm(prev), last: G.names[from + 1], distance: fromDist, edge: M[from + 1][last + 1] }, states, lookups, trans };
  }
  const full = N - 1; let bestD = Infinity, bl = -1;
  for (let l = 0; l < m; l++) { trans++; const c = dp[full * m + l] + M[l + 1][0]; if (c < bestD) { bestD = c; bl = l; } }
  const order = []; let mask = full, l = bl;                  // route reconstruction via parent pointers
  while (l >= 0) { order.push(l + 1); const p = par[mask * m + l]; mask ^= 1 << l; l = p; }
  const route = [G.names[0], ...order.reverse().map(i => G.names[i]), G.names[0]];
  yield { type: 'reconstruct', route, distance: bestD, states, lookups, trans };
  return { route, distance: bestD, states, lookups, trans, optimal: true };
}

/* ---------- ALGORITHM 4: DIVIDE & CONQUER HEURISTIC ----------
   Split pickups into two balanced groups (seeded by the farthest pair), solve each recursively,
   base case (<=3 pickups) tries every order, merge = best of 8 concatenations (order x reversal). NOT guaranteed optimal. */
function* divideAndConquer(G) {
  const m = G.names.length - 1, M = G.M; let nid = 0, evals = 0;
  const nm = a => a.map(i => G.names[i]);
  const pathLen = p => { let d = 0; for (let i = 0; i < p.length - 1; i++) d += M[p[i]][p[i + 1]]; return d; };
  const closed = p => M[0][p[0]] + pathLen(p) + M[p[p.length - 1]][0];       // depot -> path -> depot
  const perms = a => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r])));
  function split(set) {
    let a = set[0], b = set[1], far = -1;
    for (const i of set) for (const j of set) if (i < j && M[i][j] > far) { far = M[i][j]; a = i; b = j; }
    const s = [...set].sort((x, y) => (M[x][a] - M[x][b]) - (M[y][a] - M[y][b]));
    const h = Math.ceil(s.length / 2);
    return [s.slice(0, h), s.slice(h)];
  }
  function* solve(set, depth, parent) {
    const id = nid++;
    yield { type: 'open', id, parent, depth, locations: nm(set) };
    let path;
    if (set.length <= 3) {
      let bp = null, bc = Infinity, tried = 0;
      for (const p of perms(set)) { evals++; tried++; const c = closed(p); if (c < bc) { bc = c; bp = p; } }
      path = bp; yield { type: 'base', id, path: nm(path), length: pathLen(path), tried };
    } else {
      const [A, B] = split(set);
      yield { type: 'divide', id, groupA: nm(A), groupB: nm(B) };
      const ra = yield* solve(A, depth + 1, id), rb = yield* solve(B, depth + 1, id);
      let bp = null, bc = Infinity, tried = 0;
      for (const [x, y] of [[ra, rb], [rb, ra]]) for (const xr of [0, 1]) for (const yr of [0, 1]) {
        const p = [...(xr ? [...x].reverse() : x), ...(yr ? [...y].reverse() : y)];
        tried++; evals++; const c = closed(p); if (c < bc) { bc = c; bp = p; }
      }
      path = bp; yield { type: 'merge', id, path: nm(path), length: pathLen(path), tried };
    }
    return path;
  }
  const path = yield* solve([...Array(m).keys()].map(i => i + 1), 0, null);
  const route = [G.names[0], ...nm(path), G.names[0]];
  return { route, distance: calculateRouteDistance(route, G), states: evals, optimal: false };
}
const ALGFN = { brute: bruteForce, greedy: kruskalMST, dp: heldKarpDP, dc: divideAndConquer };
/** Runs an algorithm to completion (no UI) and measures wall-clock time with performance.now(). */
function timeRun(alg, G) {
  const t0 = performance.now(), g = ALGFN[alg](G); let r;
  while (!(r = g.next()).done);
  return { ms: performance.now() - t0, ...r.value, alg };
}
/* ===== UI ===== */
/* =====================================================================
   PART 2 — visualization, controller and UI
   ===================================================================== */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 1) => (Number.isInteger(x) ? String(x) : x.toFixed(d));
let S = defaultState(), G, V, results = {}, tab = 'greedy', selNode = null, sel = null, treeSel = null;
const R = { gen: null, alg: null, timer: null, paused: false, running: false, timeMs: 0 };
const DELAY = { slow: 450, normal: 140, fast: 16 }, BATCH = { slow: 1, normal: 2, fast: 30 }, BUS = { slow: .05, normal: .1, fast: .4 };

/* ---------- layout: depot at centre, radius ~ real distance from depot, height ~ students ---------- */
function layout(G) {
  const m = G.names.length - 1, d0 = G.M[0], mx = Math.max(1, ...d0);
  return G.names.map((_, i) => {
    if (!i) return { x: 0, y: 0, z: 0 };
    const a = 2 * Math.PI * (i - 1) / m;
    return { x: Math.cos(a) * (70 + 150 * d0[i] / mx), y: G.students[i] * 6, z: Math.sin(a) * (70 + 150 * d0[i] / mx) };
  });
}
function newView(G) {
  return { G, pos: layout(G), route: null, routeIdx: null, bestIdx: null, routeStyle: 'path', routeComplete: false, u: 0, visited: new Set([0]), cur: 0, scan: [], sel: null,
    status: 'IDLE', alg: null, logs: [], step: 0, dp: null, tree: [], groups: null, hl: [], cand: null, loop: false, invalid: false };
}
const log = m => { V.step++; V.logs.push(`<div><b>STEP ${String(V.step).padStart(2, '0')}</b> ${m}</div>`); if (V.logs.length > 90) V.logs.shift(); };
/** Starts the bus on a route; the bus then travels the real edges of that route. */
function animateRoute(route, opts = {}) {
  V.route = route; V.routeIdx = route.map(n => V.G.names.indexOf(n));
  if (opts.reset !== false) V.u = 0;
}

/* ---------- 3D scene: perspective projection on canvas, drag/zoom/pan/click ---------- */
class Scene {
  constructor(cv, getView, o = {}) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.get = getView; this.o = o; this.hits = [];
    this.cam = { yaw: .6, pitch: .6, zoom: 1, px: 0, py: 0 };
    let drag = null;
    if (!o.static) {
      cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pan: e.shiftKey || e.button === 2 }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
      cv.addEventListener('pointermove', e => {
        if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
        if (drag.pan) { this.cam.px -= dx * 1.4 / this.cam.zoom; this.cam.py += dy * 1.4 / this.cam.zoom; }
        else { this.cam.yaw += dx * .008; this.cam.pitch = Math.max(.05, Math.min(1.45, this.cam.pitch + dy * .006)); }
      });
      cv.addEventListener('pointerup', e => { cv.style.cursor = 'grab'; if (drag && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) this.click(e); drag = null; });
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.exp(-e.deltaY * .001)); }, { passive: false });
      cv.addEventListener('keydown', e => {
        const k = { ArrowLeft: () => this.cam.yaw -= .1, ArrowRight: () => this.cam.yaw += .1, ArrowUp: () => this.cam.pitch = Math.min(1.45, this.cam.pitch + .08), ArrowDown: () => this.cam.pitch = Math.max(.05, this.cam.pitch - .08), '+': () => this.zoom(1.15), '=': () => this.zoom(1.15), '-': () => this.zoom(1 / 1.15) }[e.key];
        if (k) { e.preventDefault(); k(); }
      });
    }
    this.resize(); new ResizeObserver(() => this.resize()).observe(cv);
    const loop = () => { this.frame(); requestAnimationFrame(loop); }; loop();
  }
  zoom(f) { this.cam.zoom = Math.max(.4, Math.min(3, this.cam.zoom * f)); }
  resize() { const d = devicePixelRatio || 1; this.w = this.cv.clientWidth; this.h = this.cv.clientHeight; this.cv.width = this.w * d; this.cv.height = this.h * d; this.ctx.setTransform(d, 0, 0, d, 0, 0); }
  project(p) {
    const c = this.cam, x = p.x - c.px, y = p.y - c.py, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    const x1 = x * cy - p.z * sy, z1 = x * sy + p.z * cy, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const y1 = y * cp + z1 * sp, z2 = z1 * cp - y * sp, s = 700 / (1100 + z2) * c.zoom * (this.w < 600 ? .75 : 1);
    return { x: this.w / 2 + x1 * s, y: this.h / 2 + 40 - y1 * s, s, z: z2 };
  }
  click(e) {
    const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const h = this.hits.filter(h => Math.hypot(h.x - x, h.y - y) < h.r + 6).sort((a, b) => a.z - b.z)[0];
    if (h && this.o.onNode) this.o.onNode(h.i);
  }
  frame() {
    const v = this.get(); if (!v || !this.w) return;
    if (this.o.auto) this.cam.yaw += .003;
    advanceBus(v);
    drawNetwork(this, v);
  }
}
/** Bus moves along the segments of the current route; `u` = fractional segment index. */
function advanceBus(v) {
  if (!v.routeIdx || v.routeIdx.length < 2) return;
  const end = v.routeIdx.length - 1;
  v.u += v.busSpeed || BUS[$('#speedSel') ? $('#speedSel').value : 'normal'] * (v.alg === 'brute' ? 3 : 1);
  if (v.u >= end) { v.u = v.loop ? 0 : end; }
}
function busPoint(v) {
  if (!v.routeIdx) return { x: v.pos[0].x, y: v.pos[0].y, z: v.pos[0].z };
  const u = Math.min(v.u, v.routeIdx.length - 1), i = Math.min(Math.floor(u), v.routeIdx.length - 2), f = u - i;
  if (i < 0) return v.pos[0];
  const a = v.pos[v.routeIdx[i]], b = v.pos[v.routeIdx[i + 1]];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
}
/** Renders the whole network for the current execution state. */
function drawNetwork(sc, v) {
  const c = sc.ctx, G = v.G, n = G.names.length, P = v.pos.map(p => sc.project(p));
  c.clearRect(0, 0, sc.w, sc.h); sc.hits = [];
  c.lineWidth = 1; c.setLineDash([]);
  for (const r of [100, 200, 300]) { c.beginPath(); for (let k = 0; k <= 48; k++) { const a = k / 48 * 6.2832, q = sc.project({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } c.strokeStyle = 'rgba(148,163,184,.12)'; c.stroke(); }
  let mx = 1; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) mx = Math.max(mx, G.M[i][j]);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {          // edge width/opacity encode distance (short = strong)
    const t = 1 - G.M[i][j] / mx; c.globalAlpha = .06 + .22 * t; c.lineWidth = .5 + 2 * t; c.strokeStyle = '#94a3b8';
    c.beginPath(); c.moveTo(P[i].x, P[i].y); c.lineTo(P[j].x, P[j].y); c.stroke();
  }
  c.globalAlpha = 1;
  const label = (x, y, t, col = '#e6ebf5') => { c.font = '600 11px ui-monospace,monospace'; const w = c.measureText(t).width + 8; c.fillStyle = 'rgba(7,11,20,.85)'; c.fillRect(x - w / 2, y - 9, w, 17); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x, y); };
  const path = (idx, style) => {
    if (!idx || idx.length < 2) return;
    c.save(); c.lineCap = 'round';
    if (style === 'cand') { c.setLineDash([7, 6]); c.strokeStyle = '#818cf8'; c.lineWidth = 2.5; }
    else if (style === 'best') { c.strokeStyle = '#5eead4'; c.lineWidth = 4.5; c.shadowColor = '#5eead4'; c.shadowBlur = 14; }
    else { c.strokeStyle = '#5eead4'; c.lineWidth = 3; }
    for (let k = 0; k < idx.length - 1; k++) {
      const a = P[idx[k]], b = P[idx[k + 1]]; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      const ang = Math.atan2(b.y - a.y, b.x - a.x), mxp = a.x + (b.x - a.x) * .6, myp = a.y + (b.y - a.y) * .6;
      c.save(); c.setLineDash([]); c.shadowBlur = 0; c.translate(mxp, myp); c.rotate(ang); c.fillStyle = c.strokeStyle; c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-5, 5); c.fill(); c.restore();
    }
    c.restore();
    if (style !== 'cand' || v.alg === 'brute') for (let k = 0; k < idx.length - 1; k++) { const a = P[idx[k]], b = P[idx[k + 1]]; label((a.x + b.x) / 2, (a.y + b.y) / 2 - 10, G.M[idx[k]][idx[k + 1]] + ' km', '#5eead4'); }
  };
  if (v.trail) v.trail.forEach((idx, k) => { c.save(); c.globalAlpha = .1 + .25 * (k + 1) / v.trail.length; c.strokeStyle = '#818cf8'; c.lineWidth = 1.5; c.beginPath(); idx.forEach((q, m) => (m ? c.lineTo(P[q].x, P[q].y) : c.moveTo(P[q].x, P[q].y))); c.stroke(); c.restore(); });
  if (v.bestIdx) path(v.bestIdx, 'best');
  if (v.routeIdx) path(v.routeIdx, v.routeStyle === 'cand' ? 'cand' : v.routeStyle === 'best' ? 'best' : 'path');
  if (v.dpHL) {                                                         // DP: highlight the state's subset and transition edge
    const h = v.dpHL; c.save(); c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.setLineDash([2, 5]);
    if (h.from >= 0) { c.beginPath(); c.moveTo(P[h.from].x, P[h.from].y); c.lineTo(P[h.last].x, P[h.last].y); c.stroke(); }
    c.restore();
  }
  v.scan.forEach(s => {                                                  // greedy distance beams
    const j = G.names.indexOf(s.name), chosen = v.sel === s.name; c.save();
    c.strokeStyle = chosen ? '#fbbf24' : '#94a3b8'; c.lineWidth = chosen ? 4 : 1.5; if (!chosen) c.setLineDash([4, 5]);
    c.beginPath(); c.moveTo(P[v.cur].x, P[v.cur].y); c.lineTo(P[j].x, P[j].y); c.stroke(); c.restore();
    label((P[v.cur].x + P[j].x) / 2, (P[v.cur].y + P[j].y) / 2, s.distance + ' km' + (chosen ? ' ◀ MIN' : ''), chosen ? '#fbbf24' : '#cbd5e1');
  });
  const order = P.map((p, i) => i).sort((a, b) => P[b].z - P[a].z), t = performance.now() / 400;
  for (const i of order) {
    const p = P[i], r = Math.max(6, (i ? 10 : 16) * p.s), g = sc.project({ ...v.pos[i], y: 0 });
    c.strokeStyle = 'rgba(148,163,184,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(g.x, g.y); c.lineTo(p.x, p.y); c.stroke();   // stem to ground
    const cur = i === v.cur && v.status !== 'IDLE', vis = v.visited.has(i) && i > 0, inHL = v.hl.includes(i) || (v.dpHL && (v.dpHL.subset.includes(i) || v.dpHL.last === i));
    if (cur) { c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r + 5 + 2 * Math.sin(t), 0, 6.3); c.stroke(); }
    if (inHL) { c.strokeStyle = '#818cf8'; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.arc(p.x, p.y, r + 9, 0, 6.3); c.stroke(); c.setLineDash([]); }
    const gr = c.createRadialGradient(p.x - r / 3, p.y - r / 3, 1, p.x, p.y, r);
    gr.addColorStop(0, i === 0 ? '#c7d2fe' : vis ? '#86efac' : '#cbd5e1'); gr.addColorStop(1, i === 0 ? '#4f46e5' : vis ? '#15803d' : '#334155');
    c.fillStyle = gr; c.strokeStyle = i === selNode ? '#fff' : 'rgba(255,255,255,.5)'; c.lineWidth = i === selNode ? 3 : 1.2;
    if (i === 0) { c.beginPath(); c.roundRect(p.x - r, p.y - r, 2 * r, 2 * r, 4); } else { c.beginPath(); c.arc(p.x, p.y, r, 0, 6.3); }
    c.fill(); c.stroke();
    if (v.invalid && i) { c.fillStyle = '#f87171'; c.font = `700 ${r * 1.3}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('△', p.x, p.y); }
    else if (vis) { c.fillStyle = '#052e16'; c.font = `700 ${r * 1.2}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✓', p.x, p.y); }
    const nm = G.names[i].toUpperCase();
    label(p.x, p.y - r - 22, nm, i === 0 ? '#c7d2fe' : '#e6ebf5');
    label(p.x, p.y - r - 7, i === 0 ? 'COLLEGE DEPOT' : G.students[i] + ' STUDENTS', '#93a0b8');
    if (v.routeStyle === 'cand' && v.routeIdx && i) { const k = v.routeIdx.indexOf(i); if (k > 0) label(p.x + r + 16, p.y, '#' + k, '#fbbf24'); }   // visit order in the candidate
    const grp = v.groups && (v.groups.A.includes(i) ? 'A' : v.groups.B.includes(i) ? 'B' : ''); if (grp) label(p.x, p.y + r + 12, 'GROUP ' + grp, '#818cf8');
    sc.hits.push({ i, x: p.x, y: p.y, r, z: p.z });
  }
  const b = sc.project(busPoint(v)), w = Math.max(22, 40 * b.s), h = w * .5;   // the bus
  c.save(); c.translate(b.x, b.y - h * .9);
  c.fillStyle = '#fbbf24'; c.strokeStyle = '#78350f'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 4); c.fill(); c.stroke();
  c.fillStyle = '#0b1222'; for (let k = 0; k < 4; k++) c.fillRect(-w / 2 + 3 + k * (w - 6) / 4, -h / 2 + 3, (w - 6) / 4 - 2, h * .38);
  c.fillStyle = '#1f2937'; c.beginPath(); c.arc(-w / 3, h / 2, h * .17, 0, 6.3); c.arc(w / 3, h / 2, h * .17, 0, 6.3); c.fill(); c.restore();
}

/* ---------- Execution controller: consumes the algorithm's state stream ---------- */
function resetView() { V = newView(G); }
function startAlg(alg, auto = true) {
  stopAlg(true);
  const errs = validateInput(S, alg);
  if (errs.length) { showLabMsg(errs); return false; }
  showLabMsg([]); G = buildGraph(S); resetView(); R.alg = alg; R.timeMs = timeRun(alg, G).ms;
  R.gen = ALGFN[alg](G); R.running = true; R.paused = !auto; V.alg = alg; V.status = auto ? 'RUNNING' : 'PAUSED';
  V.dp = { recent: [], levels: {}, stats: null }; V.step = 0; V.logs = []; V.busSpeed = null;
  log(`Starting <b>${esc(NAME[alg])}</b> on ${G.names.length - 1} pickup locations`);
  if (alg === 'dp') for (let k = 1; k <= G.names.length - 1; k++) V.dp.levels[k] = 0;
  renderLive(); if (auto) schedule();
  return true;
}
function schedule() { clearTimeout(R.timer); R.timer = setTimeout(tick, DELAY[$('#speedSel').value]); }
function tick() {
  if (!R.running || R.paused) return;
  const sp = $('#speedSel').value;
  if (R.alg === 'brute' && sp !== 'fast' && V.routeIdx && V.u < V.routeIdx.length - 1.01) { R.timer = setTimeout(tick, 30); return; }   // let the bus finish the current route
  for (let k = 0; k < (R.alg === 'brute' && sp !== 'fast' ? 1 : BATCH[sp]); k++) if (!stepOnce()) break;
  renderLive(); if (R.running && !R.paused) schedule();
}
function stepOnce() {
  const r = R.gen.next();
  if (r.done) { finishAlg(r.value); return false; }
  updateExecutionPanel(r.value); return true;
}
function stopAlg(silent) {
  clearTimeout(R.timer); const was = R.running; R.running = false; R.gen = null; R.paused = false;
  if (V && !silent && was) { V.status = 'STOPPED'; log('Execution stopped by user'); renderLive(); }
}
/** Turns each execution-state object into visualization state + a log line (nothing is hard-coded). */
function updateExecutionPanel(s) {
  const nmIdx = n => V.G.names.indexOf(n);
  switch (s.type) {
    case 'candidate':
      V.trail = V.trail || []; if (V.routeIdx && V.routeStyle === 'cand') { V.trail.push(V.routeIdx); if (V.trail.length > 6) V.trail.shift(); }   // ghost of recently tried routes
      V.bf = V.bf || []; V.bf.push({ n: s.checked, route: s.route, d: s.distance, imp: s.improved }); if (V.bf.length > 60) V.bf.shift();
      V.route = null; animateRoute(s.route); V.routeStyle = 'cand'; V.routeComplete = true; V.cand = s; V.cur = 0;
      if (s.improved) V.bestIdx = s.bestRoute.map(nmIdx);
      log(`ROUTE ${String(s.checked).padStart(2, '0')} / ${s.total}: ${s.route.map(esc).join(' → ')} = ${s.distance} km${s.improved ? ' ★ new best' : ''}`); break;
    case 'start': log(`Starting Kruskal MST from ${esc(s.current)} — sorting ${s.edges} edges`); animateRoute([s.current]); V.routeStyle = 'path'; break;
    case 'edge': V.scan = []; V.sel = null; log(`Edge ${esc(s.from)} — ${esc(s.to)} (${s.distance} km): ${s.accepted ? '<b>ACCEPTED</b> (joins two components)' : 'rejected (would form a cycle)'} — MST edges ${s.mstEdges}`); break;
    case 'scan': V.scan = s.candidates; V.sel = null; V.cur = nmIdx(s.current);
      log(`Scanning unvisited locations from ${esc(s.current)}`); s.candidates.forEach(c => log(`Candidate ${esc(c.name)} — ${c.distance} km`)); break;
    case 'select': V.sel = s.candidate; log(`Next stop in MST preorder: <b>${esc(s.candidate)}</b> (${s.distance} km)`); break;
    case 'move': V.scan = []; V.sel = null; V.visited.add(nmIdx(s.to)); V.cur = nmIdx(s.to); animateRoute(s.route, { reset: false }); V.routeStyle = 'path'; V.greedy = s;
      log(`Moving to ${esc(s.to)} (+${s.added} km, total ${s.total} km)`); log(`${esc(s.to)} marked visited`); break;
    case 'return': V.scan = []; animateRoute(s.route, { reset: false }); V.routeComplete = true; V.greedy = s; log(`All locations visited — returning to depot (+${s.added} km, total ${s.total} km)`); break;
    case 'dp-state': {
      V.dp.recent.push(s); if (V.dp.recent.length > 8) V.dp.recent.shift(); V.dp.levels[s.size]++; V.dp.stats = s;
      V.dpHL = { subset: s.subset.map(nmIdx), last: nmIdx(s.last), from: s.from ? nmIdx(s.from.last) : -1 };
      log(`dp[{${s.subset.map(esc).join(',')}}][${esc(s.last)}] = ${s.distance} km` + (s.from ? ` (via {${s.from.subset.map(esc).join(',')}}→${esc(s.from.last)} REUSED)` : ' (base: from depot)')); break; }
    case 'reconstruct': V.dpHL = null; V.dp.stats = s; animateRoute(s.route); V.routeStyle = 'best'; V.routeComplete = true; log(`Reconstructed route via parent pointers: ${s.route.map(esc).join(' → ')} = ${s.distance} km`); break;
    case 'open': V.tree.push({ id: s.id, parent: s.parent, depth: s.depth, locations: s.locations, status: 'open' }); V.hl = s.locations.map(nmIdx);
      log(`Recursion depth ${s.depth}: opening subproblem [${s.locations.map(esc).join(', ')}]`); break;
    case 'divide': V.groups = { A: s.groupA.map(nmIdx), B: s.groupB.map(nmIdx) }; log(`Dividing into Group A [${s.groupA.map(esc).join(', ')}] and Group B [${s.groupB.map(esc).join(', ')}]`); break;
    case 'base': case 'merge': { const t = V.tree.find(x => x.id === s.id); Object.assign(t, { status: 'done', path: s.path, length: s.length, how: s.type, tried: s.tried });
      V.hl = s.path.map(nmIdx); V.groups = null; V.routeIdx = [0, ...s.path.map(nmIdx), 0]; V.route = V.routeIdx.map(i => V.G.names[i]); V.routeStyle = 'cand'; V.u = 0;
      log(s.type === 'base' ? `Base case solved: ${s.path.map(esc).join(' → ')} (path ${s.length} km, ${s.tried} orders tried)` : `Merged subroutes (${s.tried} combinations tried): ${s.path.map(esc).join(' → ')} (path ${s.length} km)`); break; }
  }
}
function finishAlg(r) {
  const res = { ...r, ms: R.timeMs, alg: R.alg }; results[R.alg] = res; R.running = false; R.gen = null;
  V.status = 'COMPLETE'; V.scan = []; V.hl = []; V.groups = null; V.dpHL = null; V.sel = null; V.visited = new Set(res.route.map(n => G.names.indexOf(n)));
  V.bestIdx = res.route.map(n => G.names.indexOf(n)); V.routeStyle = 'best'; V.routeComplete = true; animateRoute(res.route); V.cur = 0;
  log(`<b>${esc(SHORT[R.alg])} finished</b>: ${res.route.map(esc).join(' → ')} = ${res.distance} km`);
  renderLive(); renderResult(res); compareAlgorithms(); renderHeader(); renderMethodGraphs(); if (R.alg === 'greedy') buildMethodExplorer('greedy'); if (R.alg === 'dp') buildMethodExplorer('dp'); if (R.alg === 'dc') buildMethodExplorer('dc');
}

/* ---------- live panels ---------- */
function renderLive() {
  if (!V) return;
  const lg = $('#log'); lg.innerHTML = V.logs.join('') || '<div class="note">No execution yet. Choose an algorithm and press START.</div>'; lg.scrollTop = lg.scrollHeight;
  renderState(); updateTelemetry();
  $('#btnPause').textContent = R.paused ? '▶ RESUME' : '⏸ PAUSE'; $('#btnPause').disabled = !R.running;
  $('#btnStop').disabled = !R.running; $('#btnStart').disabled = R.running && !R.paused;
}
function renderState() {
  const el = $('#statePanel'), a = V.alg || tab;
  if (!V.alg) { el.innerHTML = '<p class="note">Algorithm state appears here while it runs.</p>'; return; }
  if (a === 'brute') {
    const c = V.cand;
    if (!c) el.innerHTML = '<p class="note">Waiting for the first permutation…</p>';
    else {
      const names = V.G.names.slice(1), n = names.length, r = c.route.slice(1, -1);
      const lv = r.map((x, k) => { const used = new Set(r.slice(0, k)), opts = names.filter(y => !used.has(y)), ci = opts.indexOf(x);
        return `<div><span class="lv">L${k + 1}</span>${opts.map((y, q) => `<span class="chip ${q < ci ? 'done' : q === ci ? 'cur' : ''}">${q < ci ? '✓ ' : q === ci ? '▶ ' : ''}${esc(y)}</span>`).join('')}</div>`; }).join('');
      const top = names.indexOf(r[0]) + 1;
      el.innerHTML = `<div class="kv"><span>Routes checked</span><b>${c.checked} / ${c.total}</b><span>Current distance</span><b>${c.distance} km</b><span>Best distance</span><b>${c.best} km</b><span>Best route</span><b class="mono">${c.bestRoute.map(esc).join(' → ')}</b><span>First-stop branch</span><b>${top} of ${n}</b></div>
      <h3 style="margin-top:12px">Route tree — choice made at each level</h3><div class="bft">${lv}</div><p class="note">▶ = branch being explored · ✓ (struck) = branches already fully explored · plain chips are still to come.</p>
      <h3>Every route tried (latest first)</h3><table class="tbl">${V.bf.slice(-12).reverse().map((x, q) => `<tr class="${q === 0 ? 'sel' : ''}"><td>#${x.n}</td><td class="mono">${x.route.slice(1, -1).map(esc).join('›')}</td><td>${x.d} km</td><td>${x.imp ? '★ best' : ''}</td></tr>`).join('')}</table>`;
    }
  }
  if (a === 'greedy') {
    const rows = V.scan.map(s => `<tr class="${V.sel === s.name ? 'sel' : ''}"><td>${esc(s.name)}</td><td>${s.distance} km</td><td>${V.sel === s.name ? '◀ SELECTED' : ''}</td></tr>`).join('');
    el.innerHTML = `<div class="kv"><span>Current location</span><b>${esc(V.G.names[V.cur])}</b><span>Distance added</span><b>${V.greedy ? V.greedy.added + ' km' : '—'}</b><span>Total distance</span><b>${V.greedy ? V.greedy.total + ' km' : '0 km'}</b></div>${rows ? `<table class="tbl"><tr><th>Candidate</th><th>Distance</th><th></th></tr>${rows}</table>` : ''}`;
  }
  if (a === 'dp') {
    const m = V.G.names.length - 1, st = V.dp.stats, lv = Object.keys(V.dp.levels).map(k => { const tot = choose(m, +k) * +k; return `<div><span>|S| = ${k}</span><div class="bar"><i style="width:${100 * V.dp.levels[k] / tot}%"></i></div><span>${V.dp.levels[k]}/${tot}</span></div>`; }).join('');
    const cur = V.dp.recent[V.dp.recent.length - 1];
    el.innerHTML = `<div class="kv"><span>States calculated</span><b>${st ? st.states : 0}</b><span>States reused (lookups)</span><b>${st ? st.lookups : 0}</b><span>Transitions</span><b>${st ? st.trans : 0}</b><span>Final minimum</span><b>${st && st.type === 'reconstruct' ? st.distance + ' km' : '…'}</b></div><div class="dpbars">${lv}</div>` +
      (cur ? `<p class="mono">STATE {${cur.subset.map(esc).join(',')}} → ${esc(cur.last)}<br>min distance = <b>${cur.distance} km</b><br>${cur.from ? `from {${cur.from.subset.map(esc).join(',')}} → ${esc(cur.from.last)} (${cur.from.distance}) + d = ${cur.from.edge} <span class="badge r">REUSED</span>` : 'base state: depot → ' + esc(cur.last)}</p>` : '') +
      `<table class="tbl">${V.dp.recent.slice().reverse().map(s => `<tr><td class="mono">{${s.subset.map(esc).join(',')}} → ${esc(s.last)}</td><td>${s.distance}</td></tr>`).join('')}</table>`;
  }
  if (a === 'dc') {
    const t = treeSel != null && V.tree.find(x => x.id === treeSel);
    el.innerHTML = `<div class="tree">${V.tree.map(n => `<button data-node="${n.id}" class="${n.id === treeSel ? 'sel' : ''}" style="padding-left:${6 + n.depth * 16}px">${n.status === 'done' ? '✓' : '…'} [${n.locations.map(esc).join(' ')}]</button>`).join('')}</div>` +
      (t ? `<div class="kv"><span>Locations</span><b>${t.locations.map(esc).join(', ')}</b><span>Subroute</span><b>${t.path ? t.path.map(esc).join(' → ') : 'solving…'}</b><span>Distance</span><b>${t.length ?? '—'} km</b><span>Depth</span><b>${t.depth}</b><span>Parent</span><b>${t.parent == null ? 'root' : '[' + V.tree.find(x => x.id === t.parent).locations.map(esc).join(' ') + ']'}</b></div>` : '<p class="note">Click a recursion node for details.</p>') +
      '<p class="note">Heuristic — does not guarantee the globally shortest route for every dataset.</p>';
  }
}
function updateTelemetry() {
  const v = V, G = v.G, ri = v.routeIdx; let loc = G.names[v.cur], onb = 0, trav = 0, tot = null, stops = 0;
  if (ri && ri.length > 1) {
    const u = Math.min(v.u, ri.length - 1), i = Math.min(Math.floor(u), ri.length - 2), f = u - i, seen = new Set();
    for (let k = 0; k < i; k++) trav += G.M[ri[k]][ri[k + 1]];
    trav += f * G.M[ri[i]][ri[i + 1]]; loc = G.names[ri[Math.round(u)]];
    for (let k = 1; k <= Math.floor(u); k++) if (ri[k]) seen.add(ri[k]);
    seen.forEach(x => onb += G.students[x]); stops = seen.size;
    if (v.routeComplete) { tot = 0; for (let k = 0; k < ri.length - 1; k++) tot += G.M[ri[k]][ri[k + 1]]; }
  }
  const pct = G.cap ? 100 * onb / G.cap : 0;
  $('#tele').innerHTML = `<div><small>CURRENT LOCATION</small><b>${esc(loc)}</b></div><div><small>STATUS</small><b>${v.status}</b></div><div><small>STUDENTS ONBOARD</small><b>${onb} / ${G.cap}</b></div><div><small>CAPACITY</small><b>${pct.toFixed(1)}%</b></div>
  <div><small>DISTANCE TRAVELLED</small><b>${fmt(trav)} km</b></div><div><small>REMAINING DISTANCE</small><b>${tot == null ? '—' : fmt(Math.max(0, tot - trav)) + ' km'}</b></div><div><small>STOPS</small><b>${stops} / ${G.names.length - 1}</b></div><div><small>ALGORITHM</small><b>${v.alg ? esc(SHORT[v.alg]) : '—'}</b></div>
  <div class="w"><div class="bar ${onb > G.cap ? 'over' : ''}"><i style="width:${Math.min(100, pct)}%"></i></div></div>`;
}
function renderResult(r) {
  const G2 = buildGraph(S), stud = G2.students.reduce((a, b) => a + b, 0), mins = r.distance / G2.speed * 60;
  const optimal = r.optimal ? '<span class="badge">YES — exact for this model</span>' : '<span class="badge b">NOT GUARANTEED</span>';
  $('#result').innerHTML = `<h3 style="color:var(--acc)">${esc(NAME[r.alg])}</h3><p class="mono">${r.route.map(esc).join('<br>↓<br>')}</p><div class="kv"><span>Total distance</span><b>${r.distance} km</b><span>Estimated time*</span><b>${mins.toFixed(0)} min @ ${G2.speed} km/h</b><span>Stops</span><b>${G2.names.length - 1}</b><span>Students</span><b>${stud}</b><span>Capacity utilisation</span><b>${(100 * stud / G2.cap).toFixed(1)}%</b><span>Execution time</span><b>${r.ms.toFixed(2)} ms</b><span>States / routes processed</span><b>${r.states.toLocaleString()}</b><span>Optimal</span>${optimal}</div><p class="note">*Estimate = distance ÷ average speed; ignores boarding time and traffic.</p>`;
}
function showLabMsg(errs) { $('#labMsg').innerHTML = errs.map(e => `<p class="e">⚠ ${esc(e)}</p>`).join(''); }

/* ---------- comparison, best-algorithm engine, conclusion ---------- */
const SPACE = { brute: 'O(n)', greedy: 'O(n²)', dp: 'O(n · 2ⁿ)', dc: 'O(n)' };
const SCALE = { brute: `Impractical beyond n ≈ ${LIM.brute}–10 (n!)`, greedy: 'Scales well (O(n² log n))', dp: `Limited here to n ≤ ${LIM.dp}; exponential`, dc: 'Scales well (O(n²) heuristic)' };
function compareAlgorithms() {
  const done = ALGS.filter(a => results[a] && !results[a].skipped), best = done.length ? Math.min(...done.map(a => results[a].distance)) : null;
  $('#cmpTable').innerHTML = '<tr><th>Algorithm</th><th>Distance</th><th>Exec time</th><th>Search states</th><th>Space</th><th>Optimality</th><th>Scalability</th></tr>' + ALGS.map(a => {
    const r = results[a]; if (!r || r.skipped) return `<tr><td>${esc(SHORT[a])}</td><td colspan="6" class="note">${r ? 'Skipped: ' + esc(r.skipped) : 'Not run yet'}</td></tr>`;
    return `<tr class="${r.distance === best ? 'winner' : ''}"><td><b>${esc(SHORT[a])}</b></td><td>${r.distance} km ${r.distance === best ? '✓ best found' : '(+' + fmt(r.distance - best) + ')'}</td><td>${r.ms.toFixed(2)} ms</td><td>${r.states.toLocaleString()}</td><td>${SPACE[a]}</td><td>${r.optimal ? 'Exact' : 'Heuristic — not guaranteed'}</td><td>${SCALE[a]}</td></tr>`;
  }).join('');
  const maxMs = Math.max(...done.map(a => results[a].ms), 1e-9), maxSt = Math.max(...done.map(a => results[a].states), 1);
  $('#race').innerHTML = ALGS.map(a => { const r = results[a]; if (!r || r.skipped) return `<div class="glass"><h4>${esc(SHORT[a])}</h4><p class="note">${r ? esc(r.skipped) : 'Waiting…'}</p></div>`;
    const q = 100 * best / r.distance, t = 100 * r.ms / maxMs, s = 100 * Math.log(r.states + 1) / Math.log(maxSt + 1);
    return `<div class="glass ${r.distance === best ? 'winner' : ''}"><h4>${esc(SHORT[a])}</h4>
    <div class="m">ROUTE QUALITY (best ÷ this distance) — ${q.toFixed(1)}%<div class="bar"><i style="width:${q}%"></i></div></div>
    <div class="m">MEASURED TIME — ${r.ms.toFixed(2)} ms (relative to slowest)<div class="bar"><i style="width:${t}%"></i></div></div>
    <div class="m">STATES EVALUATED — ${r.states.toLocaleString()} (log scale)<div class="bar"><i style="width:${s}%"></i></div></div></div>`; }).join('');
  renderBestEngine(done, best); renderInsights(); renderBF();
}
function renderBestEngine(done, best) {
  if (!done.length) { $('#bestEngine').innerHTML = '<p class="note">Run algorithms to see which is best for the current dataset.</p>'; $('#concl').innerHTML = '<p class="note">The conclusion is generated from real results — run at least one algorithm.</p>'; return; }
  const pick = f => done.slice().sort(f)[0];
  const bq = pick((a, b) => results[a].distance - results[b].distance || (results[b].optimal - results[a].optimal) || results[a].states - results[b].states);
  const fast = pick((a, b) => results[a].ms - results[b].ms);
  const exact = done.filter(a => results[a].optimal), ties = done.filter(a => results[a].distance === best);
  let why = `For this dataset, <b>${esc(SHORT[bq])}</b> produced the shortest route found (${best} km)`;
  if (results.dp && results.brute && results.dp.distance === results.brute.distance) why += `; Dynamic Programming matched the exhaustive optimum while evaluating ${results.dp.states.toLocaleString()} DP states versus ${results.brute.states.toLocaleString()} brute-force routes`;
  if (results.greedy && best) why += `; Kruskal MST was ${results.greedy.distance === best ? 'also optimal here' : fmt(100 * (results.greedy.distance - best) / best) + '% longer than the best'}`;
  if (results.dc && best) why += `; the Divide & Conquer heuristic was ${results.dc.distance === best ? 'also optimal here' : fmt(100 * (results.dc.distance - best) / best) + '% longer than the best'}`;
  why += '.';
  $('#bestEngine').innerHTML = `<h3>Best algorithm engine</h3><div class="kv"><span>Best route quality</span><b>${ties.map(a => esc(SHORT[a])).join(', ')}</b><span>Fastest measured</span><b>${esc(SHORT[fast])} (${results[fast].ms.toFixed(2)} ms)</b><span>Exact guarantee</span><b>${exact.length ? exact.map(a => esc(SHORT[a])).join(', ') : 'none run yet'}</b></div><p>${why}</p><p class="note">Trade-off: exact methods guarantee quality but scale poorly; heuristics are quicker but may return longer routes. Timings are browser-dependent.</p>`;
  const r = results[bq];
  $('#concl').innerHTML = `<div class="grid2"><div><h3>Brute force</h3><p>Highest exhaustive search accuracy for small instances, but factorial growth makes it impractical as n increases.</p><h3>Kruskal MST (greedy)</h3><p>Builds a minimum spanning tree greedily and walks it in preorder. Fast, but the tour is only an approximation.</p></div><div><h3>Dynamic programming</h3><p>Provides an exact solution for the modeled route optimization problem using Held-Karp, but its exponential state-space limits scalability.</p><h3>Divide &amp; Conquer</h3><p>Useful for decomposing the problem, but the implemented heuristic does not guarantee the global optimum.</p></div></div>
  <div class="glass winner"><h3>🏆 Best solution for current dataset</h3><div class="kv"><span>Algorithm</span><b>${esc(NAME[bq])}</b><span>Route</span><b class="mono">${r.route.map(esc).join(' → ')}</b><span>Distance</span><b>${r.distance} km</b><span>Reason</span><span style="color:var(--txt)">${why}</span></div></div>`;
}
function renderHeader() {
  const done = ALGS.filter(a => results[a] && !results[a].skipped), best = done.length ? done.slice().sort((a, b) => results[a].distance - results[b].distance || results[b].optimal - results[a].optimal)[0] : null;
  $('#hLoc').textContent = S.locs.length; $('#hStu').textContent = totalStudents(S); $('#hCap').textContent = S.cap;
  $('#hDist').textContent = best ? results[best].distance + ' km' : '—'; $('#hBest').textContent = best ? SHORT[best] : '—'; $('#hDone').textContent = done.length + ' / 4';
}

/* ---------- Run all ---------- */
async function runAll() {
  stopAlg(true); const base = validateInput(S, null);
  if (base.length) { showLabMsg(base); return; }
  showLabMsg([]); G = buildGraph(S); resetView(); results = {}; const pg = $('#progress'); pg.hidden = false; $('#runAll').disabled = true; let k = 0;
  for (const a of ALGS) {
    pg.querySelector('span').textContent = `Running ${SHORT[a]}… (${k}/4)`; pg.querySelector('i').style.width = 100 * k / 4 + '%'; await new Promise(r => setTimeout(r, 40));
    const e = validateInput(S, a);
    results[a] = e.length ? { skipped: e[e.length - 1], alg: a } : timeRun(a, G); k++; compareAlgorithms(); renderHeader();
  }
  pg.querySelector('i').style.width = '100%'; pg.querySelector('span').textContent = 'Complete — animating the winning route';
  const done = ALGS.filter(a => !results[a].skipped), w = done.sort((a, b) => results[a].distance - results[b].distance || results[b].optimal - results[a].optimal)[0], r = results[w];
  resetView(); V.alg = w; V.status = 'COMPLETE'; V.visited = new Set(r.route.map(n => G.names.indexOf(n))); V.bestIdx = r.route.map(n => G.names.indexOf(n)); V.routeStyle = 'best'; V.routeComplete = true; animateRoute(r.route);
  log(`Run all complete. Winner: <b>${esc(SHORT[w])}</b> — ${r.distance} km`); renderLive(); renderResult(r); renderMethodGraphs(); buildMethodExplorer('greedy'); buildMethodExplorer('dp'); buildMethodExplorer('dc'); $('#runAll').disabled = false; setTimeout(() => pg.hidden = true, 2500);
}

/* ---------- Data builder UI ---------- */
function structural() { dataChanged(true); }
function dataChanged(full) {
  stopAlg(true); results = {}; G = buildGraph(S); resetView(); selNode = null;
  if (full) renderBuilder(); clearMethodExplorers(); renderMeta(); renderHeader(); compareAlgorithms(); renderLive(); $('#result').innerHTML = 'Run an algorithm to see its result card.'; $('#nodeInfo').textContent = 'Click a node in the 3D scene.'; showLabMsg([]); renderComplexity(); renderBF();
}
function renderMeta() {
  const tot = totalStudents(S), cap = Number(S.cap), over = cap > 0 && tot > cap;
  $('#capBox').innerHTML = `<div class="kv"><span>TOTAL STUDENTS</span><b>${tot}</b><span>CAPACITY</span><b>${esc(S.cap)}</b><span>UTILIZATION</span><b>${cap > 0 ? (100 * tot / cap).toFixed(1) : '—'}%</b></div><div class="bar ${over ? 'over' : ''}"><i style="width:${cap > 0 ? Math.min(100, 100 * tot / cap) : 0}%"></i></div>${over ? '<p class="e" style="color:var(--bad)">⚠ CAPACITY CONSTRAINT VIOLATED — Bus capacity exceeded.</p>' : ''}`;
  const e = validateInput(S, null);
  $('#valMsgs').innerHTML = e.length ? e.map(x => `<p class="e">⚠ ${esc(x)}</p>`).join('') : '<p class="o">✓ Input is valid and feasible.</p>';
  const n = S.locs.length + 1; document.querySelectorAll('#matrix input:not([readonly])').forEach(inp => { const v = String(S.D[+inp.dataset.i][+inp.dataset.j] ?? '').trim(); inp.classList.toggle('bad', v === '' || isNaN(Number(v)) || Number(v) < 0); });
}
function renderBuilder() {
  $('#depotName').value = S.depot; $('#capInput').value = S.cap; $('#speedInput').value = S.speed;
  $('#locList').innerHTML = S.locs.map((l, i) => `<div class="locrow"><input data-f="name" data-i="${i}" value="${esc(l.name)}" aria-label="Location ${i + 1} name"><input data-f="s" data-i="${i}" type="number" min="0" value="${esc(l.s)}" aria-label="Students at ${esc(l.name)}"><span class="acts"><button class="btn sm" data-act="up" data-i="${i}" aria-label="Move up">↑</button><button class="btn sm" data-act="down" data-i="${i}" aria-label="Move down">↓</button><button class="btn sm" data-act="del" data-i="${i}" aria-label="Delete ${esc(l.name)}">✕</button></span></div>`).join('');
  const names = [S.depot, ...S.locs.map(l => l.name)];
  $('#matrix').innerHTML = '<tr><th></th>' + names.map(n => `<th scope="col">${esc(n)}</th>`).join('') + '</tr>' + names.map((a, i) => `<tr><th scope="row">${esc(a)}</th>${names.map((b, j) => `<td><input data-i="${i}" data-j="${j}" value="${esc(S.D[i][j] ?? '')}" ${i === j ? 'readonly tabindex="-1"' : ''} inputmode="decimal" aria-label="Distance ${esc(a)} to ${esc(b)}"></td>`).join('')}</tr>`).join('');
  renderMeta();
}
function swapLoc(a, b) { [S.locs[a], S.locs[b]] = [S.locs[b], S.locs[a]]; a++; b++; [S.D[a], S.D[b]] = [S.D[b], S.D[a]]; S.D.forEach(r => { [r[a], r[b]] = [r[b], r[a]]; }); }
function addLocation() {
  const name = $('#newName').value.trim(), s = $('#newStu').value;
  const dup = [S.depot, ...S.locs.map(l => l.name)].some(x => x.trim().toLowerCase() === name.toLowerCase());
  if (!name) return showBuilderErr('Please enter a pickup location.'); if (dup) return showBuilderErr('Location already exists.');
  if (s === '' || Number(s) < 0 || !Number.isInteger(Number(s))) return showBuilderErr('Student count must be a whole number ≥ 0.');
  S.locs.push({ name, s: Number(s) }); S.D.forEach(r => r.push('')); S.D.push(Array(S.locs.length + 1).fill('')); S.D[S.locs.length][S.locs.length] = '0'; $('#newName').value = ''; structural();
}
const showBuilderErr = m => { $('#valMsgs').innerHTML = `<p class="e">⚠ ${esc(m)}</p>`; };
function fillMissing() { const n = S.locs.length + 1; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (String(S.D[i][j]).trim() === '') S.D[i][j] = S.D[j][i] = String(5 + Math.floor(Math.random() * 21)); structural(); }

/* ---------- node inspector ---------- */
function inspectNode(i) {
  selNode = i; const G = V.G, cur = V.cur;
  $('#nodeInfo').innerHTML = `<div class="kv"><span>Location</span><b>${esc(G.names[i])}</b><span>Students</span><b>${G.students[i]}</b><span>Visited</span><b>${V.visited.has(i) ? 'YES ✓' : 'NO'}</b><span>Distance from current (${esc(G.names[cur])})</span><b>${G.M[cur][i]} km</b><span>Distance from depot</span><b>${G.M[0][i]} km</b></div>`;
}

/* ---------- complexity lab ---------- */
function renderComplexity() {
  const N = +$('#cxN').value, cv = $('#cxCanvas'), d = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; cv.width = w * d; cv.height = h * d;
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
  const f = { 'O(n!) brute force': n => fact(n), 'O(n²·2ⁿ) Held-Karp': n => n * n * 2 ** n, 'O(n² log n) Kruskal / D&C': n => n * n };
  const cols = ['#f87171', '#818cf8', '#5eead4'], maxY = Math.max(6, Math.log10(fact(20))), L = 46, B = 28;
  c.strokeStyle = 'rgba(255,255,255,.1)'; c.fillStyle = '#93a0b8'; c.font = '11px sans-serif';
  for (let y = 0; y <= maxY; y += 3) { const py = h - B - (h - B - 10) * y / maxY; c.beginPath(); c.moveTo(L, py); c.lineTo(w - 10, py); c.stroke(); c.fillText('10^' + y, 4, py + 4); }
  Object.values(f).forEach((fn, k) => { c.beginPath(); c.strokeStyle = cols[k]; c.lineWidth = 2.5; c.setLineDash(k === 2 ? [6, 4] : []);
    for (let n = 1; n <= 20; n++) { const x = L + (w - L - 10) * (n - 1) / 19, y = h - B - (h - B - 10) * Math.log10(fn(n)) / maxY; n === 1 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); c.setLineDash([]);
    c.fillStyle = cols[k]; c.fillText(Object.keys(f)[k], L + 10 + k * 190, 16); });
  const cx = L + (w - L - 10) * (N - 1) / 19; c.strokeStyle = '#fbbf24'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(cx, 10); c.lineTo(cx, h - B); c.stroke(); c.setLineDash([]); c.fillStyle = '#fbbf24'; c.fillText('n = ' + N, cx + 4, h - 10);
  $('#cxNval').textContent = N;
  const meas = { brute: 'states', greedy: 'states', dp: 'states', dc: 'states' }, nowN = S.locs.length;
  const th = { brute: fact(N), greedy: N * N * Math.max(1, Math.log2(N)), dp: N * N * 2 ** N, dc: N * N };
  $('#cxTable').innerHTML = '<tr><th>Algorithm</th><th>Theoretical (n=' + N + ')</th><th>Time</th><th>Space</th><th>Measured states (last run, n=' + nowN + ')</th></tr>' + ALGS.map(a => `<tr><td>${esc(SHORT[a])}</td><td>${th[a].toExponential(2)}</td><td>${{ brute: 'O(n!)', greedy: 'O(n² log n) — sort edges + union-find', dp: 'O(n²·2ⁿ)', dc: 'O(n²) — partition + merge' }[a]}</td><td>${SPACE[a]}</td><td>${results[a] && !results[a].skipped ? results[a].states.toLocaleString() : '—'}</td></tr>`).join('');
}

/* ---------- live insight visualizations and exports ---------- */
function canvasContext(id) {
  const cv = document.getElementById(id); if (!cv) return null;
  const d = Math.max(1, window.devicePixelRatio || 1), w = cv.clientWidth || 600, h = cv.clientHeight || 220;
  cv.width = Math.round(w * d); cv.height = Math.round(h * d);
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return { c, w, h };
}
function drawInsightBars(id, labels, values, suffix = ' km') {
  const o = canvasContext(id); if (!o) return; const {c,w,h}=o; c.clearRect(0,0,w,h);
  const L=42,R=14,T=18,B=42, max=Math.max(1,...values), plotW=w-L-R, plotH=h-T-B;
  c.font='11px system-ui'; c.fillStyle='#91a0ba'; c.strokeStyle='rgba(255,255,255,.09)';
  for(let k=0;k<=4;k++){const y=T+plotH*k/4;c.beginPath();c.moveTo(L,y);c.lineTo(w-R,y);c.stroke();c.fillText((max*(1-k/4)).toFixed(max<10?1:0),4,y+4);}
  const slot=plotW/Math.max(1,values.length), bw=Math.min(42,slot*.58);
  values.forEach((v,i)=>{const bh=plotH*v/max,x=L+i*slot+(slot-bw)/2,y=T+plotH-bh;const g=c.createLinearGradient(0,y,0,T+plotH);g.addColorStop(0,'#5eead4');g.addColorStop(1,'#6366f1');c.fillStyle=g;c.beginPath();c.roundRect(x,y,bw,bh,5);c.fill();c.fillStyle='#e6ebf5';c.textAlign='center';c.fillText(Number(v.toFixed(1))+suffix,x+bw/2,Math.max(12,y-6));c.fillStyle='#91a0ba';c.fillText(String(labels[i]).slice(0,9),x+bw/2,h-18);});
}
function getBestRoute() {
  const done=ALGS.map(a=>results[a]).filter(r=>r && !r.skipped && r.route && Number.isFinite(r.distance));
  if(done.length) return done.reduce((a,b)=>b.distance<a.distance?b:a);
  if(V && V.bestRoute && Number.isFinite(V.bestDistance)) return {route:V.bestRoute,distance:V.bestDistance,alg:V.alg};
  return null;
}
function renderInsights() {
  if(!S || !S.locs) return;
  const total=totalStudents(S), cap=Number(S.cap)||0, pct=cap?Math.min(100,total/cap*100):0;
  const best=getBestRoute();
  const legs=[];
  if(best && best.route) for(let i=0;i<best.route.length-1;i++) { const a=G.names.indexOf(best.route[i]),b=G.names.indexOf(best.route[i+1]); if(a>=0&&b>=0) legs.push({label:best.route[i]+' → '+best.route[i+1],distance:G.M[a][b]}); }
  drawInsightBars('legCanvas',legs.map(x=>x.label),legs.map(x=>x.distance));
  const capChart=canvasContext('capacityCanvas'); if(capChart){const {c,w,h}=capChart;c.clearRect(0,0,w,h);const cx=w/2,cy=h/2+2,r=Math.min(w*.22,h*.34);c.lineWidth=18;c.strokeStyle='rgba(255,255,255,.09)';c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();c.strokeStyle=pct>90?'#fbbf24':'#5eead4';c.lineCap='round';c.beginPath();c.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*pct/100);c.stroke();c.textAlign='center';c.fillStyle='#f4f7ff';c.font='700 28px system-ui';c.fillText(pct.toFixed(0)+'%',cx,cy+7);c.font='12px system-ui';c.fillStyle='#91a0ba';c.fillText(total+' / '+cap+' students',cx,cy+30);}
  const done=ALGS.filter(a=>results[a]&&!results[a].skipped&&Number.isFinite(results[a].distance));
  drawInsightBars('qualityCanvas',done.map(a=>SHORT[a]),done.map(a=>results[a].distance));
  const legTotal=legs.reduce((a,x)=>a+x.distance,0), maxLeg=legs.length?legs.reduce((a,x)=>x.distance>a.distance?x:a):null;
  const ls=document.getElementById('legSummary'); if(ls) ls.textContent=best?`Route: ${best.route.join('  →  ')} · Total: ${best.distance.toFixed(1)} km · Longest leg: ${maxLeg?maxLeg.distance+' km':'—'}`:'Run an algorithm to populate the route profile.';
  const cs=document.getElementById('capacitySummary'); if(cs) cs.textContent=`${total} passengers planned · ${pct.toFixed(1)}% utilization · ${Math.max(0,cap-total)} seats remaining`;
  const qs=document.getElementById('qualitySummary'); if(qs) qs.textContent=done.length?`${done.length} algorithm(s) completed · current best: ${SHORT[done.reduce((a,b)=>results[a].distance<results[b].distance?a:b)]}`:'Run one or more algorithms to compare route quality.';
  const rec=[]; if(total>cap) rec.push(['Capacity warning',`Passenger demand exceeds capacity by ${total-cap}. Increase capacity or split the service.`]); else if(pct>=85) rec.push(['High capacity use',`The bus is planned at ${pct.toFixed(0)}% capacity. Keep a small buffer for unexpected passengers.`]); else rec.push(['Capacity headroom',`${Math.max(0,cap-total)} seats remain available in the current plan.`]);
  if(best) {const avg=best.distance/Math.max(1,best.route.length-1);rec.push(['Travel estimate',`At ${Number(S.speed)||0} km/h, the route estimate is ${(best.distance/(Number(S.speed)||1)*60).toFixed(0)} minutes, excluding traffic and stop time.`]);if(maxLeg&&maxLeg.distance>avg*1.5)rec.push(['Review the longest leg',`${maxLeg.label} is notably longer than the average leg. Verify this matrix entry against your source data.`]);}
  if(!best) rec.push(['Run an algorithm','Start an algorithm or choose RUN ALL to generate a route recommendation.']);
  const el=document.getElementById('recommendations'); if(el) el.innerHTML=rec.map(([h,t])=>`<div class="recommendation"><b>${esc(h)}</b><p>${esc(t)}</p></div>`).join('');
}
function downloadFile(name, content, type) { const blob=new Blob([content],{type}), url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function exportComparison() { const rows=[['Algorithm','Distance (km)','Estimated time (min)','Search states','Optimal guarantee','Status']]; ALGS.forEach(a=>{const r=results[a];rows.push([NAME[a],r&&!r.skipped?r.distance.toFixed(2):'',r&&!r.skipped?(r.distance/(Number(S.speed)||1)*60).toFixed(1):'',r&&!r.skipped?r.states:'',r&&!r.skipped?(r.optimal?'Yes':'No'):'',r?(r.skipped?'Skipped':'Completed'):'Not run']);});downloadFile('bus-route-algorithm-comparison.csv',rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv'); }
function exportRouteReport() { const best=getBestRoute();const report={project:'College Bus Route Optimization',generatedAt:new Date().toISOString(),depot:S.depot,busCapacity:Number(S.cap),students:totalStudents(S),averageSpeedKmh:Number(S.speed),locations:S.locs.map(x=>({name:x.name,students:Number(x.s)})),bestRoute:best?{algorithm:NAME[best.alg]||best.alg,stops:best.route,distanceKm:best.distance,estimatedMinutes:best.distance/(Number(S.speed)||1)*60,optimal:!!best.optimal}:null,algorithmResults:Object.fromEntries(ALGS.map(a=>[NAME[a],results[a]&&!results[a].skipped?{distanceKm:results[a].distance,states:results[a].states,optimal:!!results[a].optimal}:null]))};downloadFile('bus-route-report.json',JSON.stringify(report,null,2),'application/json'); }

/* ---------- educational cards ---------- */
const EDU = {
  brute: { what: 'Exhaustive search that tries every possible visiting order.', how: 'Depth-first generation of all permutations of the pickups; each complete route is priced and compared with the best so far.', used: 'Each permutation is wrapped with the depot at both ends and priced with the user\'s distance matrix.', steps: ['Fix the depot as start', 'Generate next permutation', 'Add return leg to depot', 'Compute total distance', 'Keep it if shorter than best', 'Repeat until all n! are checked'], adv: 'Always exact; trivially correct.', dis: 'Factorial growth — unusable beyond ~10 stops.', time: 'O(n!)', space: 'O(n)', when: 'Tiny instances, or to verify other algorithms.' },
  greedy: { what: "Kruskal's minimum-spanning-tree heuristic: build the cheapest tree joining all stops, then walk it in preorder.", how: 'Sort every edge by distance, add the cheapest edge that does not create a cycle (Union-Find) until n-1 edges are chosen, then visit stops in preorder from the depot and return.', used: 'Edges come from the distance matrix; the preorder walk shortcuts already-visited stops using direct matrix distances.', steps: ['Sort all edges by distance', 'Take the cheapest edge', 'Accept it if it joins two different components (no cycle)', 'Repeat until n-1 edges form the MST', 'Walk the MST in preorder from the depot', 'Return to depot'], adv: 'Simple, fast, easy to explain; tour is within 2x optimal when distances obey the triangle inequality.', dis: 'Not exact; shortcuts can make the tour longer than optimal.', time: 'O(n² log n)', space: 'O(n²)', when: 'Large instances or quick approximate routes.' },
  dp: { what: 'Held-Karp: exact route optimization by dynamic programming over subsets.', how: 'dp[S][j] = shortest path from the depot visiting exactly set S and ending at j, built from smaller subsets using bitmasks; parents allow route reconstruction.', used: 'Subsets are stored as bitmasks over the pickups; the final answer closes the tour back to the depot.', steps: ['Base: dp[{j}][j] = d(depot,j)', 'For each subset size 2..n', 'For each last stop j in S', 'dp[S][j] = min over k of dp[S−j][k] + d(k,j)', 'Answer = min dp[all][j] + d(j,depot)', 'Follow parents to rebuild route'], adv: 'Exact and far faster than n!.', dis: 'Exponential time and memory.', time: 'O(n² · 2ⁿ)', space: 'O(n · 2ⁿ)', when: 'Exact answers for up to ~20 stops.' },
  dc: { what: 'A decomposition heuristic (not an exact algorithm).', how: 'Splits pickups into two balanced groups around the farthest pair, solves each recursively, and merges the sub-routes by trying 8 concatenations (order × reversal).', used: 'Base cases (≤3 stops) are solved by trying every order; merges are priced with the real matrix including depot legs.', steps: ['Split stops into groups A and B', 'Recursively solve A and B', 'Base case: try all orders', 'Try all merge orders/orientations', 'Keep cheapest merged route', 'Close the tour at the depot'], adv: 'Simple, scales well, shows recursion.', dis: 'Merge choices are limited, so the result can be sub-optimal. This implementation does not guarantee the global optimum.', time: 'O(n²) (farthest-pair seeding at each level; merge cost is linear per level)', space: 'O(n) plus recursion depth O(log n)', when: 'Large clustered instances where approximate quality is acceptable.' }
};
const CODE = {"brute": "from itertools import permutations\n\ncost = [\n    [0, 10, 14, 19, 21, 16, 12],\n    [10, 0, 7, 12, 15, 18, 20],\n    [14, 7, 0, 8, 13, 11, 17],\n    [19, 12, 8, 0, 9, 10, 15],\n    [21, 15, 13, 9, 0, 6, 12],\n    [16, 18, 11, 10, 6, 0, 8],\n    [12, 20, 17, 15, 12, 8, 0],\n]\nn = len(cost)\n\n\ndef route_cost(route):\n    total = 0\n    for i in range(len(route) - 1):\n        total += cost[route[i]][route[i + 1]]\n    return total\n\ndef route_cost(route):\n    total = 0\n    for i in range(len(route) - 1):\n        total += cost[route[i]][route[i + 1]]\n    return total\n\n\ndef brute_force():\n    cities = range(1, n)\n    min_cost = float('inf')\n    best_route = []\n    for p in permutations(cities):\n        route = (0,) + p + (0,)\n        total = route_cost(route)\n        if total < min_cost:\n            min_cost = total\n            best_route = route\n    return best_route, min_cost\n\nprint(brute_force())", "greedy": "from itertools import permutations\n\ncost = [\n    [0, 10, 14, 19, 21, 16, 12],\n    [10, 0, 7, 12, 15, 18, 20],\n    [14, 7, 0, 8, 13, 11, 17],\n    [19, 12, 8, 0, 9, 10, 15],\n    [21, 15, 13, 9, 0, 6, 12],\n    [16, 18, 11, 10, 6, 0, 8],\n    [12, 20, 17, 15, 12, 8, 0],\n]\nn = len(cost)\n\n\ndef route_cost(route):\n    total = 0\n    for i in range(len(route) - 1):\n        total += cost[route[i]][route[i + 1]]\n    return total\n\ndef route_cost(route):\n    total = 0\n    for i in range(len(route) - 1):\n        total += cost[route[i]][route[i + 1]]\n    return total\n\n\ndef kruskal_route():\n    # list all edges and sort them by cost\n    edges = []\n    for i in range(n):\n        for j in range(i + 1, n):\n            edges.append((cost[i][j], i, j))\n    edges.sort()\n\n    parent = list(range(n))\n\n    def find(x):\n        while parent[x] != x:\n            x = parent[x]\n        return x\n\n    tree = [[] for _ in range(n)]\n    for w, i, j in edges:\n        a, b = find(i), find(j)\n        if a != b:                      # no cycle -> take the edge\n            parent[a] = b\n            tree[i].append((w, j))\n            tree[j].append((w, i))\n\n    # preorder walk of the tree from the depot\n    route = []\n    visited = [False] * n\n\n    def walk(u):\n        visited[u] = True\n        route.append(u)\n        for w, v in sorted(tree[u]):\n            if not visited[v]:\n                walk(v)\n\n    walk(0)\n    route.append(0)\n    return route, route_cost(route)\n\nprint(kruskal_route())", "dp": "from itertools import permutations\n\ncost = [\n    [0, 10, 14, 19, 21, 16, 12],\n    [10, 0, 7, 12, 15, 18, 20],\n    [14, 7, 0, 8, 13, 11, 17],\n    [19, 12, 8, 0, 9, 10, 15],\n    [21, 15, 13, 9, 0, 6, 12],\n    [16, 18, 11, 10, 6, 0, 8],\n    [12, 20, 17, 15, 12, 8, 0],\n]\nn = len(cost)\n\n\ndef route_cost(route):\n    total = 0\n    for i in range(len(route) - 1):\n        total += cost[route[i]][route[i + 1]]\n    return total\n\ndef held_karp():\n    m = n - 1                                   # pickups are 1..m\n    INF = float('inf')\n    dp = [[INF] * m for _ in range(1 << m)]     # dp[mask][last]\n    parent = [[-1] * m for _ in range(1 << m)]\n\n    for j in range(m):\n        dp[1 << j][j] = cost[0][j + 1]\n\n    for mask in range(1, 1 << m):\n        for last in range(m):\n            if not mask & (1 << last):\n                continue\n            prev = mask ^ (1 << last)\n            if prev == 0:\n                continue\n            for k in range(m):\n                if prev & (1 << k):\n                    value = dp[prev][k] + cost[k + 1][last + 1]\n                    if value < dp[mask][last]:\n                        dp[mask][last] = value\n                        parent[mask][last] = k\n\n    full = (1 << m) - 1\n    best, last = INF, -1\n    for j in range(m):\n        value = dp[full][j] + cost[j + 1][0]\n        if value < best:\n            best, last = value, j\n\n    order = []\n    mask = full\n    while last != -1:\n        order.append(last + 1)\n        prev_last = parent[mask][last]\n        mask ^= 1 << last\n        last = prev_last\n    return [0] + order[::-1] + [0], best\n\nprint(held_karp())", "dc": "from itertools import permutations\n\ncost = [\n    [0, 10, 14, 19, 21, 16, 12],\n    [10, 0, 7, 12, 15, 18, 20],\n    [14, 7, 0, 8, 13, 11, 17],\n    [19, 12, 8, 0, 9, 10, 15],\n    [21, 15, 13, 9, 0, 6, 12],\n    [16, 18, 11, 10, 6, 0, 8],\n    [12, 20, 17, 15, 12, 8, 0],\n]\nn = len(cost)\n\n\ndef route_cost(route):\n    total = 0\n    for i in range(len(route) - 1):\n        total += cost[route[i]][route[i + 1]]\n    return total\n\ndef route_cost(route):\n    total = 0\n    for i in range(len(route) - 1):\n        total += cost[route[i]][route[i + 1]]\n    return total\n\n\ndef divide_and_conquer():\n    def solve(group):\n        if len(group) <= 3:                     # base case: try every order\n            best = min(permutations(group), key=lambda p: route_cost([0, *p, 0]))\n            return list(best)\n        # split into two halves around the farthest pair\n        a, b = max(((i, j) for i in group for j in group if i < j),\n                   key=lambda pair: cost[pair[0]][pair[1]])\n        ordered = sorted(group, key=lambda x: cost[x][a] - cost[x][b])\n        half = (len(ordered) + 1) // 2\n        left, right = solve(ordered[:half]), solve(ordered[half:])\n        # merge: try both orders and both orientations, keep the cheapest\n        best, best_cost = None, float('inf')\n        for x, y in ((left, right), (right, left)):\n            for xr in (x, x[::-1]):\n                for yr in (y, y[::-1]):\n                    path = xr + yr\n                    c = route_cost([0, *path, 0])\n                    if c < best_cost:\n                        best, best_cost = path, c\n        return best\n\n    order = solve(list(range(1, n)))\n    route = [0] + order + [0]\n    return route, route_cost(route)\n\nprint(divide_and_conquer())"};
function copyCode(a, btn) { try { navigator.clipboard.writeText(CODE[a]); btn.textContent = 'Copied ✔'; setTimeout(() => btn.textContent = 'Copy code', 1500); } catch (e) { btn.textContent = 'Select & copy manually'; } }
function renderEdu() {
  $('#edu').innerHTML = ALGS.map(a => { const e = EDU[a]; return `<details><summary>${esc(NAME[a])}</summary><h4>WHAT IS IT?</h4><p>${e.what}</p><h4>HOW DOES IT WORK?</h4><p>${e.how}</p><h4>HOW IS IT USED HERE?</h4><p>${e.used}</p><h4>STEP-BY-STEP</h4><ol start="1">${e.steps.map(s => `<li>${s}</li>`).join('')}</ol><h4>ADVANTAGES</h4><p>${e.adv}</p><h4>DISADVANTAGES</h4><p>${e.dis}</p><h4>TIME COMPLEXITY</h4><p>${e.time}</p><h4>SPACE COMPLEXITY</h4><p>${e.space}</p><h4>WHEN SHOULD WE USE IT?</h4><p>${e.when}</p><h4>PYTHON CODE</h4><button class="btn sm" onclick="copyCode('${a}', this)">Copy code</button><pre><code>${esc(CODE[a])}</code></pre></details>`; }).join('');

}

/* ---------- reset, presentation, wiring ---------- */
function resetSimulation() {
  stopAlg(true); S = defaultState(); results = {}; tab = 'greedy'; treeSel = null; $('#progress').hidden = true; $('#runAll').disabled = false;
  renderTabs(); dataChanged(true); $('#log').innerHTML = '';
}
function renderTabs() { $('#algTabs').innerHTML = ALGS.map(a => `<button class="tab" role="tab" data-alg="${a}" aria-selected="${a === tab}">${esc(NAME[a])}</button>`).join(''); }

document.addEventListener('input', e => {                      // live data edits (no re-render, keeps focus)
  const t = e.target;
  if (t.id === 'depotName') S.depot = t.value; else if (t.id === 'capInput') S.cap = t.value; else if (t.id === 'speedInput') S.speed = t.value;
  else if (t.dataset.f) S.locs[+t.dataset.i][t.dataset.f] = t.value;
  else if (t.dataset.j !== undefined && t.closest('#matrix')) { const i = +t.dataset.i, j = +t.dataset.j; S.D[i][j] = t.value; S.D[j][i] = t.value; const m = document.querySelector(`#matrix input[data-i="${j}"][data-j="${i}"]`); if (m) m.value = t.value; }
  else return;
  stopAlg(true); results = {}; G = buildGraph(S); resetView(); renderMeta(); renderHeader(); compareAlgorithms(); renderLive(); renderComplexity(); renderBF();
});
document.addEventListener('change', e => { if (e.target.id === 'depotName' || e.target.dataset.f === 'name') renderBuilder(); });
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.act) { const i = +t.dataset.i, a = t.dataset.act; if (a === 'del') { S.locs.splice(i, 1); S.D.splice(i + 1, 1); S.D.forEach(r => r.splice(i + 1, 1)); } else if (a === 'up' && i > 0) swapLoc(i, i - 1); else if (a === 'down' && i < S.locs.length - 1) swapLoc(i, i + 1); structural(); }
  else if (t.dataset.alg) { tab = t.dataset.alg; renderTabs(); if (!R.running) { resetView(); V.alg = null; renderLive(); } }
  else if (t.dataset.node !== undefined) { treeSel = +t.dataset.node; renderState(); }
});
$('#addBtn').onclick = addLocation; $('#fillBtn').onclick = fillMissing;
$('#newName').addEventListener('keydown', e => { if (e.key === 'Enter') addLocation(); });
$('#btnStart').onclick = () => { if (R.running && R.paused) { R.paused = false; V.status = 'RUNNING'; renderLive(); schedule(); } else startAlg(tab); };
$('#btnPause').onclick = () => { if (!R.running) return; R.paused = !R.paused; V.status = R.paused ? 'PAUSED' : 'RUNNING'; renderLive(); if (!R.paused) schedule(); else clearTimeout(R.timer); };
$('#btnNext').onclick = () => { if (!R.running && !startAlg(tab, false)) return; if (R.running) { R.paused = true; clearTimeout(R.timer); V.status = 'PAUSED'; stepOnce(); if (R.running) { V.status = 'PAUSED'; } renderLive(); } };
$('#btnRestart').onclick = () => startAlg(R.alg || tab);
$('#btnStop').onclick = () => stopAlg(false);
$('#runAll').onclick = runAll; $('#resetBtn').onclick = resetSimulation;
$('#presBtn').onclick = () => { const on = document.body.classList.toggle('pres'); $('#presBtn').textContent = on ? '✕ EXIT PRESENTATION' : '🎤 PRESENTATION MODE'; setTimeout(() => { renderComplexity(); }, 50); };
$('#cxN').oninput = renderComplexity;
$('#exportCsv').onclick = exportComparison; $('#exportJson').onclick = exportRouteReport;
$('#zIn').onclick = () => lab.zoom(1.2); $('#zOut').onclick = () => lab.zoom(1 / 1.2); $('#zRes').onclick = () => Object.assign(lab.cam, { yaw: .6, pitch: .6, zoom: 1, px: 0, py: 0 });
const go = (id, f) => $(id).onclick = () => { document.getElementById(f).scrollIntoView(); };
go('#heroExplore', 'learn'); go('#heroOpen', 'lab'); $('#heroStart').onclick = () => { document.getElementById('lab').scrollIntoView(); startAlg(tab); };

/* ---------- brute-force permutation catalogue (independent, paginated) ---------- */
const BF = { page:0, size:20, search:'', sort:'sequence', selected:null, rows:[] };
function bfFactorial(n){let v=1;for(let i=2;i<=n;i++)v*=i;return v;}
// Factoradic unranking: compute one permutation without generating earlier permutations.
function bfPermutationAt(index, items){const pool=items.slice(),out=[];let k=index;for(let left=pool.length;left>0;left--){const f=bfFactorial(left-1),q=Math.floor(k/f);k%=f;out.push(pool.splice(q,1)[0]);}return out;}
function bfRouteAt(index){const order=bfPermutationAt(index,G.names.slice(1));const route=[G.names[0],...order,G.names[0]];let distance=0,legs=[];for(let i=0;i<route.length-1;i++){const d=G.M[G.names.indexOf(route[i])][G.names.indexOf(route[i+1])];distance+=d;legs.push({from:route[i],to:route[i+1],distance:d});}return {index,number:index+1,route,distance,legs};}
function bfPageRows(){const total=bfFactorial(G.names.length-1),start=BF.page*BF.size,end=Math.min(total,start+BF.size);let rows=[];for(let i=start;i<end;i++)rows.push(bfRouteAt(i));const q=BF.search.trim().toLowerCase();if(q)rows=rows.filter(r=>String(r.number).includes(q)||r.route.join(' → ').toLowerCase().includes(q));if(BF.sort==='distance-asc')rows.sort((a,b)=>a.distance-b.distance||a.number-b.number);if(BF.sort==='distance-desc')rows.sort((a,b)=>b.distance-a.distance||a.number-b.number);return rows;}
function bfDraw(r, canvasId='bfCanvas'){const c=document.getElementById(canvasId);if(!c||!r)return;const ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);const n=r.route.length-1,stops=r.route.slice(0,-1),cx=w/2,cy=h/2,rad=Math.min(w*.36,h*.34);const pts=stops.map((name,i)=>({name,x:cx+Math.cos(-Math.PI/2+i*2*Math.PI/n)*rad,y:cy+Math.sin(-Math.PI/2+i*2*Math.PI/n)*rad}));ctx.strokeStyle='rgba(148,163,184,.22)';ctx.lineWidth=1;for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.stroke();}ctx.strokeStyle='#5eead4';ctx.lineWidth=4;ctx.shadowColor='#5eead4';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(cx,cy);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(cx,cy);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#818cf8';ctx.beginPath();ctx.arc(cx,cy,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('DEPOT',cx,cy+30);pts.forEach((p,i)=>{ctx.fillStyle='#0b1222';ctx.strokeStyle='#5eead4';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#e6ebf5';ctx.font='bold 11px system-ui';ctx.fillText(String(i+1),p.x,p.y+4);ctx.font='10px system-ui';ctx.fillStyle='#aab7ce';ctx.fillText(p.name.length>15?p.name.slice(0,13)+'…':p.name,p.x,p.y+27);});}
function bfSelect(r){BF.selected=r;document.getElementById('bfSelectedDistance').textContent=r.distance.toFixed(2)+' km';document.getElementById('bfSelectedRank').textContent='Candidate #'+r.number+' of '+bfFactorial(G.names.length-1).toLocaleString();document.getElementById('bfRouteDetail').innerHTML='<b>Route #'+r.number+'</b><br>'+r.route.map((x,i)=>`${i+1}. ${esc(x)}`).join(' &nbsp;→&nbsp; ')+'<br><br>'+r.legs.map(l=>`${esc(l.from)} → ${esc(l.to)}: <b>${l.distance.toFixed(2)} km</b>`).join('<br>')+'<br><br><b>Total: '+r.distance.toFixed(2)+' km</b>';bfDraw(r);document.querySelectorAll('#bfRows tr').forEach(tr=>tr.classList.toggle('active',Number(tr.dataset.index)===r.index));}
function renderMethodGraphs(){
  const ids={brute:'Brute',greedy:'Greedy',dp:'Dp',dc:'Dc'};
  for(const a of ALGS){const suffix=ids[a],r=results[a],canvasId='methodCanvas'+suffix,info=document.getElementById('methodInfo'+suffix);if(!info)continue;
    if(r&&!r.skipped&&r.route){bfDraw(r,canvasId);info.innerHTML=`<b>${r.distance.toFixed(2)} km</b> · ${r.optimal?'Exact result':'Heuristic result'} · ${r.ms.toFixed(2)} ms<br>${r.route.map((name,i)=>`${i+1}. ${esc(name)}`).join(' → ')}`;}
    else{const c=document.getElementById(canvasId);if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#9aa9c2';ctx.font='24px system-ui';ctx.textAlign='center';ctx.fillText('Run this algorithm to reveal its route graph',c.width/2,c.height/2);}info.textContent=r?.skipped?`Not available: ${r.skipped}`:'Run this algorithm in the 3D Algorithm Laboratory to display its route graph.';}
  }
}
/* ---------- detailed method-specific explorers (greedy decisions, DP states, D&C recursion) ---------- */
const TRACE={greedy:{page:0,size:12,search:'',rows:[],selected:0},dp:{page:0,size:12,search:'',rows:[],selected:0},dc:{page:0,size:12,search:'',rows:[],selected:0}};
const TRACE_CFG={greedy:{prefix:'greedyTrace',canvas:'greedyTraceCanvas',title:'greedyTraceTitle',info:'greedyTraceInfo',count:'greedyTraceCount',label:'greedyTracePageLabel',rows:'greedyTraceRows'},dp:{prefix:'dpTrace',canvas:'dpTraceCanvas',title:'dpTraceTitle',info:'dpTraceInfo',count:'dpTraceCount',label:'dpTracePageLabel',rows:'dpTraceRows'},dc:{prefix:'dcTrace',canvas:'dcTraceCanvas',title:'dcTraceTitle',info:'dcTraceInfo',count:'dcTraceCount',label:'dcTracePageLabel',rows:'dcTraceRows'}};
function collectTrace(alg){const g=ALGFN[alg](G),events=[];let r;while(!(r=g.next()).done)events.push(r.value);return {events,result:r.value};}
function traceRowsFor(kind){const x=TRACE[kind],q=x.search.trim().toLowerCase();return x.rows.filter(e=>!q||e.search.toLowerCase().includes(q));}
function tracePage(kind){const x=TRACE[kind],all=traceRowsFor(kind),pages=Math.max(1,Math.ceil(all.length/x.size));x.page=Math.max(0,Math.min(x.page,pages-1));return {all,page:all.slice(x.page*x.size,(x.page+1)*x.size),pages};}
function traceRoute(kind,e){const depot=G.names[0];if(kind==='greedy'){if(e.type==='edge')return [depot,e.from,e.to,depot];if(e.type==='move'||e.type==='return')return e.route;if(e.type==='select')return [depot,e.candidate,depot];if(e.type==='scan')return [depot,...e.candidates.map(c=>c.name),depot];return [depot,depot];}
 if(kind==='dp'){if(e.type==='reconstruct')return e.route;if(e.type==='dp-state'){const a=e.subset.filter(n=>n!==e.last);return [depot,...a,e.last,depot];}return [depot,depot];}
 if(e.type==='base'||e.type==='merge')return [depot,...e.path,depot];if(e.type==='divide')return [depot,...e.groupA,...e.groupB,depot];return [depot,...(e.locations||[]),depot];}
function traceDescription(kind,e,i){if(kind==='greedy'){const candidates=e.candidates||[];if(e.type==='start')return `Start at depot ${e.current}. Sort all ${e.edges} edges by distance, then run Kruskal's algorithm.`;if(e.type==='edge')return `Edge ${e.from} — ${e.to} (${e.distance} km): ${e.accepted?'ACCEPTED, it joins two separate components':'REJECTED, it would create a cycle'}. MST now has ${e.mstEdges} edge(s), cost ${e.mstCost} km.`;if(e.type==='scan')return `From ${e.current}, compare ${candidates.length} unvisited location(s): ${candidates.map(c=>`${c.name} (${c.distance} km)`).join(', ')}. The next step selects the smallest distance.`;if(e.type==='select')return `Next stop in MST preorder is ${e.candidate}, ${e.distance} km from ${e.current} (direct leg).`;if(e.type==='move')return `Travel to ${e.to}. Added ${e.added} km; cumulative distance is ${e.total} km. The stop is now marked visited.`;if(e.type==='return')return `All pickup locations are visited. Return to the depot adds ${e.added} km; total route distance is ${e.total} km.`;}
 if(kind==='dp'){if(e.type==='dp-state')return `State: visit subset {${e.subset.join(', ')}} and finish at ${e.last}. Minimum stored cost = ${Number.isFinite(e.distance)?e.distance.toFixed(2):'∞'} km. ${e.base?'Base case: direct depot-to-stop cost.':e.from?`Chosen predecessor state ends at ${e.from.last}; previous cost ${e.from.distance.toFixed(2)} km + edge ${e.from.edge.toFixed(2)} km.`:'No predecessor recorded.'}`;if(e.type==='reconstruct')return `The full-set states are compared with the return-to-depot cost. Parent pointers reconstruct the selected closed route: ${e.route.join(' → ')} (${e.distance.toFixed(2)} km).`;}
 if(kind==='dc'){if(e.type==='open')return `Open recursion node ${e.id} at depth ${e.depth}. Current subproblem contains ${e.locations.length} pickup(s): ${e.locations.join(', ')}.`;if(e.type==='divide')return `Split this subproblem into Group A (${e.groupA.length}): ${e.groupA.join(', ')}; and Group B (${e.groupB.length}): ${e.groupB.join(', ')}. Each group is solved recursively.`;if(e.type==='base')return `Base case: solve ${e.path.length} pickup(s) by checking ${e.tried} order(s). Chosen path: ${e.path.join(' → ')}.`;if(e.type==='merge')return `Merge the two solved groups by checking ${e.tried} order/reversal combinations. Chosen merged path: ${e.path.join(' → ')}.`;}
 return 'Algorithm event.';}
function traceRow(kind,e,i){if(kind==='greedy'){const who=e.type==='edge'?e.from+' — '+e.to+(e.accepted?' ✔':' ✘'):(e.candidate||e.to||e.current||'—'),d=e.distance??e.added;return {step:i+1,action:e.type.toUpperCase(),who,d:d==null?'—':`${Number(d).toFixed(2)} km`,search:`${i+1} ${e.type} ${who} ${(e.candidates||[]).map(c=>c.name).join(' ')}`};}if(kind==='dp'){return {step:i+1,action:e.type==='dp-state'?'DP STATE':'RECONSTRUCT',who:e.type==='dp-state'?e.last:'Final route',d:e.distance==null?'—':`${Number(e.distance).toFixed(2)} km`,search:`${i+1} ${e.type} ${(e.subset||[]).join(' ')} ${e.last||''} ${e.route||''}`};}const who=e.locations?.join(', ')||e.groupA?.join(', ')||e.path?.join(' → ')||'—';return {step:i+1,action:e.type.toUpperCase(),who,d:e.tried==null?'—':`${e.tried} checks`,search:`${i+1} ${e.type} ${who} ${(e.groupB||[]).join(' ')}`};}
function renderTrace(kind){const cfg=TRACE_CFG[kind],x=TRACE[kind],{all,page,pages}=tracePage(kind),body=document.getElementById(cfg.rows);document.getElementById(cfg.count).textContent=all.length.toLocaleString();document.getElementById(cfg.label).textContent=all.length?`Page ${x.page+1}/${pages} · ${all.length.toLocaleString()} events`:'No matching events';body.innerHTML=page.length?page.map(e=>`<tr class="${e.index===x.selected?'active':''}"><td>${e.row.step}</td><td><b>${esc(e.row.action)}</b></td><td class="bf-route">${esc(e.row.who)}</td><td>${esc(e.row.d)}</td><td><button class="btn sm" data-trace-view="${e.index}">Inspect</button></td></tr>`).join(''):'<tr><td colspan="5">No events match this search.</td></tr>';document.getElementById(cfg.prefix+'Prev').disabled=x.page===0;document.getElementById(cfg.prefix+'Next').disabled=x.page>=pages-1;const chosen=x.rows.find(e=>e.index===x.selected)||page[0];if(chosen)selectTrace(kind,chosen.index,false);}
function selectTrace(kind,index,rerender=true){const cfg=TRACE_CFG[kind],x=TRACE[kind],e=x.rows.find(z=>z.index===index);if(!e)return;x.selected=index;const route=traceRoute(kind,e.event),distance=calculateRouteDistance(route,G);document.getElementById(cfg.title).textContent=`Step ${e.row.step} · ${e.row.action}`;bfDraw({route,distance},cfg.canvas);document.getElementById(cfg.info).innerHTML=`<b>${esc(traceDescription(kind,e.event,e.index))}</b><br><br><b>Displayed sequence:</b> ${route.map((n,i)=>`${i+1}. ${esc(n)}`).join(' → ')}<br><b>Graph path cost:</b> ${distance.toFixed(2)} km${kind==='dp'&&e.event.type==='dp-state'?'<br><span class="note">The graph orders the state subset for visualization; the DP value is the minimum cost for the subset and ending stop, not necessarily this displayed ordering.</span>':''}`;if(rerender)renderTrace(kind);}
function buildMethodExplorer(kind){const alg={greedy:'greedy',dp:'dp',dc:'dc'}[kind],x=TRACE[kind];if(!G)G=buildGraph(S);const {events}=collectTrace(alg);x.rows=events.map((event,index)=>({event,index,row:traceRow(kind,event,index)}));x.page=0;x.selected=x.rows.length?x.rows[0].index:0;renderTrace(kind);}
function clearMethodExplorers(){for(const kind of ['greedy','dp','dc']){const x=TRACE[kind],cfg=TRACE_CFG[kind];x.rows=[];x.page=0;x.selected=0;document.getElementById(cfg.count).textContent='—';document.getElementById(cfg.label).textContent='Run this algorithm to build its explorer.';document.getElementById(cfg.rows).innerHTML='<tr><td colspan="5">Run this algorithm to populate its complete explorer.</td></tr>';document.getElementById(cfg.title).textContent='Selected step';document.getElementById(cfg.info).textContent='Run this algorithm, then select an item.';const c=document.getElementById(cfg.canvas);if(c)c.getContext('2d').clearRect(0,0,c.width,c.height);}}
function initMethodExplorers(){for(const kind of ['greedy','dp','dc']){const x=TRACE[kind],p=TRACE_CFG[kind].prefix;document.getElementById(p+'Prev').onclick=()=>{x.page--;renderTrace(kind);};document.getElementById(p+'Next').onclick=()=>{x.page++;renderTrace(kind);};document.getElementById(p+'Search').oninput=e=>{x.search=e.target.value;x.page=0;renderTrace(kind);};document.getElementById(TRACE_CFG[kind].rows).onclick=e=>{const b=e.target.closest('[data-trace-view]');if(b)selectTrace(kind,Number(b.dataset.traceView));};}}

function renderBF(){const total=bfFactorial(G.names.length-1),pages=Math.max(1,Math.ceil(total/BF.size));BF.page=Math.max(0,Math.min(BF.page,pages-1));BF.rows=bfPageRows();document.getElementById('bfTotal').textContent=total.toLocaleString();document.getElementById('bfFormula').textContent=`${G.names.length-1}! = ${total.toLocaleString()} unique pickup orders`;document.getElementById('bfPageCount').textContent=BF.rows.length.toLocaleString();document.getElementById('bfPageLabel').textContent=`Page ${BF.page+1} of ${pages.toLocaleString()} · routes ${(BF.page*BF.size+1).toLocaleString()}–${Math.min(total,(BF.page+1)*BF.size).toLocaleString()}`;document.getElementById('bfPrev').disabled=BF.page===0;document.getElementById('bfNext').disabled=BF.page>=pages-1;document.getElementById('bfRows').innerHTML=BF.rows.length?BF.rows.map(r=>`<tr data-index="${r.index}" class="${BF.selected?.index===r.index?'active':''}"><td>#${r.number.toLocaleString()}</td><td class="bf-route">${r.route.map(esc).join(' → ')}</td><td class="bf-distance">${r.distance.toFixed(2)} km</td><td><button class="btn sm" data-bf-view="${r.index}">View graph</button></td></tr>`).join(''):'<tr><td colspan="4">No routes match this search on the current page.</td></tr>';const best=getBestRoute();document.getElementById('bfBestDistance').textContent=best?best.distance.toFixed(2)+' km':'—';document.getElementById('bfBestSource').textContent=best?`${NAME[best.alg]||best.alg} · ${best.optimal?'optimal':'best known'}`:'Run an algorithm to populate best known result';document.getElementById('bfNotice').innerHTML=`<p class="o">Showing ${BF.rows.length} route(s) from a search space of ${total.toLocaleString()}. Change the page to inspect more candidates.</p>`;const ds=BF.rows.map(r=>r.distance),mn=ds.length?Math.min(...ds):0,mx=ds.length?Math.max(...ds):0,av=ds.length?ds.reduce((a,b)=>a+b,0)/ds.length:0;document.getElementById('bfPageStats').innerHTML=`<div><small>SHORTEST ON THIS PAGE</small><b>${ds.length?mn.toFixed(2)+' km':'—'}</b></div><div><small>PAGE AVERAGE</small><b>${ds.length?av.toFixed(2)+' km':'—'}</b></div><div><small>LONGEST ON THIS PAGE</small><b>${ds.length?mx.toFixed(2)+' km':'—'}</b></div>`;if(BF.selected && BF.selected.index<total)bfSelect(bfRouteAt(BF.selected.index));else bfSelect(BF.rows[0]||bfRouteAt(0));renderMethodGraphs();}
document.getElementById('bfPrev').onclick=()=>{BF.page--;renderBF();};document.getElementById('bfNext').onclick=()=>{BF.page++;renderBF();};document.getElementById('bfSearch').oninput=e=>{BF.search=e.target.value;renderBF();};document.getElementById('bfSort').onchange=e=>{BF.sort=e.target.value;renderBF();};document.getElementById('bfPageSize').onchange=e=>{BF.size=Number(e.target.value);BF.page=0;renderBF();};document.getElementById('bfRows').onclick=e=>{const b=e.target.closest('[data-bf-view]');if(b)bfSelect(bfRouteAt(Number(b.dataset.bfView)));};document.getElementById('bfGo').onclick=()=>{const n=Number(document.getElementById('bfJumpNumber').value),total=bfFactorial(G.names.length-1);if(!Number.isInteger(n)||n<1||n>total){document.getElementById('bfNotice').innerHTML='<p class="e">Enter a route number from 1 to '+total.toLocaleString()+'.</p>';return;}BF.page=Math.floor((n-1)/BF.size);renderBF();bfSelect(bfRouteAt(n-1));};document.getElementById('bfExport').onclick=()=>{const rows=[['Route number','Route','Distance km'],...BF.rows.map(r=>[r.number,r.route.join(' -> '),r.distance.toFixed(2)])];downloadFile('brute-force-route-page.csv',rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv');};

/* ---------- boot ---------- */
G = buildGraph(S); resetView();
const lab = new Scene($('#labCanvas'), () => V, { onNode: inspectNode });
(function hero() {                                              // hero: real Kruskal route on the default data, looped
  const HG = buildGraph(defaultState()), r = timeRun('greedy', HG), H = newView(HG);
  H.routeIdx = r.route.map(n => HG.names.indexOf(n)); H.bestIdx = H.routeIdx; H.routeStyle = 'best'; H.loop = true; H.status = 'DEMO'; H.visited = new Set(H.routeIdx); H.busSpeed = .03;
  new Scene($('#heroCanvas'), () => H, { auto: true, static: true });
})();
renderTabs(); renderBuilder(); renderHeader(); compareAlgorithms(); renderLive(); renderEdu(); renderComplexity(); renderInsights(); renderBF(); initMethodExplorers();
setInterval(() => { if (V) updateTelemetry(); }, 120);
addEventListener('resize', () => { renderComplexity(); renderInsights(); });

/* ---------- LOCAL SCENARIO VAULT ---------- */
const SCENARIO_KEY='buslab_scenarios_v2';
function readScenarios(){try{return JSON.parse(localStorage.getItem(SCENARIO_KEY)||'[]');}catch{return [];}}
function writeScenarios(x){try{localStorage.setItem(SCENARIO_KEY,JSON.stringify(x));return true;}catch{return false;}}
function currentScenario(){return {version:1,name:$('#scenarioName').value.trim()||'Untitled scenario',savedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(S))};}
function renderScenarios(){const list=readScenarios();$('#scenarioList').innerHTML=list.length?list.map((x,i)=>`<div class="scenario-item"><div><b>${esc(x.name||'Untitled')}</b><small>${new Date(x.savedAt||Date.now()).toLocaleString()} · ${(x.state?.locs||[]).length} pickup locations</small></div><div class="scenario-actions"><button class="btn sm" data-s-load="${i}">Load</button><button class="btn sm" data-s-export="${i}">Export</button><button class="btn sm warn" data-s-delete="${i}">Delete</button></div></div>`).join(''):'<p class="note">No saved scenarios yet. Save the current dataset to create your first scenario.</p>';}
$('#saveScenario').onclick=()=>{const x=readScenarios(),v=currentScenario();if(!v.name.trim())return; x.unshift(v);if(!writeScenarios(x)){ $('#scenarioMsg').textContent='Could not save: browser storage may be full or disabled.';return;}$('#scenarioMsg').textContent=`Saved “${v.name}” in this browser.`;renderScenarios();};
$('#scenarioList').onclick=e=>{const b=e.target.closest('button');if(!b)return;const i=Number(b.dataset.sLoad??b.dataset.sExport??b.dataset.sDelete),list=readScenarios(),item=list[i];if(!item)return;if(b.dataset.sLoad!==undefined){if(!item.state||!Array.isArray(item.state.locs)||!Array.isArray(item.state.D)){ $('#scenarioMsg').textContent='This scenario file is incomplete.';return;}S=JSON.parse(JSON.stringify(item.state));structural();$('#scenarioMsg').textContent=`Loaded “${item.name}”.`;}else if(b.dataset.sDelete!==undefined){list.splice(i,1);writeScenarios(list);renderScenarios();$('#scenarioMsg').textContent='Scenario deleted.';}else downloadFile((item.name||'scenario').replace(/[^a-z0-9-_]+/gi,'-')+'.json',JSON.stringify(item,null,2),'application/json');};
function exportCurrentScenario(){const v=currentScenario();downloadFile((v.name||'bus-route-scenario').replace(/[^a-z0-9-_]+/gi,'-')+'.json',JSON.stringify(v,null,2),'application/json');}
$('#exportScenario').onclick=exportCurrentScenario;
$('#importScenario').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text()),state=data.state||data;if(!Array.isArray(state.locs)||!Array.isArray(state.D)||!state.depot||!(Number(state.cap)>0)){throw Error('Missing required depot, pickup, distance matrix or capacity data.');}const names=[state.depot,...state.locs.map(x=>x.name)];if(state.D.length!==names.length||state.D.some(r=>!Array.isArray(r)||r.length!==names.length))throw Error('Distance matrix dimensions do not match the location count.');S=state;structural();const saved=readScenarios();saved.unshift({version:1,name:data.name||f.name.replace(/\.json$/i,''),savedAt:new Date().toISOString(),state});writeScenarios(saved);renderScenarios();$('#scenarioMsg').textContent='Scenario imported and loaded successfully.';}catch(err){$('#scenarioMsg').textContent='Import failed: '+err.message;}e.target.value='';};

/* Keep the new panels synchronized with route results and initial data. */
renderScenarios();

/* ---------- DRIVER OPERATIONS SHEET ---------- */
function operationsRows(){const b=getBestRoute();if(!b||!b.route)return null;let cumulative=0,load=0;const rows=[];for(let i=0;i<b.route.length;i++){const name=b.route[i],idx=G.names.indexOf(name),isDepot=i===0||i===b.route.length-1,passengers=isDepot?0:(G.students[idx]||0);if(!isDepot)load+=passengers;let leg=0;if(i>0){const prev=G.names.indexOf(b.route[i-1]);leg=G.M[prev][idx];cumulative+=leg;}rows.push({sequence:i+1,stop:name,type:i===0?'START DEPOT':i===b.route.length-1?'RETURN DEPOT':'PICKUP',passengers,load,leg,cumulative});}return {b,rows};}
function renderOperations(){const data=operationsRows();if(!data){$('#opsSummary').textContent='Run an algorithm to generate an operations sheet.';$('#opsTable').innerHTML='';return;}$('#opsSummary').textContent=`${NAME[data.b.alg]||data.b.alg} · ${data.b.distance.toFixed(1)} km total · ${totalStudents(S)} passengers · bus capacity ${S.cap}`;$('#opsTable').innerHTML='<thead><tr><th>Step</th><th>Stop</th><th>Type</th><th>Pickup</th><th>Load so far</th><th>Leg km</th><th>Total km</th></tr></thead><tbody>'+data.rows.map(r=>`<tr><td>${r.sequence}</td><td><b>${esc(r.stop)}</b></td><td>${r.type}</td><td>${r.passengers}</td><td>${r.load}</td><td>${r.leg.toFixed(1)}</td><td>${r.cumulative.toFixed(1)}</td></tr>`).join('')+'</tbody>';}
$('#opsCsv').onclick=()=>{const d=operationsRows();if(!d)return;const rows=[['Step','Stop','Type','Pickup','Load so far','Leg km','Total km'],...d.rows.map(r=>[r.sequence,r.stop,r.type,r.passengers,r.load,r.leg.toFixed(2),r.cumulative.toFixed(2)])];downloadFile('bus-driver-operations-sheet.csv',rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv');};
$('#opsPrint').onclick=()=>window.print();
renderOperations();
const _compareWithOps=compareAlgorithms;
compareAlgorithms=function(){_compareWithOps();renderOperations();};

/* ---------- VIEW CODE (Python source for every algorithm) ---------- */
(function codeViewer() {
  const modal = $('#codeModal'); let cur = 'brute';
  const KW = /\b(from|import|def|return|for|in|if|else|while|not|and|or|break|continue|nonlocal|lambda|range|True|False|None)\b/g;
  function highlight(src) {                      // tiny tokenizer: comments, strings, keywords, numbers
    return src.split('\n').map(line => {
      const i = line.indexOf('#'), code = i < 0 ? line : line.slice(0, i), com = i < 0 ? '' : line.slice(i);
      let h = esc(code).replace(/(&#39;[^&]*?&#39;|&quot;[^&]*?&quot;)/g, '\u0001$1\u0002')
        .replace(KW, '<span class="tok-k">$1</span>').replace(/\b(\d+)\b/g, '<span class="tok-n">$1</span>')
        .replace(/\u0001(.*?)\u0002/g, (m, x) => '<span class="tok-s">' + x.replace(/<span class="tok-[a-z]">|<\/span>/g, '') + '</span>');
      return h + (com ? '<span class="tok-c">' + esc(com) + '</span>' : '');
    }).join('\n');
  }
  const source = () => PY_CODE[cur].replace('__COST__', '[\n' + buildGraph(S).M.map(r => '    [' + r.join(', ') + ']').join(',\n') + '\n]');
  function render() {
    $('#codeTabs').innerHTML = ALGS.map(a => `<button class="tab" role="tab" data-c="${a}" aria-selected="${a === cur}">${esc(SHORT[a])}</button>`).join('');
    $('#codeView code').innerHTML = highlight(source());
  }
  const open = () => { modal.hidden = false; render(); }, close = () => { modal.hidden = true; };
  $('#codeBtn').onclick = open; $('#codeBtn2').onclick = open; $('#codeClose').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
  $('#codeTabs').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { cur = b.dataset.c; render(); } });
  $('#codeCopy').onclick = async () => { const t = $('#codeCopy'); try { await navigator.clipboard.writeText(source()); t.textContent = '✔ COPIED'; } catch (_) { const r = document.createRange(); r.selectNodeContents($('#codeView code')); getSelection().removeAllRanges(); getSelection().addRange(r); t.textContent = 'Press Ctrl+C'; } setTimeout(() => t.textContent = '⧉ COPY CODE', 1500); };
  $('#codeDl').onclick = () => downloadFile(({ brute: 'brute_force', greedy: 'kruskal_mst', dp: 'held_karp', dc: 'divide_and_conquer' })[cur] + '.py', source(), 'text/x-python');
})();
