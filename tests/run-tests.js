/* Testes do núcleo (sem dependências):  node tests/run-tests.js */
'use strict';
const assert = require('assert');
const path = require('path');
const load = (f) => require(path.join(__dirname, '..', 'js', f));
load('graph.js'); load('algorithms.js'); load('parser.js'); load('presets.js');
const S = globalThis.SmartNet;

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};
const prof = () => S.buildPreset('professor').graph;

console.log('Grafo do professor');
test('8 vértices e 14 arestas', () => { const g = prof(); assert.equal(g.vertexCount, 8); assert.equal(g.edgeCount, 14); });
test('Dijkstra a partir de O', () => {
  const r = S.dijkstra(prof(), 'O');
  const d = Object.fromEntries(r.rows.map((x) => [x.v, x.dist]));
  assert.deepEqual(d, { O: 0, A: 2, B: 4, C: 4, D: 8, E: 7, F: 14, T: 13 });
  assert.deepEqual(r.rows.find((x) => x.v === 'T').path, ['O', 'A', 'B', 'D', 'T']);
});
test('Kruskal: custo 20 e 7 arestas', () => {
  const r = S.kruskal(prof());
  assert.equal(r.total, 20); assert.equal(r.chosen.length, 7); assert.ok(r.spanning);
  assert.deepEqual(r.chosen.map((e) => `${e.u}${e.v}`), ['BC', 'OA', 'AB', 'BE', 'FT', 'BD', 'DT']);
});
test('BFS a partir de O: níveis', () => {
  const r = S.bfs(prof(), 'O');
  assert.deepEqual(r.levels, [['O'], ['A', 'C', 'B'], ['D', 'F', 'E'], ['T']]);
  assert.equal(r.hops.get('T'), 3);
});
test('DFS visita os 8 vértices em uma árvore', () => {
  const r = S.dfs(prof(), 'O');
  assert.equal(r.visitOrder.length, 8); assert.equal(r.trees.length, 1); assert.ok(r.connected); assert.ok(r.hasCycle);
  assert.equal(r.visitOrder[0], 'O');
});
test('DFS em ordem alfabética', () => {
  assert.deepEqual(S.dfs(prof(), 'O', { order: 'alpha' }).visitOrder.slice(0, 3), ['O', 'A', 'B']);
});
test('Resiliência: grafo oficial não tem pontos únicos de falha', () => {
  const r = S.resilience(prof());
  assert.equal(r.pointRows.length, 0); assert.equal(r.bridgeRows.length, 0); assert.ok(r.robust);
});

