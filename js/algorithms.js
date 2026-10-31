/*
 * algorithms.js — DFS, BFS, Dijkstra, Kruskal e Análise de Resiliência (Tarjan).
 *
 * Tudo escrito do zero sobre a Graph (lista de adjacência). Cada algoritmo devolve
 *   { ok, algo, error?, steps[], complexity, ...resultado }
 * onde `steps` é a gravação passo a passo usada pelo player da interface:
 *   { msg, current, nodes:{v:classe}, edges:{id:classe}, aux:[{label,value}] }
 *
 * Vias interditadas (edge.blocked) são ignoradas por todos os algoritmos.
 */
(function (root) {
  'use strict';

  const INF = Infinity;
  const fmt = (n) => (n === INF ? '∞' : Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6));
  const label = (e) => `${e.u}–${e.v}`;

  function fail(algo, error) {
    return { ok: false, algo, error, steps: [] };
  }

  /** Gravador de passos: mantém o estado acumulado e tira "fotos" dele. */
  function recorder() {
    const nodes = {};
    const edges = {};
    const steps = [];
    return {
      nodes,
      edges,
      steps,
      snap(msg, aux = [], current = null) {
        steps.push({ msg, current, nodes: { ...nodes }, edges: { ...edges }, aux });
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Estruturas auxiliares                                                */
  /* ------------------------------------------------------------------ */

  /** Fila de prioridade (heap binário de mínimo). Desempate por ordem de entrada. */
  class MinHeap {
    constructor() { this.a = []; this.seq = 0; }
    get size() { return this.a.length; }
    _less(i, j) {
      const x = this.a[i], y = this.a[j];
      return x.key < y.key || (x.key === y.key && x.seq < y.seq);
    }
    _swap(i, j) { [this.a[i], this.a[j]] = [this.a[j], this.a[i]]; }
    push(value, key) {
      this.a.push({ value, key, seq: this.seq++ });
      let i = this.a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!this._less(i, p)) break;
        this._swap(i, p);
        i = p;
      }
    }
    pop() {
      const top = this.a[0];
      const last = this.a.pop();
      if (this.a.length) {
        this.a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < this.a.length && this._less(l, m)) m = l;
          if (r < this.a.length && this._less(r, m)) m = r;
          if (m === i) break;
          this._swap(i, m);
          i = m;
        }
      }
      return top;
    }
  }

  /** Union-Find com compressão de caminho + união por rank (α(n) amortizado). */
  class UnionFind {
    constructor(items) {
      this.parent = new Map(items.map((x) => [x, x]));
      this.rank = new Map(items.map((x) => [x, 0]));
      this.count = items.length;
    }
    find(x) {
      let r = x;
      while (this.parent.get(r) !== r) r = this.parent.get(r);
      while (this.parent.get(x) !== r) { const n = this.parent.get(x); this.parent.set(x, r); x = n; }
      return r;
    }
    union(a, b) {
      let ra = this.find(a), rb = this.find(b);
      if (ra === rb) return false;
      if (this.rank.get(ra) < this.rank.get(rb)) [ra, rb] = [rb, ra];
      this.parent.set(rb, ra);
      if (this.rank.get(ra) === this.rank.get(rb)) this.rank.set(ra, this.rank.get(ra) + 1);
      this.count--;
      return true;
    }
  }

  /** Visão não-direcionada das vias ativas: v -> [{to, id}]. */
  function undirectedView(g, skipVertex = null, skipEdgeId = null) {
    const m = new Map();
    for (const v of g.vertices()) if (v !== skipVertex) m.set(v, []);
    for (const e of g.edges) {
      if (e.blocked || e.id === skipEdgeId || e.u === skipVertex || e.v === skipVertex) continue;
      m.get(e.u).push({ to: e.v, id: e.id });
      m.get(e.v).push({ to: e.u, id: e.id });
    }
    return m;
  }

  /** Componentes (conexos ignorando direção), em ordem de vértice. */
  function components(adj) {
    const seen = new Set();
    const out = [];
    for (const s of adj.keys()) {
      if (seen.has(s)) continue;
      const comp = [];
      const stack = [s];
      seen.add(s);
      while (stack.length) {
        const u = stack.pop();
        comp.push(u);
        for (const { to } of adj.get(u)) if (!seen.has(to)) { seen.add(to); stack.push(to); }
      }
      out.push(comp);
    }
    return out;
  }

  function treeLines(rootV, children) {
    const lines = [rootV];
    const walk = (node, prefix) => {
      const kids = children.get(node) || [];
      kids.forEach((k, i) => {
        const last = i === kids.length - 1;
        lines.push(`${prefix}${last ? '└─ ' : '├─ '}${k.v}${k.w !== null ? ` (${fmt(k.w)})` : ''}`);
        walk(k.v, prefix + (last ? '   ' : '│  '));
      });
    };
    walk(rootV, '');
    return lines;
  }

  /* ------------------------------------------------------------------ */
  /* DFS — Busca em Profundidade                                          */
  /* ------------------------------------------------------------------ */
  function dfs(g, source, { order = 'insertion' } = {}) {
    const algo = 'dfs';
    if (!g.hasVertex(source)) return fail(algo, 'Escolha um vértice de origem válido.');

    const verts = g.vertices();
    const disc = new Map(), fin = new Map(), parent = new Map(), parentEdge = new Map();
    const visitOrder = [], kinds = [], treeRoots = [];
    const children = new Map(verts.map((v) => [v, []]));
    let time = 0;
    let hasCycle = false;
    const rec = recorder();
    const path = []; // pilha de recursão (nomes)

    const stackAux = () => [{ label: 'Pilha (DFS)', value: path.length ? path.join(' › ') : '(vazia)' }];

    // Origem primeiro; depois os demais vértices, para cobrir grafos desconexos.
    const startOrder = [source, ...verts.filter((v) => v !== source)];

    for (const r of startOrder) {
      if (disc.has(r)) continue;
      treeRoots.push(r);
      const discover = (v, from, edge) => {
        disc.set(v, ++time);
        visitOrder.push(v);
        parent.set(v, from);
        parentEdge.set(v, edge);
        if (from !== null) children.get(from).push({ v, w: g.weighted ? g.weight(edge) : null });
        rec.nodes[v] = 'current';
        path.push(v);
        rec.snap(
          from === null
            ? (r === source ? `Inicia em ${v} (d=${time}).` : `${v} não foi alcançado: nova árvore da floresta DFS começa aqui (d=${time}).`)
            : `Desce de ${from} para ${v} (d=${time}).`,
          stackAux(), v,
        );
      };
      discover(r, null, null);
      const stack = [{ v: r, it: g.neighbors(r, { order }), i: 0 }];

      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.i < top.it.length) {
          const { to, edge } = top.it[top.i++];
          if (!disc.has(to)) {
            rec.edges[edge.id] = 'tree';
            kinds.push({ from: top.v, to, kind: 'árvore' });
            const prev = top.v;
            rec.nodes[prev] = 'visited';
            discover(to, prev, edge);
            stack.push({ v: to, it: g.neighbors(to, { order }), i: 0 });
          } else if (!g.directed && edge === parentEdge.get(top.v)) {
            // volta pela mesma via em grafo não-direcionado: ignora
          } else if (!fin.has(to)) {
            hasCycle = true;
            rec.edges[edge.id] = 'back';
            kinds.push({ from: top.v, to, kind: 'retorno (ciclo)' });
            rec.snap(`Aresta ${top.v}→${to} volta a um ancestral ainda aberto: há um ciclo.`, stackAux(), top.v);
          } else if (g.directed) {
            const kind = disc.get(top.v) < disc.get(to) ? 'avanço' : 'cruzada';
            kinds.push({ from: top.v, to, kind });
          }
        } else {
          stack.pop();
          path.pop();
          fin.set(top.v, ++time);
          rec.nodes[top.v] = 'done';
          rec.snap(`Todos os vizinhos de ${top.v} já foram explorados: retrocede (f=${time}).`, stackAux(), stack.length ? stack[stack.length - 1].v : null);
        }
      }
    }

    const fullTrees = treeRoots.map((r) => ({ root: r, lines: treeLines(r, children) }));

    // Conectividade e becos sem saída.
    const comps = components(undirectedView(g));
    // Alcançáveis a partir da origem = a primeira árvore da floresta (visitada primeiro).
    const reachable = visitOrder.slice(0, countTree(source, children));
    const reachSet = new Set(reachable);
    const deadEnds = [];
    const isolated = [];
    for (const v of verts) {
      const out = g.outDegree(v);
      const inn = g.inDegree(v);
      if (out === 0 && inn === 0) isolated.push(v);
      else if (!g.directed && out === 1) deadEnds.push({ v, kind: 'grau 1 (rua sem continuidade)' });
      else if (g.directed && out === 0) deadEnds.push({ v, kind: 'sem saída (só recebe tráfego)' });
    }

    rec.snap(`DFS concluída: ${visitOrder.length} vértice(s) visitado(s), ${fullTrees.length} árvore(s).`, stackAux(), null);

    return {
      ok: true, algo, source, order,
      visitOrder, disc, fin, parent, kinds, trees: fullTrees,
      components: comps, connected: comps.length <= 1,
      reachable, unreachable: verts.filter((v) => !reachSet.has(v)),
      deadEnds, isolated, hasCycle,
      steps: rec.steps,
      complexity: {
        time: 'O(V + E)',
        space: 'O(V)',
        why: 'Cada vértice entra e sai da pilha uma vez e cada posição das listas de adjacência é percorrida uma vez.',
      },
    };
  }

  function countTree(rootV, children) {
    let n = 0;
    const stack = [rootV];
    while (stack.length) {
      const u = stack.pop();
      n++;
      for (const k of children.get(u) || []) stack.push(k.v);
    }
    return n;
  }

  /* ------------------------------------------------------------------ */
  /* BFS — Busca em Largura                                               */
  /* ------------------------------------------------------------------ */
  function bfs(g, source, { order = 'insertion' } = {}) {
    const algo = 'bfs';
    if (!g.hasVertex(source)) return fail(algo, 'Escolha um vértice de origem válido.');

    const verts = g.vertices();
    const hops = new Map([[source, 0]]);
    const parent = new Map([[source, null]]);
    const parentEdge = new Map();
    const visitOrder = [];
    const log = [];
    const levels = [[source]];
    const rec = recorder();
    // Fila com índice de cabeça: dequeue O(1), sem Array.shift().
    const queue = [source];
    let head = 0;
    const qView = () => (head < queue.length ? `[ ${queue.slice(head).join(', ')} ]` : '[ ] (vazia)');

    rec.nodes[source] = 'frontier';
    rec.snap(`Enfileira a origem ${source} (nível 0). Alerta emitido.`, [{ label: 'Fila', value: qView() }], source);
    log.push({ step: 0, dequeued: null, enqueued: [source], queue: queue.slice() });

    while (head < queue.length) {
      const u = queue[head++];
      visitOrder.push(u);
      rec.nodes[u] = 'current';
      const found = [];
      for (const { to, edge } of g.neighbors(u, { order })) {
        if (hops.has(to)) continue;
        hops.set(to, hops.get(u) + 1);
        parent.set(to, u);
        parentEdge.set(to, edge);
        rec.edges[edge.id] = 'tree';
        rec.nodes[to] = 'frontier';
        queue.push(to);
        found.push(to);
        (levels[hops.get(to)] = levels[hops.get(to)] || []).push(to);
      }
      log.push({ step: log.length, dequeued: u, enqueued: found, queue: queue.slice(head) });
      rec.snap(
        found.length
          ? `Desenfileira ${u} (nível ${hops.get(u)}); alerta chega a ${found.join(', ')} (nível ${hops.get(u) + 1}).`
          : `Desenfileira ${u} (nível ${hops.get(u)}); nenhum vizinho novo.`,
        [{ label: 'Fila', value: qView() }], u,
      );
      rec.nodes[u] = 'done';
    }

    const unreached = verts.filter((v) => !hops.has(v));
    rec.snap(`BFS concluída: ${visitOrder.length} bairro(s) alcançado(s) em ${levels.length - 1} salto(s) no máximo.`, [{ label: 'Fila', value: qView() }], null);

    return {
      ok: true, algo, source, order,
      visitOrder, hops, parent, levels, log, unreached,
      steps: rec.steps,
      complexity: {
        time: 'O(V + E)',
        space: 'O(V)',
        why: 'Cada vértice é enfileirado no máximo uma vez; a fila implementada com índice de cabeça torna o desenfileirar O(1).',
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Dijkstra — menor caminho a partir de uma origem                      */
  /* ------------------------------------------------------------------ */
  function dijkstra(g, source, { target = null } = {}) {
    const algo = 'dijkstra';
    if (!g.hasVertex(source)) return fail(algo, 'Escolha um vértice de origem válido.');
    for (const e of g.activeEdges()) {
      if (g.weight(e) < 0) return fail(algo, `Dijkstra não admite pesos negativos (aresta ${label(e)} = ${fmt(g.weight(e))}).`);
    }

    const verts = g.vertices();
    const dist = new Map(verts.map((v) => [v, INF]));
    const pred = new Map(verts.map((v) => [v, null]));
    const predEdge = new Map();
    const settled = new Set();
    const settleOrder = [];
    const rec = recorder();
    const heap = new MinHeap();

    const distAux = () => [{ label: 'Distâncias', value: verts.map((v) => `${v}=${fmt(dist.get(v))}`).join('  ') }];

    dist.set(source, 0);
    heap.push(source, 0);
    rec.nodes[source] = 'frontier';
    rec.snap(`Distância de ${source} = 0; as demais começam em ∞.`, distAux(), source);

    while (heap.size) {
      const { value: u, key: d } = heap.pop();
      if (settled.has(u) || d > dist.get(u)) continue; // entrada obsoleta da fila
      settled.add(u);
      settleOrder.push(u);
      rec.nodes[u] = 'current';
      if (predEdge.has(u)) rec.edges[predEdge.get(u).id] = 'tree';
      const notes = [];
      for (const { to, edge, w } of g.neighbors(u)) {
        if (settled.has(to)) continue;
        const nd = d + w;
        if (nd < dist.get(to)) {
          const old = predEdge.get(to);
          if (old) delete rec.edges[old.id];
          dist.set(to, nd);
          pred.set(to, u);
          predEdge.set(to, edge);
          rec.edges[edge.id] = 'considered';
          rec.nodes[to] = 'frontier';
          heap.push(to, nd);
          notes.push(`${to}=${fmt(nd)}`);
        }
      }
      rec.snap(
        `Fixa ${u} com distância ${fmt(d)}${notes.length ? `; relaxa: ${notes.join(', ')}` : '; nenhuma melhoria'}.`,
        distAux(), u,
      );
      rec.nodes[u] = 'done';
    }

    const pathTo = (v) => {
      if (dist.get(v) === INF) return null;
      const p = [];
      for (let c = v; c !== null; c = pred.get(c)) p.push(c);
      return p.reverse();
    };

    const rows = verts.map((v) => ({
      v, dist: dist.get(v), pred: pred.get(v), path: pathTo(v), reachable: dist.get(v) !== INF,
    }));

    let targetPath = null;
    if (target && g.hasVertex(target)) {
      targetPath = pathTo(target);
      if (targetPath) {
        for (const k of Object.keys(rec.edges)) if (rec.edges[k] === 'tree' || rec.edges[k] === 'considered') delete rec.edges[k];
        for (let i = 0; i < targetPath.length - 1; i++) {
          rec.edges[predEdge.get(targetPath[i + 1]).id] = 'path';
        }
      }
    }
    const unreachable = rows.filter((r) => !r.reachable).map((r) => r.v);
    rec.snap(
      targetPath
        ? `Rota mais rápida ${source} → ${target}: ${targetPath.join(' → ')} (custo ${fmt(dist.get(target))}).`
        : `Dijkstra concluído: ${settleOrder.length} vértice(s) com distância mínima definida.`,
      distAux(), null,
    );

    return {
      ok: true, algo, source, target, rows, settleOrder, unreachable,
      targetPath, targetCost: target && g.hasVertex(target) ? dist.get(target) : null,
      treeEdgeIds: [...predEdge.values()].map((e) => e.id),
      steps: rec.steps,
      complexity: {
        time: 'O((V + E) log V)',
        space: 'O(V + E)',
        why: 'Heap binário próprio: cada aresta pode gerar um push O(log V). Com matriz seria O(V²) só para varrer vizinhos.',
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Kruskal — Árvore Geradora Mínima                                     */
  /* ------------------------------------------------------------------ */
  function kruskal(g) {
    const algo = 'kruskal';
    const verts = g.vertices();
    if (!verts.length) return fail(algo, 'O grafo está vazio.');

    // Ordenação estável: pesos iguais mantêm a ordem de cadastro das vias.
    const sorted = g.activeEdges().slice().sort((a, b) => g.weight(a) - g.weight(b));
    const uf = new UnionFind(verts);
    const chosen = [];
    const table = [];
    let total = 0;
    const rec = recorder();
    const aux = () => [
      { label: 'Custo parcial', value: fmt(total) },
      { label: 'Arestas na MST', value: `${chosen.length} de ${Math.max(verts.length - 1, 0)}` },
    ];

    rec.snap(`${sorted.length} via(s) ordenadas por custo crescente. Cada bairro começa como seu próprio componente.`, aux(), null);

    let i = 0;
    for (; i < sorted.length; i++) {
      if (uf.count === 1) break;
      const e = sorted[i];
      const w = g.weight(e);
      if (uf.union(e.u, e.v)) {
        chosen.push(e);
        total += w;
        rec.edges[e.id] = 'mst';
        rec.nodes[e.u] = 'visited';
        rec.nodes[e.v] = 'visited';
        table.push({ edge: e, w, status: 'aceita' });
        rec.snap(`${label(e)} (${fmt(w)}): conecta componentes diferentes → ACEITA.`, aux(), null);
      } else {
        rec.edges[e.id] = 'rejected';
        table.push({ edge: e, w, status: 'rejeitada' });
        rec.snap(`${label(e)} (${fmt(w)}): extremos já estão ligados → REJEITADA (formaria ciclo).`, aux(), null);
      }
    }
    for (; i < sorted.length; i++) table.push({ edge: sorted[i], w: g.weight(sorted[i]), status: 'não avaliada' });

    const spanning = uf.count === 1;
    rec.snap(
      spanning
        ? `MST completa: ${chosen.length} aresta(s), custo total ${fmt(total)}.`
        : `Grafo desconexo: floresta geradora mínima com ${uf.count} componentes, custo total ${fmt(total)}.`,
      aux(), null,
    );

    return {
      ok: true, algo, chosen, total, table, spanning, componentCount: uf.count,
      treatedAsUndirected: g.directed,
      steps: rec.steps,
      complexity: {
        time: 'O(E log E)',
        space: 'O(V + E)',
        why: 'Dominado pela ordenação das arestas; Union-Find com compressão de caminho e união por rank custa α(V) por operação.',
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Resiliência — pontos de articulação e pontes (Tarjan, low-link)      */
  /* ------------------------------------------------------------------ */
  function resilience(g) {
    const algo = 'resilience';
    const verts = g.vertices();
    if (!verts.length) return fail(algo, 'O grafo está vazio.');

    const adj = undirectedView(g);
    const disc = new Map(), low = new Map();
    const points = new Set();
    const bridgeIds = [];
    let t = 0;

    const visit = (u, viaEdge) => {
      disc.set(u, ++t);
      low.set(u, disc.get(u));
      let kids = 0;
      for (const { to, id } of adj.get(u)) {
        if (id === viaEdge) continue;
        if (disc.has(to)) {
          low.set(u, Math.min(low.get(u), disc.get(to)));
        } else {
          kids++;
          visit(to, id);
          low.set(u, Math.min(low.get(u), low.get(to)));
          if (low.get(to) > disc.get(u)) bridgeIds.push(id);
          if (viaEdge !== null && low.get(to) >= disc.get(u)) points.add(u);
        }
      }
      if (viaEdge === null && kids > 1) points.add(u);
    };
    for (const v of verts) if (!disc.has(v)) visit(v, null);

    const baseline = components(adj).length;
    const sizesOf = (cs) => cs.map((c) => c.length).sort((a, b) => b - a);

    const pointRows = verts.filter((v) => points.has(v)).map((v) => {
      const cs = components(undirectedView(g, v));
      return { v, components: cs.length, sizes: sizesOf(cs), extra: cs.length - baseline };
    });
    const bridgeRows = bridgeIds
      .map((id) => g.edgeById(id))
      .map((e) => {
        const cs = components(undirectedView(g, null, e.id));
        return { edge: e, components: cs.length, sizes: sizesOf(cs) };
      });

    const rec = recorder();
    for (const p of pointRows) rec.nodes[p.v] = 'critical';
    for (const b of bridgeRows) rec.edges[b.edge.id] = 'critical';
    rec.snap(
      pointRows.length || bridgeRows.length
        ? `${pointRows.length} bairro(s) crítico(s) e ${bridgeRows.length} via(s) crítica(s): a falha de qualquer um deles isola parte da cidade.`
        : 'Nenhum ponto único de falha: a rede continua conexa se qualquer bairro ou via falhar.',
      [{ label: 'Componentes', value: String(baseline) }], null,
    );

    return {
      ok: true, algo, pointRows, bridgeRows, baseline,
      connected: baseline === 1,
      robust: baseline === 1 && !pointRows.length && !bridgeRows.length,
      treatedAsUndirected: g.directed,
      steps: rec.steps,
      complexity: {
        time: 'O(V + E)',
        space: 'O(V)',
        why: 'Uma única DFS calculando tempos de descoberta e low-link; o relatório de impacto refaz uma busca por ponto crítico.',
      },
    };
  }

  root.SmartNet = root.SmartNet || {};
  Object.assign(root.SmartNet, { dfs, bfs, dijkstra, kruskal, resilience, MinHeap, UnionFind, fmt, components, undirectedView });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SmartNet;
})(typeof window !== 'undefined' ? window : globalThis);
