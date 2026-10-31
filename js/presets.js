/* presets.js — grafos prontos (o grafo oficial do enunciado e uma cidade de demonstração). */
(function (root) {
  'use strict';

  const PRESETS = {
    professor: {
      name: 'Grafo de Teste do Professor',
      directed: false,
      weighted: true,
      vertices: ['O', 'A', 'B', 'C', 'D', 'E', 'F', 'T'],
      edges: [
        ['O', 'A', 2], ['O', 'C', 4], ['O', 'B', 5],
        ['A', 'B', 2], ['A', 'D', 7], ['A', 'F', 12],
        ['B', 'C', 1], ['B', 'D', 4], ['B', 'E', 3],
        ['C', 'E', 4], ['D', 'E', 4], ['D', 'T', 5],
        ['E', 'T', 7], ['F', 'T', 3],
      ],
      positions: {
        O: [90, 310], A: [250, 120], B: [390, 310], C: [250, 510],
        D: [610, 150], E: [630, 490], F: [800, 70], T: [900, 320],
      },
    },
    cidade: {
      name: 'Cidade de demonstração',
      directed: false,
      weighted: true,
      vertices: ['Centro', 'Hospital', 'Porto', 'Aeroporto', 'Campus', 'Industrial', 'Jardins', 'Vila Nova', 'Ilha'],
      edges: [
        ['Centro', 'Hospital', 3], ['Centro', 'Porto', 5], ['Centro', 'Campus', 4],
        ['Hospital', 'Jardins', 6], ['Porto', 'Industrial', 7], ['Campus', 'Jardins', 2],
        ['Campus', 'Industrial', 8], ['Jardins', 'Aeroporto', 9], ['Industrial', 'Aeroporto', 4],
        ['Industrial', 'Vila Nova', 6], ['Vila Nova', 'Ilha', 5],
      ],
      positions: {
        Centro: [420, 300], Hospital: [220, 170], Porto: [330, 520], Aeroporto: [820, 120],
        Campus: [560, 170], Industrial: [650, 400], Jardins: [380, 60], 'Vila Nova': [860, 440], Ilha: [920, 580],
      },
    },
  };

  /** Constrói um Graph a partir de um preset. */
  function buildPreset(key) {
    const p = PRESETS[key];
    const g = new root.SmartNet.Graph({ directed: p.directed, weighted: p.weighted });
    p.vertices.forEach((v) => g.addVertex(v));
    p.edges.forEach(([u, v, w]) => g.addEdge(u, v, w));
    return { graph: g, positions: p.positions, name: p.name };
  }

  root.SmartNet.PRESETS = PRESETS;
  root.SmartNet.buildPreset = buildPreset;
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SmartNet;
})(typeof window !== 'undefined' ? window : globalThis);
