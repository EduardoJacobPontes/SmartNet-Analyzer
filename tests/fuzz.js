/*
 * Validação cruzada: cada algoritmo do SmartNet é comparado com uma implementação
 * INDEPENDENTE e deliberadamente simples (Floyd–Warshall, Bellman-Ford, Prim,
 * força bruta) em milhares de grafos aleatórios: direcionados/não, com/sem pesos,
 * pesos zero, desconexos, vias interditadas, vértices isolados.
 *
 *   node tests/fuzz.js [quantidade]     (padrão: 3000 grafos)
 */
'use strict';
const path = require('path');
const load = (f) => require(path.join(__dirname, '..', 'js', f));
load('graph.js'); load('algorithms.js');
const S = globalThis.SmartNet;

let seed = 987654321;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const N = Number(process.argv[2]) || 3000;
let checks = 0;
const fail = (msg, g) => {
  console.error(`\nFALHOU: ${msg}\n--- grafo ---\n${g.toText()}\nbloqueadas: ${g.edges.filter((e) => e.blocked).map((e) => `${e.u}-${e.v}`).join(',') || '-'}`);
  process.exit(1);
};
const check = (cond, msg, g) => { checks++; if (!cond) fail(msg, g); };

function randomGraph() {
  const directed = rnd() < 0.4, weighted = rnd() < 0.8;
  const g = new S.Graph({ directed, weighted });
  const n = ri(1, 9);
  const names = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  names.forEach((v) => g.addVertex(v));
  const m = ri(0, Math.min(n * (n - 1), 16));
  const zeroBias = rnd() < 0.3;
  for (let i = 0; i < m && n > 1; i++) {
    const u = names[ri(0, n - 1)];
    let v = names[ri(0, n - 1)];
    if (u === v) continue;
    const w = zeroBias && rnd() < 0.4 ? 0 : ri(0, 12);
    g.addEdge(u, v, w);
  }
  if (rnd() < 0.35) for (const e of g.edges) if (rnd() < 0.25) e.blocked = true;
  return g;
}

/* ---------- referências independentes ---------- */
function activeEdges(g) { return g.edges.filter((e) => !e.blocked); }

/** Floyd–Warshall respeitando direção. */
function floyd(g, unit = false) {
  const vs = g.vertices(), idx = new Map(vs.map((v, i) => [v, i])), n = vs.length;
  const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  for (const e of activeEdges(g)) {
    const w = unit ? 1 : g.weight(e);
    const a = idx.get(e.u), b = idx.get(e.v);
    d[a][b] = Math.min(d[a][b], w);
    if (!g.directed) d[b][a] = Math.min(d[b][a], w);
  }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  return { vs, idx, d };
}

/** Componentes ignorando sentido, via rótulos por propagação (sem reutilizar o código do projeto). */
function compCount(g, skipV = null, skipE = null) {
  const vs = g.vertices().filter((v) => v !== skipV);
  const label = new Map(vs.map((v, i) => [v, i]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of activeEdges(g)) {
      if (e.id === skipE || e.u === skipV || e.v === skipV) continue;
      const a = label.get(e.u), b = label.get(e.v), m = Math.min(a, b);
      if (a !== m) { label.set(e.u, m); changed = true; }
      if (b !== m) { label.set(e.v, m); changed = true; }
    }
  }
  return new Set(label.values()).size;
}

/** Peso da floresta geradora mínima por Prim em cada componente (ignora sentido). */
function primForest(g) {
  const vs = g.vertices(), inT = new Set();
  let total = 0, edges = 0;
  for (const s of vs) {
    if (inT.has(s)) continue;
    inT.add(s);
    for (;;) {
      let best = null;
      for (const e of activeEdges(g)) {
        const a = inT.has(e.u), b = inT.has(e.v);
        if (a !== b && (best === null || g.weight(e) < g.weight(best))) best = e;
      }
      if (!best) break;
      inT.add(inT.has(best.u) ? best.v : best.u);
      total += g.weight(best); edges++;
    }
  }
  return { total, edges };
}

/** Força bruta: menor soma entre todos os subconjuntos de V-c arestas que não formam ciclo. */
function bruteMst(g) {
  const es = activeEdges(g), n = g.vertexCount, c = compCount(g), need = n - c;
  if (es.length > 14) return null;
  let best = Infinity;
  const vs = g.vertices();
  for (let mask = 0; mask < (1 << es.length); mask++) {
    let cnt = 0, sum = 0;
    for (let i = 0; i < es.length; i++) if (mask >> i & 1) { cnt++; sum += g.weight(es[i]); }
    if (cnt !== need || sum >= best) continue;
    const p = new Map(vs.map((v) => [v, v]));
    const find = (x) => { while (p.get(x) !== x) x = p.get(x); return x; };
    let ok = true;
    for (let i = 0; i < es.length && ok; i++) if (mask >> i & 1) {
      const a = find(es[i].u), b = find(es[i].v);
      if (a === b) ok = false; else p.set(a, b);
    }
    if (ok) best = sum;
  }
  return best;
}

