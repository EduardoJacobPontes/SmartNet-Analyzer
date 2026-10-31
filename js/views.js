/*
 * views.js — resultados dos algoritmos (veredito + abas) e "visão da memória".
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
  const kpis = (...items) => el('div', { class: 'kpis' }, items);
  const chips = (list) => el('div', { class: 'chips' }, list.map((v, i) => el('span', { class: 'chip' }, el('i', {}, i + 1), v)));
  const note = (text, kind = 'info') => el('div', { class: `note note-${kind}` }, text);
  const section = (title, hint, ...body) => el('section', { class: 'rblock' },
    el('h4', {}, title), hint ? el('p', { class: 'hint' }, hint) : null, body);

  /** Cartão de veredito: a resposta em uma frase, antes de qualquer tabela. */
  function verdict(kind, title, text) {
    const icon = { ok: '✔', warn: '!', bad: '✕', info: 'i' }[kind];
    return el('div', { class: `verdict verdict-${kind}` },
      el('span', { class: 'verdict-icon', 'aria-hidden': 'true' }, icon),
      el('div', {}, el('strong', {}, title), el('p', {}, text)));
  }

  /** Rota "O › A › B" em etiquetas. */
  const route = (path) => el('div', { class: 'route' },
    path.flatMap((v, i) => [i ? el('span', { class: 'route-sep' }, '›') : null, el('span', { class: 'route-stop' }, v)]));

  /** Abas simples e acessíveis. items: [{ label, node }] */
  function tabs(items) {
    const bar = el('div', { class: 'rtabs', role: 'tablist' });
    const panes = [];
    const btns = [];
    items.forEach((it, i) => {
      const pane = el('div', { class: 'rpane', role: 'tabpanel', hidden: i !== 0 }, it.node);
      const btn = el('button', { type: 'button', role: 'tab', 'aria-selected': String(i === 0) }, it.label);
      btn.addEventListener('click', () => {
        btns.forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); panes[j].hidden = j !== i; });
      });
      btns.push(btn); panes.push(pane); bar.appendChild(btn);
    });
    return el('div', { class: 'rtabs-wrap' }, bar, panes);
  }

  function complexity(c) {
    return el('div', { class: 'complexity' },
      el('div', {}, el('span', { class: 'cx-label' }, 'Tempo'), el('code', {}, c.time)),
      el('div', {}, el('span', { class: 'cx-label' }, 'Espaço'), el('code', {}, c.space)),
      el('p', {}, c.why));
  }

  /* ---------- DFS ---------- */
  function renderDfs(r, g) {
    const kinds = r.kinds.filter((k) => k.kind !== 'árvore');
    const allReached = !r.unreachable.length;

    const v = r.connected
      ? verdict('ok', 'Rede conexa', `O carro saiu de ${r.source} e chegou a todos os ${r.visitOrder.length} bairros: qualquer bairro alcança qualquer outro.`)
      : verdict('warn', `Rede dividida em ${r.components.length} ilhas`, `Ilhas sem ligação entre si: ${r.components.map((c) => `{${c.join(', ')}}`).join(' · ')}.`);

    const resumo = el('div', { class: 'result' }, v,
      g.directed && !allReached ? note(`Respeitando o sentido das ruas, ${r.source} não alcança: ${r.unreachable.join(', ')}.`, 'warn') : null,
      kpis(
        kpi('bairros visitados', r.visitOrder.length),
        kpi(g.directed ? 'ilhas (sem contar sentido)' : 'ilhas', r.components.length, r.connected ? 'good' : 'warn'),
        kpi('becos sem saída', r.deadEnds.length, r.deadEnds.length ? 'warn' : 'good'),
        kpi('ruas em ciclo', r.hasCycle ? 'sim' : 'não')),
      section('Trajeto do carro', 'Ordem em que os bairros foram visitados.', chips(r.visitOrder)),
      section('Becos sem saída', 'Bairros onde a rua termina (sem continuação).',
        r.deadEnds.length || r.isolated.length
          ? el('ul', { class: 'plain' },
            r.deadEnds.map((d) => el('li', {}, badge(d.v, 'warn'), ' ', d.kind)),
            r.isolated.map((x) => el('li', {}, badge(x, 'bad'), ' isolado: nenhuma rua ativa chega até ele')))
          : note('Nenhum beco sem saída: todo bairro tem pelo menos duas ruas.', 'ok')),
      r.hasCycle ? note('Há ciclos: alguns bairros têm mais de um caminho entre si (redundância útil em emergências).', 'info') : null);

    const arvore = el('div', { class: 'result' },
      section(r.trees.length > 1 ? 'Floresta DFS' : 'Caminho percorrido (árvore DFS)',
        'Cada ramo é uma rua usada para descer; o carro só volta quando não há mais para onde ir.',
        r.trees.map((t) => el('pre', { class: 'tree' }, t.lines.join('\n')))),
      kinds.length ? section('Ruas que fecham ciclos', 'Arestas que não entraram na árvore.', table(['De', 'Para', 'Tipo'], kinds.map((k) => [k.from, k.to, k.kind]))) : null);

    const tempos = el('div', { class: 'result' },
      section('Relógio da busca', 'Chegada = quando o carro entrou no bairro · Saída = quando terminou de explorar tudo a partir dele.',
        table(['Bairro', 'Chegada', 'Saída', 'Veio de'], r.visitOrder.map((x) => [x, r.disc.get(x), r.fin.get(x), r.parent.get(x) ?? '—']))));

    return tabs([
      { label: 'Resumo', node: resumo }, { label: 'Árvore', node: arvore },
      { label: 'Relógio', node: tempos }, { label: 'Complexidade', node: complexity(r.complexity) }]);
  }

  /* ---------- BFS ---------- */
  function renderBfs(r) {
    const maxHop = r.levels.length - 1;
    const v = r.unreached.length
      ? verdict('warn', 'Alerta não chega a todos', `Sem alcance a partir de ${r.source}: ${r.unreached.join(', ')}.`)
      : verdict('ok', 'Alerta cobre toda a cidade', `A onda sai de ${r.source} e alcança os ${r.visitOrder.length} bairros em até ${maxHop} salto(s).`);

    const resumo = el('div', { class: 'result' }, v,
      kpis(
        kpi('bairros alcançados', r.visitOrder.length),
        kpi('saltos até o mais distante', maxHop),
        kpi('fora de alcance', r.unreached.length, r.unreached.length ? 'warn' : 'good')),
      section('Ondas de alerta', 'Cada onda é o conjunto de bairros a um salto a mais da origem.',
        el('ol', { class: 'waves' }, r.levels.map((l, i) => el('li', {},
          el('span', { class: 'wave-no' }, i === 0 ? 'origem' : `${i} salto${i > 1 ? 's' : ''}`),
          el('div', { class: 'wave-bar', style: `--n:${i}` }),
          el('div', { class: 'chips' }, l.map((x) => el('span', { class: 'chip chip-plain' }, x))))))),
      section('Ordem de visita (fila)', null, chips(r.visitOrder)));

    const fila = el('div', { class: 'result' },
      section('Registro da fila', 'A cada passo sai um bairro da frente e entram seus vizinhos novos no fim.',
        table(['Passo', 'Sai da fila', 'Entram', 'Fila depois'],
          r.log.map((l) => [l.step, l.dequeued ?? '—', l.enqueued.join(', ') || '—', l.queue.length ? `[ ${l.queue.join(', ')} ]` : '[ ]']))));

    const saltos = el('div', { class: 'result' },
      section('Menor caminho em saltos', 'Pai = bairro por onde o alerta chegou.',
        table(['Bairro', 'Saltos', 'Pai'], r.visitOrder.map((x) => [x, r.hops.get(x), r.parent.get(x) ?? '—']))));

    return tabs([
      { label: 'Resumo', node: resumo }, { label: 'Fila', node: fila },
      { label: 'Saltos', node: saltos }, { label: 'Complexidade', node: complexity(r.complexity) }]);
  }

  /* ---------- Dijkstra ---------- */
  function renderDijkstra(r) {
    const reach = r.rows.filter((x) => x.reachable);
    const max = Math.max(1, ...reach.map((x) => x.dist));
    let v;
    if (r.target && r.targetPath) v = verdict('ok', `Rota mais rápida até ${r.target}: custo ${fmt(r.targetCost)}`, `${r.targetPath.length - 1} trecho(s) saindo de ${r.source}.`);
    else if (r.target) v = verdict('bad', `Sem rota até ${r.target}`, `Não há caminho de ${r.source} até ${r.target} (vias interditadas ou bairros desconectados).`);
    else v = verdict('ok', `Menores custos a partir de ${r.source}`, `Calculado para ${reach.length} bairro(s). Escolha um destino para destacar a rota e despachar a viatura.`);

    const resumo = el('div', { class: 'result' }, v,
      r.targetPath ? section('Rota de emergência', null, route(r.targetPath)) : null,
      r.unreachable.length ? note(`Sem rota a partir de ${r.source}: ${r.unreachable.join(', ')}.`, 'warn') : null,
      kpis(
        kpi('origem', r.source),
        kpi('bairros alcançáveis', reach.length),
        r.targetPath ? kpi(`custo até ${r.target}`, fmt(r.targetCost), 'good') : kpi('inalcançáveis', r.unreachable.length, r.unreachable.length ? 'warn' : 'good')),
      section('Tempo até cada bairro', 'Barra proporcional ao custo mínimo.',
        el('ul', { class: 'bars' }, r.rows.map((x) => el('li', { class: `${!x.reachable ? 'off' : ''}${x.v === r.target ? ' hl' : ''}` },
          el('span', { class: 'bar-name' }, x.v),
          el('div', { class: 'bar-track' }, x.reachable ? el('i', { style: `width:${Math.max(2, (x.dist / max) * 100)}%` }) : null),
          el('span', { class: 'bar-val' }, x.reachable ? fmt(x.dist) : '∞'))))));

    const tabela = el('div', { class: 'result' },
      section('Distâncias mínimas e predecessores', 'Predecessor = bairro anterior na melhor rota.',
        table(['Destino', 'Distância', 'Predecessor', 'Caminho'],
          r.rows.map((x) => [x.v, x.reachable ? fmt(x.dist) : '∞', x.pred ?? '—', x.path ? x.path.join(' → ') : 'sem rota']),
          { rowClass: (i) => (!r.rows[i].reachable ? 'muted' : r.rows[i].v === r.target ? 'hl' : '') })),
      section('Ordem de fixação', 'Bairros em ordem crescente de distância.', chips(r.settleOrder)));

    return tabs([
      { label: 'Resumo', node: resumo }, { label: 'Tabela', node: tabela },
      { label: 'Complexidade', node: complexity(r.complexity) }]);
  }

  /* ---------- Kruskal ---------- */
  function renderKruskal(r, g) {
    const v = r.spanning
      ? verdict('ok', `Rede de fibra pronta: custo total ${fmt(r.total)}`, `${r.chosen.length} trecho(s) interligam todos os bairros, sem nenhuma ligação redundante.`)
      : verdict('warn', `Cidade desconexa: ${r.componentCount} redes separadas`, `Não existe fibra única; o resultado é uma floresta geradora mínima com custo ${fmt(r.total)}.`);

    const resumo = el('div', { class: 'result' }, v,
      r.treatedAsUndirected ? note('Grafo direcionado: a fibra ignora o sentido das ruas (MST vale para grafos não-direcionados).', 'info') : null,
      kpis(
        kpi('custo total', fmt(r.total), 'good'),
        kpi('trechos de fibra', r.chosen.length),
        kpi('trechos descartados', r.table.filter((t) => t.status === 'rejeitada').length)),
      section('Trechos escolhidos', 'Onde passar a fibra.',
        r.chosen.length
          ? table(['#', 'Trecho', 'Custo'], [...r.chosen.map((e, i) => [i + 1, edgeName(g, e), fmt(g.weight(e))]), ['', 'TOTAL', fmt(r.total)]],
            { rowClass: (i) => (i === r.chosen.length ? 'total' : '') })
          : note('Nenhum trecho necessário.', 'info')));

    const todas = el('div', { class: 'result' },
      section('Decisão para cada rua', 'Ruas ordenadas pelo custo; é aceita se ligar redes ainda separadas e rejeitada se formar um anel.',
        table(['Trecho', 'Custo', 'Decisão'], r.table.map((t) => [edgeName(g, t.edge), fmt(t.w),
          badge(t.status, t.status === 'aceita' ? 'ok' : t.status === 'rejeitada' ? 'bad' : 'neutral')]))));

    return tabs([
      { label: 'Resumo', node: resumo }, { label: 'Todas as ruas', node: todas },
      { label: 'Complexidade', node: complexity(r.complexity) }]);
  }

  /* ---------- Resiliência ---------- */
  function renderResilience(r, g) {
    const v = r.robust
      ? verdict('ok', 'Rede resiliente', 'Nenhuma falha isolada de bairro ou rua desconecta a cidade.')
      : verdict(r.connected ? 'warn' : 'bad', r.connected ? 'Existem pontos únicos de falha' : 'A rede já está fragmentada',
        r.connected ? 'Se um destes pontos falhar, parte da cidade fica isolada. Reforce com rotas alternativas.' : 'Os pontos críticos abaixo valem para cada ilha.');

    const resumo = el('div', { class: 'result' }, v,
      r.treatedAsUndirected ? note('Grafo direcionado: análise sem considerar o sentido das ruas.', 'info') : null,
      kpis(
        kpi('bairros críticos', r.pointRows.length, r.pointRows.length ? 'bad' : 'good'),
        kpi('ruas críticas', r.bridgeRows.length, r.bridgeRows.length ? 'bad' : 'good'),
        kpi('redes agora', r.baseline, r.connected ? 'good' : 'warn')),
      r.pointRows.length ? section('Bairros críticos', 'Destacados em rosa no mapa.', chips(r.pointRows.map((p) => p.v))) : null,
      r.bridgeRows.length ? section('Ruas críticas', 'Destacadas em rosa no mapa.', chips(r.bridgeRows.map((b) => edgeName(g, b.edge)))) : null);

    const impacto = el('div', { class: 'result' },
      section('Se um bairro falhar', 'Quantos blocos isolados restam e o tamanho de cada um.',
        r.pointRows.length ? table(['Bairro', 'Blocos', 'Tamanhos'], r.pointRows.map((p) => [badge(p.v, 'bad'), p.components, p.sizes.join(' + ')])) : note('Nenhum bairro crítico.', 'ok')),
      section('Se uma rua fechar', null,
        r.bridgeRows.length ? table(['Rua', 'Blocos', 'Tamanhos'], r.bridgeRows.map((b) => [badge(edgeName(g, b.edge), 'bad'), b.components, b.sizes.join(' + ')])) : note('Nenhuma rua crítica.', 'ok')));

    return tabs([
      { label: 'Resumo', node: resumo }, { label: 'Impacto', node: impacto },
      { label: 'Complexidade', node: complexity(r.complexity) }]);
  }

  function renderResult(r, g) {
    if (!r.ok) return el('div', { class: 'result' }, verdict('bad', 'Não foi possível executar', r.error));
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
        el('div', { class: 'adj-legend' },
          el('span', { class: 'legend-tag' }, 'Como ler'),
          'cada linha é um ', el('b', {}, 'bairro'), '; as ', el('b', { class: 'sign-word' }, 'placas verdes'),
          ' são as ruas que saem dele: ', el('code', {}, 'para onde'), ' e, no círculo, o ', el('code', {}, 'custo'), '.'),
        [...g.adj.entries()].map(([v, list], idx) => el('div', { class: 'adj-row', 'data-vertex': v },
          el('div', { class: 'adj-head', title: `Posição ${idx} do vetor de listas` }, el('small', {}, idx), el('b', {}, v)),
          ...list.flatMap(({ to, edge }) => [
            el('span', { class: 'adj-road', 'aria-hidden': 'true' }),
            el('div', { class: `adj-node${edge.blocked ? ' blocked' : ''}`, title: `rua #${edge.id}${edge.blocked ? ' (interditada)' : ''}` },
              el('b', {}, to), g.weighted ? el('em', {}, fmt(edge.w)) : null, el('small', {}, `#${edge.id}`)),
          ]),
          el('span', { class: 'adj-road', 'aria-hidden': 'true' }),
          el('span', { class: 'adj-end', title: 'fim da lista (ponteiro nulo)' }, '∅'))));
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

  /** Estado vazio ilustrado: uma estradinha com o carro esperando. */
  function emptyResult() {
    const svg = document.createElementNS(root.SmartNet.SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 220 70');
    svg.setAttribute('class', 'empty-art');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path d="M10 48 C60 48 70 22 110 22 S170 48 210 48" fill="none" stroke="#5c616d" stroke-width="15" stroke-linecap="round"/>' +
      '<path d="M10 48 C60 48 70 22 110 22 S170 48 210 48" fill="none" stroke="#23262c" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M10 48 C60 48 70 22 110 22 S170 48 210 48" fill="none" stroke="#f5b82e" stroke-width="1.6" stroke-dasharray="6 6" stroke-linecap="round"/>' +
      '<circle cx="14" cy="48" r="9" fill="#1b1d22" stroke="#f4f1e8" stroke-width="2.5"/><circle cx="206" cy="48" r="9" fill="#1b1d22" stroke="#f4f1e8" stroke-width="2.5"/>' +
      '<g transform="translate(66 34) rotate(-28)"><rect x="-12" y="-6" width="24" height="12" rx="4" fill="#f5b82e" stroke="#7a5200" stroke-width="1"/><rect x="2" y="-4.5" width="6" height="9" rx="1.5" fill="#1b2430"/><circle cx="11" cy="-3.5" r="1.6" fill="#fff6c4"/><circle cx="11" cy="3.5" r="1.6" fill="#fff6c4"/></g>';
    return el('div', { class: 'empty-result' }, svg,
      el('strong', {}, 'Nenhum resultado ainda'),
      el('p', {}, 'Escolha um algoritmo no passo ', el('b', {}, '3'), ' e clique em ', el('b', {}, 'Executar'), '. O carro vai passear pela cidade e o resultado aparece aqui.'));
  }

  Object.assign(root.SmartNet, { renderResult, renderMemory, highlightMemory, badge, emptyResult });
})(typeof window !== 'undefined' ? window : globalThis);
