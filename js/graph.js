/*
 * graph.js — Grafo implementado do zero com LISTA DE ADJACÊNCIA.
 *
 *   adj : Map<vértice, Array<{ to, edge }>>   (ordem de inserção preservada)
 *   edges: Array<{ id, u, v, w, blocked }>     (registro canônico de cada via)
 *
 * Em grafos não-direcionados cada via aparece nas listas dos DOIS extremos,
 * apontando para o MESMO registro de aresta (peso e bloqueio ficam consistentes).
 * Nenhuma biblioteca de grafos é usada.
 *
 * Espaço: O(V + E). Inserir aresta: O(1) amortizado (+ O(grau) para checar duplicata).
 */
(function (root) {
  'use strict';

  const MAX_NAME = 24;

  class GraphError extends Error {}

  class Graph {
    constructor({ directed = false, weighted = true } = {}) {
      this.directed = directed;
      this.weighted = weighted;
      this.adj = new Map();
      this.edges = [];
      this._nextId = 1;
    }

    /* ---------- consulta ---------- */
    get vertexCount() { return this.adj.size; }
    get edgeCount() { return this.edges.length; }
    vertices() { return [...this.adj.keys()]; }
    hasVertex(v) { return this.adj.has(v); }
    edgeById(id) { return this.edges.find((e) => e.id === id) || null; }

    /** Peso efetivo: 1 quando o grafo é não-ponderado. */
    weight(edge) { return this.weighted ? edge.w : 1; }

    findEdge(u, v) {
      const list = this.adj.get(u);
      if (!list) return null;
      for (const entry of list) if (entry.to === v) return entry.edge;
      return null;
    }

    /**
     * Vizinhos de v como { to, edge, w }.
     * @param order 'insertion' | 'alpha'
     * @param includeBlocked vias interditadas ficam de fora por padrão
     */
    neighbors(v, { order = 'insertion', includeBlocked = false } = {}) {
      const list = this.adj.get(v) || [];
      const out = [];
      for (const { to, edge } of list) {
        if (edge.blocked && !includeBlocked) continue;
        out.push({ to, edge, w: this.weight(edge) });
      }
      if (order === 'alpha') out.sort((a, b) => a.to.localeCompare(b.to, 'pt', { numeric: true }));
      return out;
    }

    /** Arestas ativas (não interditadas), na ordem de inserção. */
    activeEdges() { return this.edges.filter((e) => !e.blocked); }

    outDegree(v) { return this.neighbors(v).length; }

    inDegree(v) {
      if (!this.directed) return this.outDegree(v);
      let n = 0;
      for (const e of this.edges) if (!e.blocked && e.v === v) n++;
      return n;
    }

    /* ---------- validação ---------- */
    static validateName(raw) {
      const name = String(raw ?? '').trim();
      if (!name) throw new GraphError('O nome do vértice não pode ser vazio.');
      if (/\s/.test(name)) throw new GraphError(`Nome inválido "${name}": não use espaços.`);
      if (name.length > MAX_NAME) throw new GraphError(`Nome muito longo (máx. ${MAX_NAME} caracteres).`);
      return name;
    }

    static parseWeight(raw) {
      if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) throw new GraphError('Peso inválido.');
        return raw;
      }
      const s = String(raw ?? '').trim().replace(',', '.');
      if (s === '') throw new GraphError('Informe o peso da aresta.');
      const n = Number(s);
      if (!Number.isFinite(n)) throw new GraphError(`Peso inválido: "${raw}".`);
      return n;
    }

    /* ---------- mutação ---------- */
    addVertex(raw) {
      const name = Graph.validateName(raw);
      if (this.adj.has(name)) return false;
      this.adj.set(name, []);
      return true;
    }

    /**
     * Cria (ou atualiza o peso de) uma via. Vértices ausentes são criados.
     * @returns {{ edge, created: boolean }}
     */
    addEdge(uRaw, vRaw, wRaw = 1) {
      const u = Graph.validateName(uRaw);
      const v = Graph.validateName(vRaw);
      if (u === v) throw new GraphError(`Laços não são permitidos (${u} → ${u}).`);
      const w = this.weighted ? Graph.parseWeight(wRaw) : 1;
      this.addVertex(u);
      this.addVertex(v);

      const existing = this.findEdge(u, v);
      if (existing) {
        existing.w = w;
        return { edge: existing, created: false };
      }
      const edge = { id: this._nextId++, u, v, w, blocked: false };
      this.edges.push(edge);
      this.adj.get(u).push({ to: v, edge });
      if (!this.directed) this.adj.get(v).push({ to: u, edge });
      return { edge, created: true };
    }

    removeEdge(id) {
      const edge = this.edgeById(id);
      if (!edge) return false;
      this.edges = this.edges.filter((e) => e.id !== id);
      for (const list of this.adj.values()) {
        for (let i = list.length - 1; i >= 0; i--) if (list[i].edge === edge) list.splice(i, 1);
      }
      return true;
    }

    removeVertex(name) {
      if (!this.adj.has(name)) return false;
      for (const e of [...this.edges]) if (e.u === name || e.v === name) this.removeEdge(e.id);
      this.adj.delete(name);
      return true;
    }

    setBlocked(id, blocked) {
      const e = this.edgeById(id);
      if (!e) return false;
      e.blocked = !!blocked;
      return true;
    }

    clear() {
      this.adj.clear();
      this.edges = [];
      this._nextId = 1;
    }

    /**
     * Troca direcionado/não-direcionado reconstruindo as listas.
     * Ao tornar o grafo não-direcionado, u→v e v→u viram uma única via (menor peso).
     * @returns {number} quantas vias foram fundidas
     */
    setDirected(directed) {
      if (directed === this.directed) return 0;
      const old = this.edges;
      const verts = this.vertices();
      this.clear();
      this.directed = directed;
      verts.forEach((v) => this.adj.set(v, []));
      let merged = 0;
      for (const e of old) {
        const dup = this.findEdge(e.u, e.v);
        if (dup) {
          merged++;
          dup.w = Math.min(dup.w, e.w);
          dup.blocked = dup.blocked && e.blocked;
          continue;
        }
        const { edge } = this.addEdge(e.u, e.v, e.w);
        edge.blocked = e.blocked;
      }
      return merged;
    }

    setWeighted(weighted) {
      this.weighted = !!weighted;
    }

    /** Serializa no formato aceito por parser.js. */
    toText() {
      const lines = [
        `direcionado: ${this.directed ? 'sim' : 'não'}`,
        `pesos: ${this.weighted ? 'sim' : 'não'}`,
      ];
      const touched = new Set();
      this.edges.forEach((e) => { touched.add(e.u); touched.add(e.v); });
      const isolated = this.vertices().filter((v) => !touched.has(v));
      if (isolated.length) lines.push(`vertices: ${isolated.join(' ')}`);
      for (const e of this.edges) lines.push(this.weighted ? `${e.u} ${e.v} ${e.w}` : `${e.u} ${e.v}`);
      return lines.join('\n');
    }

    /* ---------- visões para a interface "Memória" ---------- */
    /** Matriz derivada (apenas visualização): null = sem aresta. */
    toMatrix({ includeBlocked = true } = {}) {
      const verts = this.vertices();
      const idx = new Map(verts.map((v, i) => [v, i]));
      const m = verts.map(() => verts.map(() => null));
      for (const e of this.edges) {
        if (e.blocked && !includeBlocked) continue;
        m[idx.get(e.u)][idx.get(e.v)] = { w: this.weight(e), blocked: e.blocked };
        if (!this.directed) m[idx.get(e.v)][idx.get(e.u)] = { w: this.weight(e), blocked: e.blocked };
      }
      return { verts, m };
    }
  }

  root.SmartNet = root.SmartNet || {};
  root.SmartNet.Graph = Graph;
  root.SmartNet.GraphError = GraphError;
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SmartNet;
})(typeof window !== 'undefined' ? window : globalThis);
