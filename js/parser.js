/*
 * parser.js — leitura de grafos em texto (campo de texto ou arquivo .txt).
 *
 * Formato (tudo opcional, exceto as arestas):
 *
 *   # comentário
 *   direcionado: não        (ou: directed: false)
 *   pesos: sim              (ou: weighted: true)
 *   vertices: X Y Z         (vértices isolados / declaração antecipada)
 *   O A 2                   origem destino [peso]
 *   A -> B 7                separadores "-", "--", "->" são aceitos e ignorados
 *
 * Separadores: espaço, vírgula, ponto-e-vírgula ou tab. Nada é aplicado se houver erro.
 */
(function (root) {
  'use strict';
  const { Graph } = root.SmartNet;

  const YES = ['sim', 's', 'true', 'yes', 'y', '1', 'verdadeiro'];
  const NO = ['nao', 'não', 'n', 'false', 'no', '0', 'falso'];
  const ARROWS = new Set(['-', '--', '->', '→', '—', '–', '<->', '<-']);

  function parseBool(v) {
    const s = v.trim().toLowerCase();
    if (YES.includes(s)) return true;
    if (NO.includes(s)) return false;
    return null;
  }

  function tokenize(line) {
    return line.split(/[\s,;]+/).filter((t) => t && !ARROWS.has(t));
  }

  /**
   * @param {string} text
   * @param {{directed:boolean, weighted:boolean}} defaults usados se o texto não declarar
   * @returns {{ok:boolean, graph?:Graph, errors:string[], warnings:string[]}}
   */
  function parseGraphText(text, defaults = {}) {
    const errors = [];
    const warnings = [];
    let directed = defaults.directed ?? false;
    let weighted = defaults.weighted ?? true;
    const declaredVertices = [];
    const edgeLines = [];

    String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
      const n = i + 1;
      const line = raw.replace(/#.*/, '').trim();
      if (!line) return;

      const kv = line.match(/^([A-Za-zÀ-ÿ_]+)\s*:\s*(.*)$/);
      if (kv) {
        const key = kv[1].toLowerCase();
        const val = kv[2];
        if (['direcionado', 'directed', 'dirigido'].includes(key)) {
          const b = parseBool(val);
          if (b === null) errors.push(`Linha ${n}: valor "${val}" inválido para "${kv[1]}" (use sim/não).`);
          else directed = b;
        } else if (['pesos', 'ponderado', 'weighted', 'peso'].includes(key)) {
          const b = parseBool(val);
          if (b === null) errors.push(`Linha ${n}: valor "${val}" inválido para "${kv[1]}" (use sim/não).`);
          else weighted = b;
        } else if (['vertices', 'vértices', 'vertice', 'vértice', 'nos', 'nós'].includes(key)) {
          tokenize(val).forEach((t) => declaredVertices.push({ n, name: t }));
        } else {
          errors.push(`Linha ${n}: chave desconhecida "${kv[1]}".`);
        }
        return;
      }
      edgeLines.push({ n, tokens: tokenize(line) });
    });

    const g = new Graph({ directed, weighted });
    const attempt = (n, fn) => {
      try { fn(); } catch (e) {
        if (e instanceof root.SmartNet.GraphError) errors.push(`Linha ${n}: ${e.message}`);
        else throw e;
      }
    };

    declaredVertices.forEach(({ n, name }) => attempt(n, () => g.addVertex(name)));

    let defaulted = 0;
    for (const { n, tokens } of edgeLines) {
      if (tokens.length === 1) { attempt(n, () => g.addVertex(tokens[0])); continue; }
      if (tokens.length > 3) {
        errors.push(`Linha ${n}: esperado "origem destino [peso]", encontrado ${tokens.length} campos.`);
        continue;
      }
      const [u, v, w] = tokens;
      if (weighted && w === undefined) defaulted++;
      attempt(n, () => {
        const { created } = g.addEdge(u, v, weighted ? (w === undefined ? 1 : w) : 1);
        if (!created) warnings.push(`Linha ${n}: via ${u}${directed ? '→' : '–'}${v} repetida; peso atualizado.`);
      });
    }
    if (defaulted) warnings.push(`${defaulted} aresta(s) sem peso receberam peso 1.`);
    if (!weighted && edgeLines.some((l) => l.tokens.length === 3)) warnings.push('Pesos ignorados: o grafo foi declarado sem pesos.');
    if (!g.vertexCount && !errors.length) errors.push('Nenhum vértice ou aresta encontrado no texto.');

    return errors.length ? { ok: false, errors, warnings } : { ok: true, graph: g, errors, warnings };
  }

  root.SmartNet.parseGraphText = parseGraphText;
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SmartNet;
})(typeof window !== 'undefined' ? window : globalThis);
