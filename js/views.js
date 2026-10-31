/*
 * views.js — renderização dos resultados dos algoritmos e da "visão da memória".
 */
(function (root) {
  'use strict';
  const { el, fmt } = root.SmartNet;

  const edgeName = (g, e) => `${e.u} ${g.directed ? '→' : '–'} ${e.v}`;

  /* ---------- peças ---------- */
  const badge = (text, kind = 'neutral') => el('span', { class: `badge badge-${kind}` }, text);

  function table(headers, rows, { cls = '', rowClass } = {}) {
    return el('div', { class: 'table-wrap' },
      el('table', { class: `tbl ${cls}` },
        el('thead', {}, el('tr', {}, headers.map((h) => el('th', {}, h)))),
        el('tbody', {}, rows.map((r, i) => el('tr', { class: rowClass ? rowClass(i) : '' }, r.map((c) => el('td', {}, c)))))));
  }

  const kpi = (label, value, kind = '') => el('div', { class: `kpi ${kind}` }, el('span', { class: 'kpi-value' }, value), el('span', { class: 'kpi-label' }, label));
  const block = (title, ...body) => el('section', { class: 'rblock' }, el('h4', {}, title), body);
  const chips = (list) => el('div', { class: 'chips' }, list.map((v, i) => el('span', { class: 'chip' }, el('i', {}, i + 1), v)));
  const note = (text, kind = 'info') => el('div', { class: `note note-${kind}` }, text);

  function complexity(c) {
    return el('div', { class: 'complexity' },
      el('div', {}, el('span', { class: 'cx-label' }, 'Tempo'), el('code', {}, c.time)),
      el('div', {}, el('span', { class: 'cx-label' }, 'Espaço'), el('code', {}, c.space)),
      el('p', {}, c.why));
  }

  /* ---------- DFS ---------- */
  function renderDfs(r, g) {
    const rows = r.visitOrder.map((v) => [v, r.disc.get(v), r.fin.get(v), r.parent.get(v) ?? '—']);
    const kinds = r.kinds.filter((k) => k.kind !== 'árvore');
    return el('div', { class: 'result' },
      el('div', { class: 'kpis' },
        kpi('bairros visitados', r.visitOrder.length),
        kpi(g.directed ? 'componentes (ignorando sentido)' : 'componentes conexos', r.components.length, r.connected ? 'good' : 'warn'),
        kpi('becos sem saída', r.deadEnds.length, r.deadEnds.length ? 'warn' : 'good'),
        kpi('ciclos', r.hasCycle ? 'sim' : 'não')),
      r.connected
        ? note('Rede conexa: todos os bairros podem se comunicar.', 'ok')
        : note(`Rede desconexa: ${r.components.length} ilhas isoladas — ${r.components.map((c) => `{${c.join(', ')}}`).join(' · ')}.`, 'warn'),
      r.unreachable.length && r.connected === false
        ? note(`A partir de ${r.source} não se chega a: ${r.unreachable.join(', ')}.`, 'warn')
        : (g.directed && r.unreachable.length ? note(`Respeitando o sentido das vias, ${r.source} não alcança: ${r.unreachable.join(', ')}.`, 'warn') : null),
      block('Ordem de visitação', chips(r.visitOrder)),
      block(r.trees.length > 1 ? 'Floresta DFS' : 'Árvore DFS', r.trees.map((t) => el('pre', { class: 'tree' }, t.lines.join('\n')))),
      block('Tempos de descoberta / término', table(['Bairro', 'Descoberta', 'Término', 'Pai'], rows)),
      block('Becos sem saída e vértices isolados',
        r.deadEnds.length || r.isolated.length
          ? el('ul', { class: 'plain' },
            r.deadEnds.map((d) => el('li', {}, badge(d.v, 'warn'), ' ', d.kind)),
            r.isolated.map((v) => el('li', {}, badge(v, 'bad'), ' isolado (sem nenhuma via ativa)')))
          : note('Nenhum beco sem saída encontrado.', 'ok')),
      kinds.length ? block('Arestas não-árvore', table(['De', 'Para', 'Classificação'], kinds.map((k) => [k.from, k.to, k.kind]))) : null,
      block('Complexidade', complexity(r.complexity)));
  }

  /* ---------- BFS ---------- */
  function renderBfs(r) {
    const maxHop = r.levels.length - 1;
    return el('div', { class: 'result' },
      el('div', { class: 'kpis' },
        kpi('bairros alcançados', r.visitOrder.length),
        kpi('saltos até o mais distante', maxHop),
        kpi('fora de alcance', r.unreached.length, r.unreached.length ? 'warn' : 'good')),
      r.unreached.length ? note(`O alerta não chega a: ${r.unreached.join(', ')}.`, 'warn') : note('O alerta alcança todos os bairros.', 'ok'),
      block('Ordem de visita (fila de execução)', chips(r.visitOrder)),
      block('Níveis da onda', table(['Saltos', 'Bairros'], r.levels.map((l, i) => [i, l.join(', ')]))),
      block('Registro da fila', table(['Passo', 'Desenfileira', 'Enfileira', 'Fila após o passo'],
        r.log.map((l) => [l.step, l.dequeued ?? '—', l.enqueued.join(', ') || '—', l.queue.length ? `[ ${l.queue.join(', ')} ]` : '[ ]']))),
      block('Menor caminho em saltos', table(['Bairro', 'Saltos', 'Pai'],
        r.visitOrder.map((v) => [v, r.hops.get(v), r.parent.get(v) ?? '—']))),
      block('Complexidade', complexity(r.complexity)));
  }

  /* ---------- Dijkstra ---------- */
  function renderDijkstra(r) {
    return el('div', { class: 'result' },
      el('div', { class: 'kpis' },
        kpi('origem', r.source),
        kpi('bairros alcançáveis', r.rows.filter((x) => x.reachable).length),
        r.targetPath ? kpi(`custo até ${r.target}`, fmt(r.targetCost), 'good') : kpi('inalcançáveis', r.unreachable.length, r.unreachable.length ? 'warn' : 'good')),
      r.target && !r.targetPath ? note(`Não existe rota de ${r.source} até ${r.target} (vias interditadas ou grafo desconexo).`, 'bad') : null,
      r.targetPath ? note(`Rota de emergência: ${r.targetPath.join(' → ')} · custo ${fmt(r.targetCost)}.`, 'ok') : null,
      r.unreachable.length ? note(`Sem rota a partir de ${r.source}: ${r.unreachable.join(', ')} (distância ∞).`, 'warn') : null,
      block('Distâncias mínimas e predecessores',
        table(['Destino', 'Distância', 'Predecessor', 'Caminho'],
          r.rows.map((x) => [x.v, x.reachable ? fmt(x.dist) : '∞', x.pred ?? '—', x.path ? x.path.join(' → ') : 'sem rota']),
          { rowClass: (i) => (!r.rows[i].reachable ? 'muted' : r.rows[i].v === r.target ? 'hl' : '') })),
      block('Ordem em que as distâncias foram fixadas', chips(r.settleOrder)),
      block('Complexidade', complexity(r.complexity)));
  }

  /* ---------- Kruskal ---------- */
  function renderKruskal(r, g) {
    return el('div', { class: 'result' },
      el('div', { class: 'kpis' },
        kpi('custo total da fibra', fmt(r.total), 'good'),
        kpi('arestas na MST', r.chosen.length),
        kpi('arestas descartadas', r.table.filter((t) => t.status === 'rejeitada').length)),
      r.spanning ? note('Todos os bairros foram interligados sem redundância.', 'ok')
        : note(`Grafo desconexo: não existe árvore única. Resultado é uma floresta com ${r.componentCount} componentes.`, 'warn'),
      r.treatedAsUndirected ? note('Grafo direcionado: o Kruskal considera as vias sem sentido (MST é conceito de grafos não-direcionados).', 'info') : null,
      block('Arestas selecionadas (rede de fibra)',
        r.chosen.length
          ? table(['#', 'Via', 'Custo'], [...r.chosen.map((e, i) => [i + 1, edgeName(g, e), fmt(g.weight(e))]), ['', 'TOTAL', fmt(r.total)]],
            { rowClass: (i) => (i === r.chosen.length ? 'total' : '') })
          : note('Nenhuma aresta necessária.', 'info')),
      block('Análise de todas as arestas (ordenadas por custo)',
        table(['Via', 'Custo', 'Decisão'], r.table.map((t) => [edgeName(g, t.edge), fmt(t.w),
          badge(t.status, t.status === 'aceita' ? 'ok' : t.status === 'rejeitada' ? 'bad' : 'neutral')]))),
      block('Complexidade', complexity(r.complexity)));
  }

  /* ---------- Resiliência ---------- */
  function renderResilience(r, g) {
    return el('div', { class: 'result' },
      el('div', { class: 'kpis' },
        kpi('bairros críticos', r.pointRows.length, r.pointRows.length ? 'bad' : 'good'),
        kpi('vias críticas', r.bridgeRows.length, r.bridgeRows.length ? 'bad' : 'good'),
        kpi('componentes agora', r.baseline, r.connected ? 'good' : 'warn')),
      r.robust ? note('Rede resiliente: nenhuma falha isolada de bairro ou via desconecta a cidade.', 'ok')
        : note(r.connected ? 'Rede conexa, mas com pontos únicos de falha — reforce com rotas redundantes.' : 'A rede já está fragmentada; os pontos críticos abaixo valem para cada ilha.', 'warn'),
      r.treatedAsUndirected ? note('Grafo direcionado: análise feita sem considerar o sentido das vias.', 'info') : null,
      block('Bairros críticos (pontos de articulação)',
        r.pointRows.length
          ? table(['Bairro', 'Componentes se falhar', 'Tamanho dos blocos'], r.pointRows.map((p) => [badge(p.v, 'bad'), p.components, p.sizes.join(' + ')]))
          : note('Nenhum.', 'ok')),
      block('Vias críticas (pontes)',
        r.bridgeRows.length
          ? table(['Via', 'Componentes se fechar', 'Tamanho dos blocos'], r.bridgeRows.map((b) => [badge(edgeName(g, b.edge), 'bad'), b.components, b.sizes.join(' + ')]))
          : note('Nenhuma.', 'ok')),
      block('Complexidade', complexity(r.complexity)));
  }

  function renderResult(r, g) {
    if (!r.ok) return el('div', { class: 'result' }, note(r.error, 'bad'));
    return ({ dfs: renderDfs, bfs: renderBfs, dijkstra: renderDijkstra, kruskal: renderKruskal, resilience: renderResilience })[r.algo](r, g);
  }

  /* ------------------------------------------------------------------ */
  /* Memória                                                              */
  /* ------------------------------------------------------------------ */
  function renderMemory(g, mode) {
    const V = g.vertexCount, E = g.edgeCount;
    const used = [...g.adj.values()].reduce((s, l) => s + l.length, 0);
    const cells = V * V;
    const density = cells ? (used / cells) * 100 : 0;

    const stats = el('div', { class: 'mem-stats' },
      kpi('vértices (V)', V), kpi('arestas (E)', E),
      kpi('nós nas listas', used), kpi('células da matriz (V²)', cells),
      kpi('ocupação da matriz', `${density.toFixed(1)}%`, density < 30 ? 'good' : 'warn'));

    let body;
    if (!V) {
      body = el('div', { class: 'empty-mini' }, 'O vetor de listas está vazio. Cadastre bairros para ver a estrutura.');
    } else if (mode === 'matrix') {
      const { verts, m } = g.toMatrix();
      body = el('div', { class: 'table-wrap' },
        el('table', { class: 'matrix' },
          el('thead', {}, el('tr', {}, el('th', {}, ''), verts.map((v) => el('th', {}, v)))),
          el('tbody', {}, verts.map((v, i) => el('tr', { 'data-vertex': v },
            el('th', {}, v),
            m[i].map((c, j) => el('td', { class: c ? (c.blocked ? 'cell blocked' : 'cell on') : (i === j ? 'cell diag' : 'cell') },
              c ? (g.weighted ? fmt(c.w) : '1') : (i === j ? '·' : '0')))))),
        ),
        el('p', { class: 'mem-caption' }, 'Visão derivada: o grafo é armazenado em lista de adjacência; a matriz é calculada só para comparação.'));
    } else {
      body = el('div', { class: 'adj-list' },
        el('div', { class: 'adj-legend' }, 'vetor de cabeças', el('span', {}, '→'), 'nós encadeados ', el('code', {}, '[destino | peso]')),
        [...g.adj.entries()].map(([v, list], idx) => el('div', { class: 'adj-row', 'data-vertex': v },
          el('div', { class: 'adj-head' }, el('small', {}, idx), el('b', {}, v)),
          ...list.flatMap(({ to, edge }) => [
            el('span', { class: 'adj-arrow' }, '→'),
            el('div', { class: `adj-node${edge.blocked ? ' blocked' : ''}`, title: `via #${edge.id}${edge.blocked ? ' (interditada)' : ''}` },
              el('b', {}, to), g.weighted ? el('em', {}, fmt(edge.w)) : null, el('small', {}, `#${edge.id}`)),
          ]),
          el('span', { class: 'adj-arrow' }, list.length ? '→' : ''),
          el('span', { class: 'adj-null' }, '∅'))));
    }

    const why = el('div', { class: 'why' },
      el('h4', {}, 'Por que lista de adjacência neste cenário?'),
      el('ul', {},
        el('li', {}, `Cidades são grafos esparsos: aqui ${E} via(s) ocupam ${used} nó(s) contra ${cells} células de uma matriz (${density.toFixed(1)}%).`),
        el('li', {}, 'Espaço O(V + E) contra O(V²) da matriz; BFS/DFS/Dijkstra percorrem só vizinhos reais: O(V + E).'),
        el('li', {}, 'Contrapartida: consultar "existe a via u–v?" custa O(grau(u)) em vez de O(1) — irrelevante para os algoritmos pedidos.')));

    return el('div', {}, stats, body, why);
  }

  function highlightMemory(container, vertex) {
    container.querySelectorAll('[data-vertex]').forEach((n) => n.classList.toggle('active', n.dataset.vertex === vertex));
  }

  Object.assign(root.SmartNet, { renderResult, renderMemory, highlightMemory, badge });
})(typeof window !== 'undefined' ? window : globalThis);
