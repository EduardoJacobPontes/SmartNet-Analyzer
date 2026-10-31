/*
 * dom.js — construtor de elementos. Todo texto vindo do usuário (nomes de bairros)
 * entra via textContent, nunca via innerHTML: não há como injetar HTML.
 */
(function (root) {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /**
   * el('div', { class: 'x', onclick: fn, dataset: {a: 1}, text: 'oi' }, filho1, 'texto', ...)
   * Prefixo "svg:" cria elemento no namespace SVG (ex.: 'svg:circle').
   */
  function el(tag, attrs, ...children) {
    const isSvg = tag.startsWith('svg:');
    const node = isSvg ? document.createElementNS(SVG_NS, tag.slice(4)) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.setAttribute('class', v);
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function mount(node, ...children) {
    clear(node);
    return append(node, children);
  }

  root.SmartNet = root.SmartNet || {};
  Object.assign(root.SmartNet, { el, mount, clear, SVG_NS });
})(typeof window !== 'undefined' ? window : globalThis);
