/*
 * mapview.js — mapa SVG da cidade: bairros (vértices) e vias (arestas).
 *  - arrastar bairros, layout automático (força), vias curvas para mão dupla em grafos direcionados
 *  - estados visuais vindos dos algoritmos (visitado, atual, MST, rota…)
 *  - animação de veículo de emergência ao longo de uma rota
 */
(function (root) {
  'use strict';
  const { el, clear } = root.SmartNet;

  const W = 1000, H = 640, R = 22, MARGIN = 48;
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
      this.vehicle = null;
      this._seed = 7;

      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      this.gEdges = el('svg:g', { class: 'layer-edges' });
      this.gNodes = el('svg:g', { class: 'layer-nodes' });
      this.gFx = el('svg:g', { class: 'layer-fx' });
      svg.append(this.gEdges, this.gNodes, this.gFx);

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
        const line = el('svg:path', { class: 'edge-line' });
        const arrow = g.directed ? el('svg:polygon', { class: 'edge-arrow' }) : null;
        const bg = g.weighted ? el('svg:rect', { class: 'edge-label-bg', rx: 7, height: 18 }) : null;
        const txt = g.weighted ? el('svg:text', { class: 'edge-label', 'text-anchor': 'middle' }) : null;
        const title = el('svg:title');
        const grp = el('svg:g', { class: 'edge', 'data-id': e.id }, title, hit, line, arrow, bg, txt);
        grp.addEventListener('click', () => this.h.onEdgeClick && this.h.onEdgeClick(e));
        this.gEdges.appendChild(grp);
        this.edgeEls.set(e.id, { grp, hit, line, arrow, bg, txt, title, e });
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
      const d = c ? `M${s.x},${s.y} Q${c.x},${c.y} ${t.x},${t.y}` : `M${s.x},${s.y} L${t.x},${t.y}`;
      const mid = c
        ? { x: 0.25 * s.x + 0.5 * c.x + 0.25 * t.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * t.y }
        : { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
      // direção da ponta da seta
      const from = c || s;
      const ang = Math.atan2(t.y - from.y, t.x - from.x);
      return { d, mid, t, ang };
    }

    updateGeometry() {
      for (const { hit, line, arrow, bg, txt, title, e } of this.edgeEls.values()) {
        const gm = this._geom(e);
        hit.setAttribute('d', gm.d);
        line.setAttribute('d', gm.d);
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

    /* ---------- veículo de emergência ---------- */
    stopVehicle() {
      if (this.vehicle) {
        cancelAnimationFrame(this.vehicle.raf);
        const { resolve } = this.vehicle;
        this.vehicle = null;
        resolve(false);
      }
      clear(this.gFx);
    }

    /** Anima 🚑 sobre os centros dos bairros da rota. Retorna uma Promise (resolve ao chegar ou ser cancelada). */
    driveAlong(path, { speed = 240, icon = '🚑' } = {}) {
      this.stopVehicle();
      const pts = path.map((v) => this.pos.get(v)).filter(Boolean);
      if (pts.length < 2) return Promise.resolve(false);
      const segs = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        segs.push(l); total += l;
      }
      const trail = el('svg:polyline', { class: 'vehicle-trail', points: '' });
      const car = el('svg:text', { class: 'vehicle', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, icon);
      const halo = el('svg:circle', { class: 'vehicle-halo', r: 17 });
      this.gFx.append(trail, halo, car);

      return new Promise((resolve) => {
        const start = performance.now();
        const dur = Math.max(900, (total / speed) * 1000);
        const state = { raf: 0, resolve };
        this.vehicle = state;
        const frame = (now) => {
          const k = Math.min(1, (now - start) / dur);
          let dist = k * total, i = 0;
          while (i < segs.length - 1 && dist > segs[i]) { dist -= segs[i]; i++; }
          const f = segs[i] ? dist / segs[i] : 1;
          const x = pts[i].x + (pts[i + 1].x - pts[i].x) * f;
          const y = pts[i].y + (pts[i + 1].y - pts[i].y) * f;
          car.setAttribute('x', x); car.setAttribute('y', y);
          halo.setAttribute('cx', x); halo.setAttribute('cy', y);
          const done = [...pts.slice(0, i + 1), { x, y }];
          trail.setAttribute('points', done.map((p) => `${p.x},${p.y}`).join(' '));
          if (k < 1 && this.vehicle === state) state.raf = requestAnimationFrame(frame);
          else { if (this.vehicle === state) this.vehicle = null; resolve(k >= 1); }
        };
        state.raf = requestAnimationFrame(frame);
      });
    }
  }

  root.SmartNet.MapView = MapView;
})(typeof window !== 'undefined' ? window : globalThis);
