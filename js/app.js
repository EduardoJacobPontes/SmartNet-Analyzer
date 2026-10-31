/*
 * app.js — controlador da interface: formulários, player passo a passo, mapa e memória.
 */
(function () {
  'use strict';
  const S = window.SmartNet;
  const { el, mount, clear, Graph, GraphError, MapView, fmt } = S;
  const $ = (id) => document.getElementById(id);

  const ALGOS = {
    dfs: {
      name: 'DFS', title: 'Busca em Profundidade', icon: 'i-dfs', theme: 'Auditoria de rotas',
      desc: 'Percorre a malha viária até o fim de cada caminho antes de voltar. Revela conectividade geral, ilhas isoladas, ciclos e becos sem saída.',
      source: true, order: true, run: (g, p) => S.dfs(g, p.source, { order: p.order }), cx: 'O(V+E)',
    },
    bfs: {
      name: 'BFS', title: 'Busca em Largura', icon: 'i-bfs', theme: 'Onda de alerta',
      desc: 'Simula a propagação de um alerta de emergência ou sinal de rádio: a onda avança nível a nível e alcança primeiro os bairros com menos saltos.',
      source: true, order: true, run: (g, p) => S.bfs(g, p.source, { order: p.order }), cx: 'O(V+E)',
    },
    dijkstra: {
      name: 'Dijkstra', title: 'Dijkstra', icon: 'i-dijkstra', theme: 'Rota de emergência',
      desc: 'Menor tempo de ambulâncias e bombeiros da origem até todos os bairros. Escolha um destino para destacar a rota e despachar a viatura.',
      source: true, target: true, run: (g, p) => S.dijkstra(g, p.source, { target: p.target || null }), cx: 'O((V+E)log V)',
    },
    kruskal: {
      name: 'Kruskal', title: 'Kruskal (MST)', icon: 'i-kruskal', theme: 'Fibra óptica',
      desc: 'Rede de fibra de menor custo que interliga todos os bairros sem redundâncias caras: árvore geradora mínima.',
      run: (g) => S.kruskal(g), cx: 'O(E log E)',
    },
    resilience: {
      name: 'Resiliência', title: 'Análise de resiliência', icon: 'i-shield', theme: 'Pontos de falha',
      desc: 'Extra: encontra bairros e vias cuja falha isola parte da cidade (pontos de articulação e pontes, algoritmo de Tarjan). Combine com “Interditar vias”.',
      run: (g) => S.resilience(g), cx: 'O(V+E)',
    },
  };

  const state = {
    graph: new Graph({ directed: false, weighted: true }),
    algo: 'dfs',
    mode: 'source',          // o que o clique faz no mapa
    memMode: 'list',
    run: null,               // { res, idx, timer, playing, algo, params }
    runCount: 0,
    textDirty: false,
  };

  /* ---------- feedback ---------- */
  function toast(msg, kind = 'info') {
    const t = el('div', { class: `toast toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, msg);
    $('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, kind === 'error' ? 5200 : 3200);
  }
  function setFeedback(node, msg, kind) {
    node.textContent = msg || '';
    node.className = `feedback ${kind || ''}`;
  }
  const guard = (fn) => (...a) => {
    try { return fn(...a); } catch (err) {
      if (err instanceof GraphError) toast(err.message, 'error');
      else { console.error(err); toast(`Erro inesperado: ${err.message}`, 'error'); }
      return undefined;
    }
  };

  /* ---------- mapa ---------- */
  const view = new MapView($('map'), {
    onNodeClick: (v) => {
      if (state.mode === 'target') { $('selTarget').value = v; endpointsPicked(); }
      else if (state.mode === 'source') { $('selSource').value = v; endpointsPicked(); }
    },
    onEdgeClick: guard((e) => {
      if (state.mode !== 'block') return;
      state.graph.setBlocked(e.id, !e.blocked);
      toast(`Via ${e.u}${state.graph.directed ? '→' : '–'}${e.v} ${e.blocked ? 'interditada' : 'liberada'}.`, e.blocked ? 'warn' : 'ok');
      blockChanged();
    }),
  });

  function onEndpointsChanged() {
    view.setEndpoints($('selSource').value || null, $('selTarget').value || null);
  }
  function endpointsPicked() {
    onEndpointsChanged();
    if (state.run) clearRun();
  }

  /* ---------- renderização geral ---------- */
  function fillSelect(sel, values, blankLabel) {
    const prev = sel.value;
    clear(sel);
    if (blankLabel) sel.appendChild(el('option', { value: '' }, blankLabel));
    values.forEach((v) => sel.appendChild(el('option', { value: v }, v)));
    if (values.includes(prev)) sel.value = prev;
    else sel.value = blankLabel ? '' : (values[0] || '');
  }

  function renderLists() {
    const g = state.graph;
    $('countV').textContent = g.vertexCount;
    $('countE').textContent = g.edgeCount;
    mount($('dlVerts'), g.vertices().map((v) => el('option', { value: v })));

    mount($('vertexChips'),
      g.vertexCount
        ? g.vertices().map((v) => el('span', { class: 'vchip' }, v,
          el('button', { type: 'button', 'aria-label': `Remover bairro ${v}`, title: 'Remover bairro e suas vias', onclick: guard(() => { g.removeVertex(v); structureChanged(); }) }, '×')))
        : el('span', { class: 'muted-text' }, 'Nenhum bairro cadastrado.'));

    mount($('edgeList'),
      g.edgeCount
        ? g.edges.map((e) => el('div', { class: `edge-row${e.blocked ? ' is-blocked' : ''}` },
          el('span', { class: 'edge-name' }, `${e.u} ${g.directed ? '→' : '–'} ${e.v}`),
          g.weighted
            ? el('input', {
              class: 'edge-w', type: 'text', inputmode: 'decimal', value: fmt(e.w), 'aria-label': `Peso da via ${e.u} ${e.v}`,
              onchange: (ev) => {
                try { g.addEdge(e.u, e.v, ev.target.value); structureChanged(); } catch (err) {
                  if (!(err instanceof GraphError)) throw err;
                  toast(err.message, 'error'); ev.target.value = fmt(e.w);
                }
              },
            })
            : null,
          el('button', {
            class: 'icon-sm', type: 'button', 'aria-pressed': String(e.blocked), title: e.blocked ? 'Liberar via' : 'Interditar via', 'aria-label': e.blocked ? 'Liberar via' : 'Interditar via',
            onclick: guard(() => { g.setBlocked(e.id, !e.blocked); blockChanged(); }),
          }, e.blocked ? '⛔' : '🚧'),
          el('button', { class: 'icon-sm', type: 'button', title: 'Remover via', 'aria-label': 'Remover via', onclick: guard(() => { g.removeEdge(e.id); structureChanged(); }) }, '×')))
        : el('span', { class: 'muted-text' }, 'Nenhuma via cadastrada.'));

    $('inWeight').disabled = !g.weighted;
    $('inWeight').placeholder = g.weighted ? '1' : '—';
    document.querySelectorAll('[data-directed]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.directed === 'true') === g.directed)));
    document.querySelectorAll('[data-weighted]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.weighted === 'true') === g.weighted)));
    if (!state.textDirty && !$('pane-text').hidden) $('graphText').value = g.toText();
  }

  function renderStatus() {
    const g = state.graph;
    const comps = S.components(S.undirectedView(g)).length;
    const blocked = g.edges.filter((e) => e.blocked).length;
    mount($('statusbar'),
      S.badge(g.directed ? 'Direcionado' : 'Não-direcionado', 'info'),
      S.badge(g.weighted ? 'Com pesos' : 'Sem pesos', 'info'),
      S.badge(`${g.vertexCount} bairro${g.vertexCount === 1 ? '' : 's'}`),
      S.badge(`${g.edgeCount} via${g.edgeCount === 1 ? '' : 's'}`),
      g.vertexCount ? (comps === 1 ? S.badge('Rede conexa', 'ok') : S.badge(`${comps} ilhas desconectadas`, 'warn')) : S.badge('Grafo vazio', 'neutral'),
      blocked ? S.badge(`${blocked} via${blocked === 1 ? '' : 's'} interditada${blocked === 1 ? '' : 's'}`, 'bad') : null);
  }

  function renderMemory() {
    mount($('memoryBody'), S.renderMemory(state.graph, state.memMode));
    S.highlightMemory($('memoryBody'), currentStep() ? currentStep().current : null);
  }

  function updateMapChrome() {
    $('mapEmpty').hidden = state.graph.vertexCount > 0;
    const hints = {
      source: 'Clique em um bairro para defini-lo como origem.',
      target: 'Clique em um bairro para defini-lo como destino (usado no Dijkstra).',
      block: 'Clique em uma via para interditá-la ou liberá-la. Os algoritmos recalculam na hora.',
    };
    $('mapHint').textContent = hints[state.mode];
    view.setEdgeMode(state.mode === 'block');
  }

  function refresh() {
    view.render();
    fillSelect($('selSource'), state.graph.vertices());
    fillSelect($('selTarget'), state.graph.vertices(), '— todos os bairros —');
    onEndpointsChanged();
    renderLists();
    renderStatus();
    renderMemory();
    updateMapChrome();
  }

  /* ---------- ciclo de vida do grafo ---------- */
  function structureChanged() {
    clearRun();
    refresh();
  }

  function blockChanged() {
    const hadRun = state.run && state.run.res.ok;
    refresh();
    if (hadRun) runAlgorithm({ replay: false, keepAlgo: true });
    else clearRun();
  }

  function loadGraph(graph, positions, { source, target } = {}) {
    state.graph = graph;
    clearRun();
    view.setGraph(graph, positions);
    state.textDirty = false;
    refresh();
    if (source) $('selSource').value = source;
    if (target) $('selTarget').value = target;
    onEndpointsChanged();
  }

  function loadPreset(key) {
    const p = S.buildPreset(key);
    const tgt = key === 'professor' ? { source: 'O', target: 'T' } : { source: 'Hospital', target: 'Aeroporto' };
    loadGraph(p.graph, p.positions, tgt);
    toast(`${p.name} carregado: ${p.graph.vertexCount} bairros, ${p.graph.edgeCount} vias.`, 'ok');
  }

  /* ---------- formulários ---------- */
  $('formVertex').addEventListener('submit', guard((ev) => {
    ev.preventDefault();
    const names = $('inVertex').value.split(/[\s,;]+/).filter(Boolean);
    if (!names.length) { setFeedback($('feedbackForm'), 'Digite o nome de um bairro.', 'err'); return; }
    let added = 0;
    const errors = [];
    names.forEach((n) => { try { if (state.graph.addVertex(n)) added++; else errors.push(`"${n}" já existe`); } catch (e) { errors.push(e.message); } });
    if (added) { $('inVertex').value = ''; structureChanged(); }
    setFeedback($('feedbackForm'), errors.length ? errors.join(' · ') : `${added} bairro(s) adicionado(s).`, errors.length && !added ? 'err' : 'ok');
  }));

  $('formEdge').addEventListener('submit', guard((ev) => {
    ev.preventDefault();
    try {
      const { created, edge } = state.graph.addEdge($('inFrom').value, $('inTo').value, $('inWeight').value);
      structureChanged();
      setFeedback($('feedbackForm'), `Via ${edge.u}${state.graph.directed ? '→' : '–'}${edge.v} ${created ? 'criada' : 'já existia: peso atualizado'}.`, 'ok');
      $('inFrom').value = ''; $('inTo').value = '';
      $('inFrom').focus();
    } catch (e) {
      if (!(e instanceof GraphError)) throw e;
      setFeedback($('feedbackForm'), e.message, 'err');
    }
  }));

  document.querySelectorAll('[data-directed]').forEach((b) => b.addEventListener('click', guard(() => {
    const want = b.dataset.directed === 'true';
    if (want === state.graph.directed) return;
    const merged = state.graph.setDirected(want);
    structureChanged();
    if (merged) toast(`${merged} via(s) de mão dupla foram fundidas (menor peso mantido).`, 'warn');
  })));
  document.querySelectorAll('[data-weighted]').forEach((b) => b.addEventListener('click', guard(() => {
    const want = b.dataset.weighted === 'true';
    if (want === state.graph.weighted) return;
    state.graph.setWeighted(want);
    structureChanged();
    if (!want) toast('Sem pesos: todas as vias valem 1 (os pesos cadastrados são preservados).', 'info');
  })));

  /* abas */
  function selectTab(which) {
    const text = which === 'text';
    $('tab-form').setAttribute('aria-selected', String(!text));
    $('tab-text').setAttribute('aria-selected', String(text));
    $('pane-form').hidden = text;
    $('pane-text').hidden = !text;
    if (text && !state.textDirty) $('graphText').value = state.graph.toText();
  }
  $('tab-form').addEventListener('click', () => selectTab('form'));
  $('tab-text').addEventListener('click', () => selectTab('text'));
  $('graphText').addEventListener('input', () => { state.textDirty = true; });

  function applyText(text, origin = 'texto') {
    const out = $('textFeedback');
    const r = S.parseGraphText(text, { directed: state.graph.directed, weighted: state.graph.weighted });
    mount(out,
      r.errors.map((m) => el('li', { class: 'err' }, m)),
      r.warnings.map((m) => el('li', { class: 'warn' }, m)));
    if (!r.ok) { toast(`Não foi possível ler o ${origin}: ${r.errors.length} erro(s).`, 'error'); return false; }
    loadGraph(r.graph);
    mount(out, r.warnings.map((m) => el('li', { class: 'warn' }, m)), el('li', { class: 'ok' }, `Grafo aplicado: ${r.graph.vertexCount} bairros, ${r.graph.edgeCount} vias.`));
    toast(`Grafo carregado do ${origin}.`, 'ok');
    return true;
  }
  $('btnApplyText').addEventListener('click', guard(() => { if (applyText($('graphText').value)) state.textDirty = false; }));
  $('btnSyncText').addEventListener('click', () => { state.textDirty = false; $('graphText').value = state.graph.toText(); mount($('textFeedback')); });
  $('fileInput').addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) { toast('Arquivo muito grande (máx. 1 MB).', 'error'); return; }
    const reader = new FileReader();
    reader.onerror = () => toast('Não foi possível ler o arquivo.', 'error');
    reader.onload = guard(() => {
      $('graphText').value = String(reader.result);
      state.textDirty = true;
      if (applyText(String(reader.result), `arquivo "${file.name}"`)) state.textDirty = false;
    });
    reader.readAsText(file);
  });
  $('btnDownload').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([state.graph.toText() + '\n'], { type: 'text/plain;charset=utf-8' }));
    const a = el('a', { href: url, download: 'grafo-smartnet.txt' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ---------- barra superior ---------- */
  $('btnPresetProf').addEventListener('click', guard(() => loadPreset('professor')));
  $('btnEmptyPreset').addEventListener('click', guard(() => loadPreset('professor')));
  $('btnPresetCity').addEventListener('click', guard(() => loadPreset('cidade')));
  $('btnClear').addEventListener('click', guard(() => {
    state.graph.clear();
    state.textDirty = false;
    structureChanged();
    $('graphText').value = '';
    toast('Grafo apagado. Cadastre um novo mapa.', 'info');
  }));
  $('btnRelayout').addEventListener('click', () => { view.relayout(); });

  $('btnFinish').addEventListener('click', () => {
    clearRun();
    state.graph = new Graph({ directed: false, weighted: true });
    view.setGraph(state.graph);
    state.textDirty = false;
    refresh();
    $('graphText').value = '';
    mount($('textFeedback'));
    $('endSummary').textContent = `Sessão encerrada: ${state.runCount} execução(ões) de algoritmos realizadas. O grafo foi apagado da memória.`;
    state.runCount = 0;
    $('endOverlay').hidden = false;
    $('btnRestart').focus();
  });
  $('btnRestart').addEventListener('click', () => { $('endOverlay').hidden = true; $('btnPresetProf').focus(); });

  /* modo do clique no mapa / visão da memória */
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    updateMapChrome();
  }));
  document.querySelectorAll('[data-mem]').forEach((b) => b.addEventListener('click', () => {
    state.memMode = b.dataset.mem;
    document.querySelectorAll('[data-mem]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderMemory();
  }));

  /* ---------- seleção de algoritmo ---------- */
  function renderAlgoCards() {
    mount($('algoCards'), Object.entries(ALGOS).map(([key, a]) => el('button', {
      class: `algo-card${key === state.algo ? ' active' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(key === state.algo),
      onclick: () => selectAlgo(key),
    },
    el('svg:svg', { class: 'algo-icon', 'aria-hidden': 'true' }, el('svg:use', { href: `#${a.icon}` })),
    el('span', { class: 'algo-theme' }, a.theme),
    el('strong', {}, a.name),
    el('code', {}, a.cx))));
  }

  function selectAlgo(key) {
    state.algo = key;
    const a = ALGOS[key];
    renderAlgoCards();
    $('algoDesc').textContent = `${a.title}. ${a.desc}`;
    $('fldSource').hidden = !a.source;
    $('fldTarget').hidden = !a.target;
    $('fldOrder').hidden = !a.order;
    $('btnRun').textContent = `Executar ${a.name}`;
    updateDispatch();
  }

  /* ---------- execução ---------- */
  function currentStep() { return state.run && state.run.res.ok ? state.run.res.steps[state.run.idx] || null : null; }

  function clearRun() {
    if (state.run && state.run.timer) clearTimeout(state.run.timer);
    state.run = null;
    view.stopVehicle();
    view.applyState({});
    mount($('resultBody'), S.emptyResult());
    $('resSub').textContent = 'Aguardando execução.';
    $('stepMsg').textContent = 'Escolha um algoritmo e execute para acompanhar o carro passo a passo.';
    mount($('stepAux'));
    mount($('stepLog'));
    $('stepCount').textContent = 'Passo –';
    $('progressBar').style.width = '0%';
    updatePlayer();
    updateDispatch();
    S.highlightMemory($('memoryBody'), null);
  }

  function runAlgorithm({ replay = true, keepAlgo = false } = {}) {
    const g = state.graph;
    const prev = state.run;
    const key = keepAlgo && prev ? prev.algo : state.algo;
    if (!g.vertexCount) { toast('O grafo está vazio: cadastre bairros ou carregue um exemplo.', 'error'); return; }
    const a = ALGOS[key];
    const params = {
      source: $('selSource').value,
      target: $('selTarget').value,
      order: $('selOrder').value,
    };
    let res;
    try { res = a.run(g, params); } catch (err) {
      console.error(err);
      res = { ok: false, algo: key, error: `Falha inesperada ao executar ${a.name}: ${err.message}`, steps: [] };
    }
    if (prev && prev.timer) clearTimeout(prev.timer);
    view.stopVehicle();
    state.run = { res, idx: 0, timer: null, playing: false, algo: key, params };
    state.runCount++;
    mount($('resultBody'), S.renderResult(res, g));
    mount($('stepLog'), res.ok ? res.steps.map((st, i) => el('li', {},
      el('button', { type: 'button', onclick: () => { stopPlay(); goTo(i); } }, el('i', {}, i + 1), el('span', {}, st.msg)))) : []);
    $('resSub').textContent = res.ok ? `${a.title} · ${a.theme} · origem ${res.source ?? '—'}` : 'A execução não pôde ser concluída.';
    updateDispatch();

    if (!res.ok) {
      view.applyState({});
      $('stepMsg').textContent = res.error;
      mount($('stepAux'));
      $('stepCount').textContent = 'Passo –';
      toast(res.error, 'error');
      updatePlayer();
      return;
    }
    const auto = $('chkAuto').checked && replay && res.steps.length > 1;
    goTo(auto ? 0 : res.steps.length - 1);
    if (auto) play();
  }

  /** Botão da ambulância: só no Dijkstra; ligado quando existe uma rota até o destino. */
  function updateDispatch() {
    const btn = $('btnDispatch'), hint = $('dispatchHint');
    const isDij = state.algo === 'dijkstra';
    btn.hidden = !isDij;
    hint.hidden = !isDij;
    if (!isDij) return;
    const res = state.run && state.run.res;
    const ready = !!(res && res.ok && res.algo === 'dijkstra' && res.targetPath && res.targetPath.length > 1);
    btn.disabled = !ready || !!state.driving;
    if (ready) hint.textContent = `A ambulância vai de ${res.source} até ${res.target} pela rota mais rápida (custo ${fmt(res.targetCost)}). Aperte o botão e veja!`;
    else if (res && res.ok && !res.target) hint.textContent = 'Para mandar a ambulância, escolha um Destino aqui em cima e execute o Dijkstra de novo.';
    else if (res && res.ok && res.target && !res.targetPath) hint.textContent = 'Não existe caminho até esse destino, então a ambulância não consegue sair.';
    else hint.textContent = 'Escolha Origem e Destino, clique em Executar Dijkstra e depois mande a ambulância seguir a rota mais rápida.';
  }

  /* ---------- player ---------- */
  function goTo(i) {
    const run = state.run;
    if (!run || !run.res.ok) return;
    run.idx = Math.max(0, Math.min(run.res.steps.length - 1, i));
    const step = run.res.steps[run.idx];
    view.applyState(step);
    $('stepMsg').textContent = step.msg;
    mount($('stepAux'), step.aux.flatMap((x) => [el('dt', {}, x.label), el('dd', {}, x.value)]));
    $('stepCount').textContent = `Passo ${run.idx + 1} de ${run.res.steps.length}`;
    $('progressBar').style.width = `${((run.idx + 1) / run.res.steps.length) * 100}%`;
    S.highlightMemory($('memoryBody'), step.current);
    const log = $('stepLog');
    [...log.children].forEach((li, k) => { li.classList.toggle('active', k === run.idx); li.classList.toggle('past', k < run.idx); });
    const act = log.children[run.idx];
    if (act) { // rola só a lista (não a página)
      const top = act.offsetTop; // a lista é o offsetParent
      if (top < log.scrollTop || top + act.offsetHeight > log.scrollTop + log.clientHeight) log.scrollTop = Math.max(0, top - 40);
    }
    if (step.current) view.carTo(step.current, run.playing ? Number($('selSpeed').value) * 0.85 : 520);
    updatePlayer();
  }

  function stopPlay() {
    const run = state.run;
    if (run) { clearTimeout(run.timer); run.timer = null; run.playing = false; }
    updatePlayer();
  }

  function play() {
    const run = state.run;
    if (!run || !run.res.ok) return;
    if (run.idx >= run.res.steps.length - 1) goTo(0);
    run.playing = true;
    updatePlayer();
    const tick = () => {
      if (state.run !== run || !run.playing) return;
      if (run.idx >= run.res.steps.length - 1) { stopPlay(); return; }
      goTo(run.idx + 1);
      run.timer = setTimeout(tick, Number($('selSpeed').value));
    };
    run.timer = setTimeout(tick, Number($('selSpeed').value));
  }

  function updatePlayer() {
    const run = state.run;
    const ok = !!(run && run.res.ok);
    const last = ok ? run.res.steps.length - 1 : 0;
    $('pFirst').disabled = !ok || run.idx === 0;
    $('pPrev').disabled = !ok || run.idx === 0;
    $('pNext').disabled = !ok || run.idx >= last;
    $('pLast').disabled = !ok || run.idx >= last;
    $('pPlay').disabled = !ok;
    const playing = ok && run.playing;
    $('pPlay').querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    $('pPlay').title = playing ? 'Pausar' : 'Reproduzir';
    $('pPlay').setAttribute('aria-label', $('pPlay').title);
  }

  $('btnRun').addEventListener('click', guard(() => runAlgorithm()));
  $('pFirst').addEventListener('click', () => { stopPlay(); goTo(0); });
  $('pPrev').addEventListener('click', () => { stopPlay(); goTo(state.run.idx - 1); });
  $('pNext').addEventListener('click', () => { stopPlay(); goTo(state.run.idx + 1); });
  $('pLast').addEventListener('click', () => { stopPlay(); goTo(state.run.res.steps.length - 1); });
  $('pPlay').addEventListener('click', () => { if (state.run && state.run.playing) stopPlay(); else play(); });

  $('btnDispatch').addEventListener('click', guard(() => {
    const run = state.run;
    if (!run || !run.res.targetPath) return;
    stopPlay();
    goTo(run.res.steps.length - 1);
    state.driving = true;
    updateDispatch();
    view.placeCar(run.res.targetPath[0], { emergency: true });
    view.driveRoute(run.res.targetPath, { speed: 230, emergency: true }).then((arrived) => {
      state.driving = false;
      updateDispatch();
      if (arrived) toast(`🚑 A ambulância chegou a ${run.res.target}! Foram ${run.res.targetPath.length - 1} rua(s) e custo ${fmt(run.res.targetCost)}.`, 'ok');
    });
  }));

  // mudar origem/destino/ordem invalida o resultado exibido, mas não apaga o grafo
  ['selSource', 'selTarget'].forEach((id) => $(id).addEventListener('change', endpointsPicked));
  $('selOrder').addEventListener('change', () => { if (state.run) clearRun(); });

  /* ---------- ajuda para iniciantes ---------- */
  const HELP = [
    ['Monte a cidade', 'No quadro 1, escreva o nome de um bairro e aperte Adicionar. Depois crie uma rua: diga de qual bairro ela sai, para qual vai e quanto custa passar por ela.'],
    ['Ou use um pronto', 'Aperte "Carregar Grafo de Teste do Professor" lá em cima para ganhar uma cidade já montada.'],
    ['Olhe o mapa', 'No quadro 2 você vê a cidade de cima. Arraste os bairros para arrumar do seu jeito. Clique em um bairro para dizer de onde o carro sai.'],
    ['Escolha um desafio', 'No quadro 3, cada cartão é um desafio diferente: passear pela cidade toda (DFS), espalhar um aviso (BFS), achar o caminho mais rápido (Dijkstra), passar a internet gastando pouco (Kruskal) ou ver o que acontece se algo quebrar (Resiliência).'],
    ['Aperte Executar', 'Um carrinho passeia pelas ruas mostrando o que o computador está pensando. Use ▶ e ◀ para ir passo a passo.'],
    ['Leia a resposta', 'No quadro 4, a caixa colorida diz a resposta em uma frase. As abas mostram os detalhes se você quiser saber mais.'],
    ['Teste imprevistos', 'No mapa, escolha "Interditar vias" e clique numa rua para fechá-la, como uma obra. Tudo é recalculado na hora!'],
    ['Terminou?', 'Aperte "Finalizar aplicação" para encerrar e apagar tudo.'],
  ];
  mount($('helpSteps'), HELP.map(([t, d]) => el('li', {}, el('strong', {}, t), el('p', {}, d))));
  const openHelp = () => { $('helpOverlay').hidden = false; $('btnHelpOk').focus(); };
  const closeHelp = () => { $('helpOverlay').hidden = true; $('btnHelp').focus(); };
  $('btnHelp').addEventListener('click', openHelp);
  $('btnHelpOk').addEventListener('click', closeHelp);
  $('btnHelpClose').addEventListener('click', closeHelp);
  $('helpOverlay').addEventListener('click', (e) => { if (e.target === $('helpOverlay')) closeHelp(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('helpOverlay').hidden) closeHelp(); });

  /* ---------- horizonte do rodapé ---------- */
  (function skyline() {
    const svg = $('skyline');
    let seed = 42;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let x = -10;
    while (x < 1210) {
      const w = 22 + rnd() * 34, h = 18 + rnd() * 54;
      svg.appendChild(el('svg:rect', { class: 'sky-b', x, y: 90 - h, width: w, height: h, rx: 1.5 }));
      for (let wy = 90 - h + 6; wy < 84; wy += 9) for (let wx = x + 5; wx < x + w - 6; wx += 8) {
        if (rnd() < 0.34) svg.appendChild(el('svg:rect', { class: 'sky-w', x: wx, y: wy, width: 3.2, height: 4.2, opacity: (0.35 + rnd() * 0.65).toFixed(2) }));
      }
      x += w + 2 + rnd() * 8;
      if (rnd() < 0.3) { // uma árvore entre os prédios
        const r = 6 + rnd() * 5;
        svg.appendChild(el('svg:circle', { class: 'sky-t', cx: x + r, cy: 90 - r, r }));
        x += r * 2 + 4;
      }
    }
  })();

  /* ---------- início ---------- */
  renderAlgoCards();
  selectAlgo('dfs');
  clearRun();
  view.setGraph(state.graph);
  refresh();
  loadPreset('professor');
  // o toast do carregamento inicial não deve aparecer como se o usuário tivesse clicado
  $('toasts').innerHTML = '';
})();
