/*
 * mapview.js — mapa SVG da cidade: bairros (vértices) e vias (arestas).
 *  - arrastar bairros, layout automático (força), vias curvas para mão dupla em grafos direcionados
 *  - estados visuais vindos dos algoritmos (visitado, atual, MST, rota…)
 *  - carro que percorre as ruas (acompanha os algoritmos e despacha rotas de emergência)
 */
(function (root) {
  'use strict';
  const { el, clear } = root.SmartNet;

  const W = 1000, H = 640, R = 24, MARGIN = 48;
  const NODE_STATES = ['current', 'visited', 'frontier', 'done', 'critical'];
  const EDGE_STATES = ['tree', 'considered', 'rejected', 'mst', 'path', 'back', 'critical'];

  class MapView {
    constructor(svg, handlers = {}) {
      this.svg = svg;
      this.h = handlers;
      this.graph = null;
      this.pos = new Map();
      this.nodeEls = new Map();
      this.edgeEls = new Map();
      this.source = null;
      this.target = null;
      this.drag = null;
      this.car = null;
      this._seed = 7;

      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      this.gEdges = el('svg:g', { class: 'layer-edges' });
      this.gNodes = el('svg:g', { class: 'layer-nodes' });
      this.gFx = el('svg:g', { class: 'layer-fx' });
      const defs = el('svg:defs', {},
        el('svg:linearGradient', { id: 'beamGrad', x1: 0, y1: 0, x2: 1, y2: 0 },
          el('svg:stop', { offset: '0', 'stop-color': '#fff3b0', 'stop-opacity': '.6' }),
          el('svg:stop', { offset: '1', 'stop-color': '#fff3b0', 'stop-opacity': '0' })));
      svg.append(defs, this.gEdges, this.gNodes, this.gFx);

      svg.addEventListener('pointermove', (e) => this._onMove(e));
      svg.addEventListener('pointerup', (e) => this._onUp(e));
      svg.addEventListener('pointercancel', (e) => this._onUp(e));
    }

    /* ---------- dados ---------- */
    setGraph(graph, positions = null) {
      this.graph = graph;
      this.stopVehicle();
      this.pos.clear();
      if (positions) for (const [k, [x, y]] of Object.entries(positions)) if (graph.hasVertex(k)) this.pos.set(k, { x, y });
      this.syncPositions(true);
      this.render();
    }

    /** Garante posição para todo vértice e descarta as de vértices removidos. */
    syncPositions(initialLayout = false) {
      const verts = this.graph.vertices();
      for (const k of [...this.pos.keys()]) if (!this.graph.hasVertex(k)) this.pos.delete(k);
      const fresh = verts.filter((v) => !this.pos.has(v));
      if (!fresh.length) return;
      if (initialLayout && fresh.length === verts.length) {
        // círculo inicial + relaxamento por forças
        const n = verts.length;
        verts.forEach((v, i) => {
          const a = (2 * Math.PI * i) / n - Math.PI / 2;
          this.pos.set(v, { x: W / 2 + Math.cos(a) * W * 0.34, y: H / 2 + Math.sin(a) * H * 0.34 });
        });
        this._force(new Set(verts), n > 2 ? 200 : 0);
      } else {
        fresh.forEach((v) => this.pos.set(v, { x: W / 2 + (this._rand() - 0.5) * 260, y: H / 2 + (this._rand() - 0.5) * 200 }));
        this._force(new Set(fresh), 160);
      }
    }

    relayout() {
      const verts = this.graph.vertices();
      verts.forEach((v, i) => {
        const a = (2 * Math.PI * i) / verts.length - Math.PI / 2;
        this.pos.set(v, { x: W / 2 + Math.cos(a) * W * 0.34, y: H / 2 + Math.sin(a) * H * 0.34 });
      });
      this._force(new Set(verts), 260);
      this.updateGeometry();
    }

    _rand() { this._seed = (this._seed * 16807) % 2147483647; return this._seed / 2147483647; }

    /** Fruchterman–Reingold; só os vértices em `mobile` se movem. */
    _force(mobile, iterations) {
      const names = this.graph.vertices();
      const n = names.length;
      if (n < 2 || !iterations) return;
      const k = Math.sqrt((W * H) / n) * 0.62;
      let t = W / 9;
      const edges = this.graph.edges;
      for (let it = 0; it < iterations; it++) {
        const disp = new Map(names.map((v) => [v, { x: 0, y: 0 }]));
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const a = this.pos.get(names[i]), b = this.pos.get(names[j]);
            let dx = a.x - b.x, dy = a.y - b.y;
            let d = Math.hypot(dx, dy);
            if (d < 0.01) { dx = this._rand() - 0.5; dy = this._rand() - 0.5; d = 0.5; }
            const f = (k * k) / d / d;
            disp.get(names[i]).x += dx * f; disp.get(names[i]).y += dy * f;
            disp.get(names[j]).x -= dx * f; disp.get(names[j]).y -= dy * f;
          }
        }
        for (const e of edges) {
          const a = this.pos.get(e.u), b = this.pos.get(e.v);
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.max(Math.hypot(dx, dy), 0.01);
          const f = d / k;
          disp.get(e.u).x -= dx * f; disp.get(e.u).y -= dy * f;
          disp.get(e.v).x += dx * f; disp.get(e.v).y += dy * f;
        }
        for (const v of names) {
          if (!mobile.has(v)) continue;
          const d = disp.get(v), len = Math.max(Math.hypot(d.x, d.y), 0.01), p = this.pos.get(v);
          p.x = Math.min(W - MARGIN, Math.max(MARGIN, p.x + (d.x / len) * Math.min(len, t)));
          p.y = Math.min(H - MARGIN - 14, Math.max(MARGIN, p.y + (d.y / len) * Math.min(len, t)));
        }
        t *= 0.985;
      }
    }

    /* ---------- desenho ---------- */
    render() {
      this.stopVehicle();
      clear(this.gEdges); clear(this.gNodes); clear(this.gFx);
      this.nodeEls.clear(); this.edgeEls.clear();
      const g = this.graph;
      if (!g) return;
      this.syncPositions();
      if (this.source && !g.hasVertex(this.source)) this.source = null;
      if (this.target && !g.hasVertex(this.target)) this.target = null;

      for (const e of g.edges) {
        const hit = el('svg:path', { class: 'edge-hit' });
        const outline = el('svg:path', { class: 'road-curb' });
        const asphalt = el('svg:path', { class: 'road-asphalt' });
        const line = el('svg:path', { class: 'edge-line' });
        const arrow = g.directed ? el('svg:polygon', { class: 'edge-arrow' }) : null;
        const bg = g.weighted ? el('svg:rect', { class: 'edge-label-bg', rx: 7, height: 18 }) : null;
        const txt = g.weighted ? el('svg:text', { class: 'edge-label', 'text-anchor': 'middle' }) : null;
        const title = el('svg:title');
        const grp = el('svg:g', { class: 'edge', 'data-id': e.id }, title, outline, asphalt, line, hit, arrow, bg, txt);
        grp.addEventListener('click', () => this.h.onEdgeClick && this.h.onEdgeClick(e));
        this.gEdges.appendChild(grp);
        this.edgeEls.set(e.id, { grp, hit, outline, asphalt, line, arrow, bg, txt, title, e });
      }

      for (const v of g.vertices()) {
        const long = v.length > 3;
        const ring = el('svg:circle', { class: 'node-ring', r: R + 8 });
        const circle = el('svg:circle', { class: 'node-body', r: R });
        const inner = el('svg:text', { class: 'node-text', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, long ? v[0].toUpperCase() : v);
        const name = long ? el('svg:text', { class: 'node-name', 'text-anchor': 'middle', y: R + 17 }, v) : null;
        const badge = el('svg:text', { class: 'node-badge', 'text-anchor': 'middle', y: -R - 10 });
        const grp = el('svg:g', { class: 'node', tabindex: 0, role: 'button', 'aria-label': `Bairro ${v}` }, ring, circle, inner, name, badge);
        grp.addEventListener('pointerdown', (ev) => this._onDown(ev, v));
        grp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.h.onNodeClick && this.h.onNodeClick(v); } });
        this.gNodes.appendChild(grp);
        this.nodeEls.set(v, { grp, ring, badge });
      }
      this.updateGeometry();
      this.decorate();
    }

    _geom(e) {
      const a = this.pos.get(e.u), b = this.pos.get(e.v);
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.max(Math.hypot(dx, dy), 1);
      const curved = this.graph.directed && this.graph.findEdge(e.v, e.u);
      const pad = this.graph.directed ? R + 3 : R;
      let c = null;
      if (curved) c = { x: (a.x + b.x) / 2 - (dy / len) * 34, y: (a.y + b.y) / 2 + (dx / len) * 34 };
      const toward = (p, q, d) => {
        const l = Math.max(Math.hypot(q.x - p.x, q.y - p.y), 1);
        return { x: p.x + ((q.x - p.x) / l) * d, y: p.y + ((q.y - p.y) / l) * d };
      };
      const s = toward(a, c || b, R);
      const t = toward(b, c || a, pad);
      // a rua vai de centro a centro (os bairros ficam por cima); só a seta usa o ponto encurtado
      const d = c ? `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}` : `M${a.x},${a.y} L${b.x},${b.y}`;
      const mid = c
        ? { x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y }
        : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // direção da ponta da seta
      const from = c || s;
      const ang = Math.atan2(t.y - from.y, t.x - from.x);
      return { d, mid, t, ang };
    }

    updateGeometry() {
      for (const { hit, outline, asphalt, line, arrow, bg, txt, title, e } of this.edgeEls.values()) {
        const gm = this._geom(e);
        [hit, outline, asphalt, line].forEach((p) => p.setAttribute('d', gm.d));
        if (arrow) {
          const L = 11, Wd = 5.5, { t, ang } = gm;
          const p = (back, side) => `${t.x - Math.cos(ang) * back - Math.sin(ang) * side},${t.y - Math.sin(ang) * back + Math.cos(ang) * side}`;
          arrow.setAttribute('points', `${t.x + Math.cos(ang) * 3},${t.y + Math.sin(ang) * 3} ${p(L, Wd)} ${p(L, -Wd)}`);
        }
        const wText = this.graph.weight(e);
        if (txt) {
          const s = root.SmartNet.fmt(wText);
          txt.textContent = s;
          txt.setAttribute('x', gm.mid.x);
          txt.setAttribute('y', gm.mid.y + 4);
          const w = Math.max(24, s.length * 7.4 + 12);
          bg.setAttribute('width', w);
          bg.setAttribute('x', gm.mid.x - w / 2);
          bg.setAttribute('y', gm.mid.y - 9);
        }
        title.textContent = `${e.u} ${this.graph.directed ? '→' : '–'} ${e.v}${this.graph.weighted ? ` · ${root.SmartNet.fmt(e.w)}` : ''}${e.blocked ? ' · INTERDITADA' : ''}`;
      }
      for (const [v, { grp }] of this.nodeEls) {
        const p = this.pos.get(v);
        grp.setAttribute('transform', `translate(${p.x},${p.y})`);
      }
      const car = this.car;
      if (car && !car.raf && car.node && this.pos.has(car.node)) {
        const p = this.pos.get(car.node);
        car.x = p.x; car.y = p.y;
        this._paintCar();
      }
    }

    /** Aplica estado visual de um passo: { nodes:{v:cls}, edges:{id:cls} }. */
    applyState(state = {}) {
      const nodes = state.nodes || {}, edges = state.edges || {};
      for (const [v, { grp }] of this.nodeEls) {
        NODE_STATES.forEach((s) => grp.classList.remove(`s-${s}`));
        if (nodes[v]) grp.classList.add(`s-${nodes[v]}`);
        grp.classList.toggle('is-current', state.current === v);
      }
      for (const [id, { grp, e }] of this.edgeEls) {
        EDGE_STATES.forEach((s) => grp.classList.remove(`s-${s}`));
        if (edges[id]) grp.classList.add(`s-${edges[id]}`);
        grp.classList.toggle('blocked', !!e.blocked);
      }
    }

    /** Marca origem/destino e interdições (estado persistente, fora dos passos). */
    decorate() {
      for (const [v, { grp, badge }] of this.nodeEls) {
        grp.classList.toggle('is-source', v === this.source);
        grp.classList.toggle('is-target', v === this.target);
        badge.textContent = v === this.source ? 'ORIGEM' : v === this.target ? 'DESTINO' : '';
      }
      for (const { grp, e } of this.edgeEls.values()) grp.classList.toggle('blocked', !!e.blocked);
    }

    setEndpoints(source, target) {
      this.source = source; this.target = target;
      this.decorate();
    }

    setEdgeMode(on) { this.svg.classList.toggle('mode-block', !!on); }

    /* ---------- arrastar ---------- */
    _toSvg(ev) {
      const pt = this.svg.createSVGPoint();
      pt.x = ev.clientX; pt.y = ev.clientY;
      const m = this.svg.getScreenCTM();
      return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }

    _onDown(ev, v) {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault();
      const p = this._toSvg(ev), cur = this.pos.get(v);
      this.drag = { v, dx: cur.x - p.x, dy: cur.y - p.y, sx: ev.clientX, sy: ev.clientY, moved: false, id: ev.pointerId };
      try { this.svg.setPointerCapture(ev.pointerId); } catch (_) { /* navegadores sem suporte */ }
      this.nodeEls.get(v).grp.classList.add('dragging');
    }

    _onMove(ev) {
      const d = this.drag;
      if (!d || ev.pointerId !== d.id) return;
      if (!d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < 4) return;
      d.moved = true;
      const p = this._toSvg(ev);
      this.pos.set(d.v, {
        x: Math.min(W - 30, Math.max(30, p.x + d.dx)),
        y: Math.min(H - 30, Math.max(30, p.y + d.dy)),
      });
      this.updateGeometry();
    }

    _onUp(ev) {
      const d = this.drag;
      if (!d || ev.pointerId !== d.id) return;
      this.drag = null;
      const n = this.nodeEls.get(d.v);
      if (n) n.grp.classList.remove('dragging');
      try { this.svg.releasePointerCapture(ev.pointerId); } catch (_) { /* já liberado */ }
      if (!d.moved && this.h.onNodeClick) this.h.onNodeClick(d.v);
    }

    /* ---------- carro ---------- */
    _makeCar() {
      const g = el('svg:g', { class: 'car' },
        el('svg:polygon', { class: 'car-beam', points: '16,-5 66,-20 66,20 16,5' }),
        el('svg:rect', { class: 'car-shadow', x: -17, y: -7, width: 36, height: 18, rx: 6 }),
        el('svg:rect', { class: 'car-body', x: -17, y: -9, width: 34, height: 18, rx: 6 }),
        el('svg:rect', { class: 'car-glass', x: 1, y: -7, width: 9, height: 14, rx: 2.5 }),
        el('svg:rect', { class: 'car-roof', x: -9, y: -7, width: 10, height: 14, rx: 2.5 }),
        el('svg:rect', { class: 'car-glass', x: -13, y: -6, width: 3, height: 12, rx: 1.5 }),
        el('svg:circle', { class: 'car-head', cx: 16, cy: -6, r: 2.2 }),
        el('svg:circle', { class: 'car-head', cx: 16, cy: 6, r: 2.2 }),
        el('svg:rect', { class: 'car-tail', x: -18, y: -7.5, width: 2.4, height: 4.5, rx: 1 }),
        el('svg:rect', { class: 'car-tail', x: -18, y: 3, width: 2.4, height: 4.5, rx: 1 }),
        el('svg:rect', { class: 'car-siren a', x: -6, y: -7, width: 4, height: 6, rx: 1 }),
        el('svg:rect', { class: 'car-siren b', x: -6, y: 1, width: 4, height: 6, rx: 1 }));
      this.gFx.appendChild(g);
      return g;
    }

    _paintCar() {
      const c = this.car;
      if (c) c.g.setAttribute('transform', `translate(${c.x},${c.y}) rotate(${(c.angle * 180) / Math.PI})`);
    }

    /** Remove o carro e o rastro. */
    stopVehicle() {
      if (this.car) {
        cancelAnimationFrame(this.car.raf);
        const { resolve } = this.car;
        this.car = null;
        if (resolve) resolve(false);
      }
      clear(this.gFx);
    }

    /** Menor rota em número de ruas (ignora sentido e vias interditadas) — só para o carro se deslocar. */
    routeBetween(a, b) {
      if (a === b) return [a];
      const adj = root.SmartNet.undirectedView(this.graph);
      if (!adj.has(a) || !adj.has(b)) return null;
      const prev = new Map([[a, null]]);
      const q = [a];
      for (let h = 0; h < q.length; h++) {
        for (const { to } of adj.get(q[h])) {
          if (prev.has(to)) continue;
          prev.set(to, q[h]);
          if (to === b) {
            const out = [];
            for (let c = b; c !== null; c = prev.get(c)) out.push(c);
            return out.reverse();
          }
          q.push(to);
        }
      }
      return null;
    }

    /** Interrompe a perna em andamento e estaciona o carro no destino dela. */
    _settleCar() {
      const c = this.car;
      if (!c || !c.raf) return;
      cancelAnimationFrame(c.raf);
      c.raf = 0;
      const { resolve } = c;
      c.resolve = null;
      const p = c.node && this.pos.get(c.node);
      if (p) { c.x = p.x; c.y = p.y; }
      this._paintCar();
      if (resolve) resolve(false);
    }

    /** Coloca o carro (sem animar) sobre um bairro. */
    placeCar(node, { emergency = false } = {}) {
      if (!this.pos.has(node)) return;
      if (!this.car) {
        clear(this.gFx);
        this.car = { g: this._makeCar(), x: 0, y: 0, angle: -Math.PI / 2, node, raf: 0, resolve: null };
      }
      this._settleCar();
      const c = this.car, p = this.pos.get(node);
      c.x = p.x; c.y = p.y; c.node = node;
      c.g.classList.toggle('emergency', emergency);
      this._paintCar();
    }

    /** Leva o carro até um bairro pelas ruas do grafo. Cria o carro se necessário. */
    carTo(node, ms = 700) {
      if (!this.pos.has(node)) return Promise.resolve(false);
      if (!this.car) { this.placeCar(node); return Promise.resolve(true); }
      this._settleCar();
      const route = this.routeBetween(this.car.node, node);
      if (!route) { this.placeCar(node); return Promise.resolve(false); }
      return this.driveRoute(route, { duration: ms });
    }

    /**
     * Dirige o carro ao longo de uma lista de bairros.
     * opts.speed: px/s (se não houver duration) · opts.emergency: sirene + rastro
     */
    driveRoute(nodes, { speed = 260, duration = null, emergency = false } = {}) {
      const pts = nodes.map((v) => this.pos.get(v)).filter(Boolean);
      if (pts.length < 2) { if (nodes.length) this.placeCar(nodes[0], { emergency }); return Promise.resolve(true); }
      if (!this.car) this.placeCar(nodes[0], { emergency });
      this._settleCar();
      const car = this.car;
      car.g.classList.toggle('emergency', emergency);
      const segs = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        segs.push(l); total += l;
      }
      const trail = emergency ? el('svg:polyline', { class: 'car-trail', points: '' }) : null;
      if (trail) this.gFx.insertBefore(trail, car.g);
      const dur = duration || Math.max(900, (total / speed) * 1000);
      const start = performance.now();
      let last = start;
      const turn = (from, to) => {
        let d = to - from;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        return d;
      };

      return new Promise((resolve) => {
        car.resolve = resolve;
        car.node = nodes[nodes.length - 1]; // destino da perna atual (usado se for interrompida)
        const frame = (now) => {
          if (this.car !== car) return;
          const lin = Math.min(1, (now - start) / dur);
          // viagens longas arrancam e freiam suavemente; passos do algoritmo seguem velocidade constante
          const k = duration ? lin : 0.5 - 0.5 * Math.cos(Math.PI * lin);
          let dist = k * total, i = 0;
          while (i < segs.length - 1 && dist > segs[i]) { dist -= segs[i]; i++; }
          const f = segs[i] ? dist / segs[i] : 1;
          car.x = pts[i].x + (pts[i + 1].x - pts[i].x) * f;
          car.y = pts[i].y + (pts[i + 1].y - pts[i].y) * f;
          const want = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
          const dt = Math.min(0.05, (now - last) / 1000);
          car.angle += turn(car.angle, want) * (lin === 0 ? 1 : Math.min(1, dt * 14));
          last = now;
          this._paintCar();
          if (trail) trail.setAttribute('points', [...pts.slice(0, i + 1), { x: car.x, y: car.y }].map((p) => `${p.x},${p.y}`).join(' '));
          if (lin < 1) car.raf = requestAnimationFrame(frame);
          else { car.raf = 0; car.resolve = null; resolve(true); }
        };
        car.raf = requestAnimationFrame(frame);
      });
    }
  }

  root.SmartNet.MapView = MapView;
})(typeof window !== 'undefined' ? window : globalThis);
