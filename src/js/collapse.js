// Collapse: muestra u oculta un panel (.collapse) con una transición de alto.
// Los botones con data-ds-toggle="collapse" y data-ds-target="#id" (o enlaces
// con href="#id") lo abren y cierran; varios botones pueden controlar el mismo
// panel y todos actualizan su aria-expanded.
// Acordeón: los paneles con data-ds-parent="<selector>" cierran a sus
// hermanos (mismo contenedor) al abrirse. Se oculta con `hidden`, sin quitarlo del DOM.
import { definir, destinoDe, emitir, enfocar, esperarTransicion, reflow, rescatarFoco } from './core.js';

const SELECTOR = '.collapse';
const BOTON = '[data-ds-toggle="collapse"]';

// Contenedor de un acordeón: primero el ancestro que coincide con el selector
// y, si no hay, el primero de la página.
function contenedor(el, selector) {
  if (!selector) return null;
  try {
    return el.closest(selector) || document.querySelector(selector);
  } catch {
    return null;
  }
}

class Collapse {
  component = 'collapse';

  constructor(el) {
    this.el = el;
    this._paso = 0;
  }

  /** true si el panel está abierto (o abriéndose). */
  get isOpen() {
    return !this.el.hidden && !this.el.classList.contains('is-closing');
  }

  open(trigger = null) {
    const { el } = this;
    if (this.isOpen || !emitir(this, 'open', trigger)) return;
    const paso = ++this._paso;
    this._cerrarHermanos(trigger);
    this._expandir(true);

    // Parte del alto actual (0 si estaba cerrado; otro si se estaba cerrando).
    const inicio = el.hidden ? 0 : el.getBoundingClientRect().height;
    el.classList.remove('is-closing');
    el.classList.add('is-opening');
    el.hidden = false;
    el.style.height = `${inicio}px`;
    reflow(el);
    el.style.height = `${el.scrollHeight}px`;
    esperarTransicion(el, () => {
      if (paso !== this._paso) return;
      el.classList.remove('is-opening');
      el.style.height = '';
      emitir(this, 'opened', trigger);
    });
  }

  close(trigger = null) {
    const { el } = this;
    if (!this.isOpen || !emitir(this, 'close', trigger)) return;
    const paso = ++this._paso;
    this._expandir(false);

    // Si el foco estaba dentro, pasa a un botón del panel (o al siguiente enfocable).
    if (el.contains(document.activeElement)) enfocar(this._botones().find((boton) => boton.getClientRects().length));
    rescatarFoco(el);

    el.style.height = `${el.getBoundingClientRect().height}px`;
    el.classList.remove('is-opening');
    el.classList.add('is-closing');
    reflow(el);
    el.style.height = '0px';
    esperarTransicion(el, () => {
      if (paso !== this._paso) return;
      el.hidden = true;
      el.classList.remove('is-closing');
      el.style.height = '';
      emitir(this, 'closed', trigger);
    });
  }

  toggle(trigger = null) {
    if (this.isOpen) this.close(trigger);
    else this.open(trigger);
  }

  /** Botones (y enlaces) con data-ds-toggle="collapse" que apuntan a este panel. */
  _botones() {
    return [...document.querySelectorAll(BOTON)].filter((boton) => destinoDe(boton) === this.el);
  }

  _expandir(abierto) {
    for (const boton of this._botones()) boton.setAttribute('aria-expanded', String(abierto));
  }

  // Acordeón: cierra los paneles abiertos del mismo contenedor (data-ds-parent).
  _cerrarHermanos(trigger) {
    const padre = contenedor(this.el, this.el.dataset.dsParent);
    if (!padre) return;
    for (const otro of padre.querySelectorAll(`${SELECTOR}[data-ds-parent]`)) {
      if (otro !== this.el && contenedor(otro, otro.dataset.dsParent) === padre) collapse(otro).close(trigger);
    }
  }
}

export const collapse = definir('collapse', SELECTOR, Collapse);