/* ---------- laço principal ---------- */
for (let t = 0; t < N; t++) {
  const g = randomGraph();
  const vs = g.vertices();
  const src = vs[ri(0, vs.length - 1)];

  // Dijkstra == Floyd–Warshall (distâncias, alcançabilidade, caminhos válidos)
  const fw = floyd(g), dj = S.dijkstra(g, src);
  check(dj.ok, 'Dijkstra devolveu erro em grafo sem pesos negativos', g);
  for (const row of dj.rows) {
    const expect = fw.d[fw.idx.get(src)][fw.idx.get(row.v)];
    check(row.dist === expect, `Dijkstra ${src}->${row.v}: obteve ${row.dist}, esperado ${expect}`, g);
    check(row.reachable === (expect !== Infinity), `alcançabilidade ${src}->${row.v}`, g);
    if (row.path) {
      let cost = 0;
      for (let i = 0; i < row.path.length - 1; i++) {
        const e = g.neighbors(row.path[i]).find((x) => x.to === row.path[i + 1]);
        check(!!e, `caminho usa via inexistente/interditada ${row.path[i]}->${row.path[i + 1]}`, g);
        cost += e.w;
      }
      check(cost === row.dist, `custo do caminho ${row.path.join('>')} = ${cost} != ${row.dist}`, g);
      check(row.path[0] === src && row.path[row.path.length - 1] === row.v, 'extremos do caminho', g);
    }
  }

  // BFS == Floyd com peso unitário; níveis consistentes
  const fu = floyd(g, true), bf = S.bfs(g, src);
  for (const v of vs) {
    const expect = fu.d[fu.idx.get(src)][fu.idx.get(v)];
    check((bf.hops.has(v) ? bf.hops.get(v) : Infinity) === expect, `BFS saltos ${src}->${v}`, g);
  }
  check(bf.levels.flat().length === bf.visitOrder.length, 'BFS: níveis cobrem a ordem de visita', g);
  check(bf.visitOrder.length + bf.unreached.length === vs.length, 'BFS: visitados + fora de alcance = V', g);

  // DFS: conjunto alcançável, aninhamento de intervalos, componentes
  const df = S.dfs(g, src);
  const reach = new Set(vs.filter((v) => fu.d[fu.idx.get(src)][fu.idx.get(v)] !== Infinity));
  check(df.reachable.length === reach.size && df.reachable.every((v) => reach.has(v)), 'DFS: alcançáveis a partir da origem', g);
  check(df.visitOrder.length === vs.length && new Set(df.visitOrder).size === vs.length, 'DFS visita cada vértice exatamente uma vez', g);
  check(df.components.length === compCount(g), `DFS: ${df.components.length} componentes, esperado ${compCount(g)}`, g);
  for (const v of vs) {
    check(df.disc.get(v) < df.fin.get(v), 'DFS: d < f', g);
    const p = df.parent.get(v);
    if (p !== null) check(df.disc.get(p) < df.disc.get(v) && df.fin.get(v) < df.fin.get(p), `DFS: intervalo de ${v} dentro do pai ${p}`, g);
  }
  const times = vs.flatMap((v) => [df.disc.get(v), df.fin.get(v)]).sort((a, b) => a - b);
  check(times.every((x, i) => x === i + 1), 'DFS: tempos formam 1..2V', g);
  check(df.trees.length === vs.filter((v) => df.parent.get(v) === null).length, 'DFS: nº de árvores = nº de raízes', g);

  // Kruskal == Prim (soma e nº de arestas) == força bruta (grafos pequenos)
  const kr = S.kruskal(g), pr = primForest(g);
  check(kr.ok, 'Kruskal falhou', g);
  check(kr.total === pr.total, `Kruskal ${kr.total} != Prim ${pr.total}`, g);
  check(kr.chosen.length === pr.edges && kr.chosen.length === vs.length - compCount(g), 'Kruskal: V - componentes arestas', g);
  check(kr.componentCount === compCount(g), 'Kruskal: componentes finais', g);
  check(kr.spanning === (compCount(g) === 1), 'Kruskal: flag spanning', g);
  const bm = bruteMst(g);
  if (bm !== null) check(bm === kr.total, `Kruskal ${kr.total} != força bruta ${bm}`, g);

  // Resiliência == remoção por força bruta
  const rs = S.resilience(g), base = compCount(g);
  const expPts = vs.filter((v) => compCount(g, v) > base - (isIsolated(g, v) ? 1 : 0));
  check(sameSet(rs.pointRows.map((p) => p.v), expPts), `pontos de articulação: obteve ${rs.pointRows.map((p) => p.v)}, esperado ${expPts}`, g);
  const expBr = activeEdges(g).filter((e) => compCount(g, null, e.id) > base).map((e) => e.id);
  // aresta paralela (u→v e v→u em grafo direcionado) nunca é ponte na visão não-direcionada
  const parallel = (e) => activeEdges(g).some((o) => o.id !== e.id && ((o.u === e.u && o.v === e.v) || (o.u === e.v && o.v === e.u)));
  check(sameSet(rs.bridgeRows.map((b) => b.edge.id), expBr.filter((id) => !parallel(g.edgeById(id)))), 'pontes', g);
}

function isIsolated(g, v) { return !activeEdges(g).some((e) => e.u === v || e.v === v); }
function sameSet(a, b) { return a.length === b.length && a.every((x) => b.includes(x)); }

console.log(`Validação cruzada: ${N} grafos aleatórios, ${checks} verificações — tudo correto.`);