console.log('Casos de borda');
test('grafo desconexo: Kruskal vira floresta, Dijkstra marca ∞', () => {
  const g = new S.Graph(); g.addEdge('A', 'B', 1); g.addEdge('C', 'D', 2); g.addVertex('Z');
  const k = S.kruskal(g); assert.ok(!k.spanning); assert.equal(k.componentCount, 3); assert.equal(k.total, 3);
  const d = S.dijkstra(g, 'A'); assert.deepEqual(d.unreachable, ['C', 'D', 'Z']);
  const b = S.bfs(g, 'A'); assert.deepEqual(b.unreached, ['C', 'D', 'Z']);
  const f = S.dfs(g, 'A'); assert.equal(f.trees.length, 3); assert.equal(f.components.length, 3);
  assert.deepEqual(f.isolated, ['Z']);
});
test('pesos zero funcionam', () => {
  const g = new S.Graph(); g.addEdge('A', 'B', 0); g.addEdge('B', 'C', 0); g.addEdge('A', 'C', 1);
  const d = S.dijkstra(g, 'A'); assert.equal(d.rows.find((r) => r.v === 'C').dist, 0);
  assert.equal(S.kruskal(g).total, 0);
});
test('peso negativo: Dijkstra recusa, Kruskal aceita', () => {
  const g = new S.Graph(); g.addEdge('A', 'B', -2); g.addEdge('B', 'C', 1);
  assert.ok(!S.dijkstra(g, 'A').ok); assert.equal(S.kruskal(g).total, -1);
});
test('vértice único e grafo vazio', () => {
  const g = new S.Graph(); g.addVertex('X');
  assert.equal(S.kruskal(g).total, 0); assert.ok(S.dijkstra(g, 'X').ok); assert.ok(S.bfs(g, 'X').ok); assert.ok(S.dfs(g, 'X').ok);
  assert.ok(!S.kruskal(new S.Graph()).ok); assert.ok(!S.dfs(new S.Graph(), 'X').ok);
});
test('direcionado: Dijkstra respeita sentido; DFS classifica arestas', () => {
  const g = new S.Graph({ directed: true }); g.addEdge('A', 'B', 1); g.addEdge('B', 'C', 1); g.addEdge('C', 'A', 1); g.addEdge('A', 'C', 5);
  const d = S.dijkstra(g, 'B'); assert.equal(d.rows.find((r) => r.v === 'A').dist, 2);
  const f = S.dfs(g, 'A'); assert.ok(f.hasCycle); assert.ok(f.kinds.some((k) => k.kind === 'retorno (ciclo)'));
  const g2 = new S.Graph({ directed: true }); g2.addEdge('A', 'B', 1);
  assert.deepEqual(S.dfs(g2, 'A').deadEnds.map((x) => x.v), ['B']);
});
test('não-ponderado usa peso 1 (BFS == Dijkstra em saltos)', () => {
  const g = new S.Graph({ weighted: false }); g.addEdge('A', 'B', 99); g.addEdge('B', 'C'); g.addEdge('A', 'C');
  assert.equal(S.dijkstra(g, 'A').rows.find((r) => r.v === 'C').dist, 1);
});
test('via interditada é ignorada e pode desconectar', () => {
  const g = prof(); g.setBlocked(g.findEdge('F', 'T').id, true); g.setBlocked(g.findEdge('A', 'F').id, true);
  const d = S.dijkstra(g, 'O'); assert.deepEqual(d.unreachable, ['F']);
  assert.ok(!S.kruskal(g).spanning);
});
test('pontes e pontos de articulação', () => {
  const g = new S.Graph(); g.addEdge('A', 'B', 1); g.addEdge('B', 'C', 1); g.addEdge('C', 'A', 1); g.addEdge('C', 'D', 1);
  const r = S.resilience(g);
  assert.deepEqual(r.pointRows.map((p) => p.v), ['C']); assert.equal(r.bridgeRows.length, 1);
  assert.deepEqual(r.bridgeRows[0].sizes, [3, 1]);
});
test('MinHeap ordena', () => {
  const h = new S.MinHeap(); [5, 1, 4, 1, 3].forEach((k, i) => h.push(i, k));
  const out = []; while (h.size) out.push(h.pop().key); assert.deepEqual(out, [1, 1, 3, 4, 5]);
});

console.log('Estrutura e parser');
test('não-direcionado grava nas duas listas com a mesma aresta', () => {
  const g = new S.Graph(); g.addEdge('A', 'B', 3);
  assert.strictEqual(g.adj.get('A')[0].edge, g.adj.get('B')[0].edge);
});
test('laço, nome inválido e peso inválido são rejeitados', () => {
  const g = new S.Graph();
  assert.throws(() => g.addEdge('A', 'A', 1)); assert.throws(() => g.addVertex('a b')); assert.throws(() => g.addEdge('A', 'B', 'x'));
});
test('aresta repetida atualiza peso; remover vértice remove vias', () => {
  const g = new S.Graph(); g.addEdge('A', 'B', 3); assert.equal(g.addEdge('B', 'A', 9).created, false); assert.equal(g.edgeCount, 1);
  g.removeVertex('A'); assert.equal(g.edgeCount, 0); assert.equal(g.adj.get('B').length, 0);
});
test('direcionado → não-direcionado funde vias opostas', () => {
  const g = new S.Graph({ directed: true }); g.addEdge('A', 'B', 4); g.addEdge('B', 'A', 2);
  assert.equal(g.setDirected(false), 1); assert.equal(g.edgeCount, 1); assert.equal(g.findEdge('A', 'B').w, 2);
});
test('toText ↔ parse é ida e volta', () => {
  const g = prof(); g.addVertex('Solo');
  const r = S.parseGraphText(g.toText()); assert.ok(r.ok);
  assert.equal(r.graph.vertexCount, 9); assert.equal(r.graph.edgeCount, 14); assert.equal(r.graph.findEdge('A', 'F').w, 12);
});
test('parser: erros com número de linha, setas, vírgulas e comentários', () => {
  const bad = S.parseGraphText('A B 2\nA B x\nA B C D'); assert.ok(!bad.ok); assert.equal(bad.errors.length, 2); assert.match(bad.errors[0], /Linha 2/);
  const ok = S.parseGraphText('# oi\ndirecionado: sim\nA -> B 3, # c\nB;C;4\nD');
  assert.ok(ok.ok); assert.ok(ok.graph.directed); assert.equal(ok.graph.edgeCount, 2); assert.ok(ok.graph.hasVertex('D'));
  assert.ok(!S.parseGraphText('   \n# nada').ok);
});

console.log(`\n${passed} testes passaram${process.exitCode ? ' (HÁ FALHAS)' : ''}.`);
