// Dropdown: menú desplegable con enlaces o acciones (patrón disclosure, sin
// role="menu"). El botón con data-ds-toggle="dropdown" abre el .dropdown que
// lo contiene. Se cierra con un clic fuera, con Escape, al elegir un ítem y al
// salir con Tab. Solo hay uno abierto a la vez.
// Si el menú no cabe hacia donde se abre, se da vuelta (.is-flipped). Dentro de
// un contenedor que recorta (p. ej. el cuerpo con scroll de un modal) se
// posiciona con position: fixed para no cortarse.
import {
  alClic,
  alTecla,
  apilarEscape,
  definir,
  deshabilitado,
  destinoDe,
  emitir,
  enfocar,
  esperarTransicion,
  reflow,
  rescatarFoco,
} from './core.js';

const SELECTOR = '.dropdown';
const BOTON = '[data-ds-toggle="dropdown"]';
const MENU = '.dropdown__menu';
const ITEM = '.dropdown__item';
const MARGEN = 8; // Distancia mínima entre el menú y el borde de la ventana (px).

let abierto = null;

const habilitado = (item) => !deshabilitado(item) && !item.classList.contains('is-disabled');
const conModificador = (evento) => evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey;
const editable = (el) => el.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])');

// true si algún contenedor del dropdown recorta lo que sobresale (overflow ≠ visible).
function recortado(el) {
  for (let padre = el.parentElement; padre && padre !== document.body; padre = padre.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(padre);
    if (overflowX !== 'visible' || overflowY !== 'visible') return true;
  }
  return false;
}

// Desplazamiento vertical que aplica el transform actual (la transición de entrada).
function desplazamientoY(el) {
  const transform = getComputedStyle(el).transform;
  return transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0;
}

class Dropdown {
  component = 'dropdown';

  constructor(el) {
    this.el = el;
    this._paso = 0;
    this._soltar = [];
    this._boton = null;
    this._cuadro = 0;
    // Al salir con Tab (el foco pasa a un elemento fuera del dropdown), se cierra.
    el.addEventListener('focusout', (evento) => {
      const destino = evento.relatedTarget;
      if (!this.isOpen || !(destino instanceof Node)) return;
      if (!el.contains(destino) && !this._boton?.contains(destino)) this.close();
    });
  }

  get menu() {
    return this.el.querySelector(MENU);
  }

  /** true si el menú está abierto (o abriéndose). */
  get isOpen() {
    const { menu } = this;
    return !!menu && !menu.hidden && !menu.classList.contains('is-closing');
  }

  open(trigger = null) {
    const { menu } = this;
    if (!menu || this.isOpen || !emitir(this, 'open', trigger)) return;
    if (abierto && abierto !== this) abierto.close();
    abierto = this;
    const paso = ++this._paso;
    if (trigger instanceof Element && trigger.matches(BOTON)) this._boton = trigger;
    this._expandir(true);
    this._soltar = [apilarEscape(() => this._cerrar(null, true)), this._seguir(), this._vigilarFuera()];

    // Sin transición mientras se mide y se ubica: así el menú entra desde el
    // lado correcto aunque se dé vuelta.
    menu.style.transition = 'none';
    menu.classList.remove('is-closing');
    menu.classList.add('is-opening');
    menu.hidden = false;
    this._ubicar();
    reflow(menu);
    menu.style.transition = '';
    menu.classList.remove('is-opening');
    esperarTransicion(menu, () => paso === this._paso && emitir(this, 'opened', trigger));
  }

  close(trigger = null) {
    this._cerrar(trigger, false);
  }

  toggle(trigger = null) {
    if (this.isOpen) this.close(trigger);
    else this.open(trigger);
  }

  // regresar: con Escape o al elegir un ítem, el foco vuelve al botón (también
  // si quedó en el body). En los demás casos, solo si estaba dentro del menú.
  _cerrar(trigger, regresar) {
    const { menu } = this;
    if (!this.isOpen || !emitir(this, 'close', trigger)) return;
    const paso = ++this._paso;
    if (abierto === this) abierto = null;
    this._soltar.forEach((soltar) => soltar());
    this._soltar = [];

    const activo = document.activeElement;
    if (menu.contains(activo) || (regresar && (!activo || activo === document.body))) enfocar(this._botonActual());
    rescatarFoco(menu);
    this._expandir(false);

    menu.classList.remove('is-opening');
    menu.classList.add('is-closing');
    esperarTransicion(menu, () => {
      if (paso !== this._paso) return;
      menu.hidden = true;
      menu.classList.remove('is-closing');
      this._limpiar();
      emitir(this, 'closed', trigger);
    });
  }

  _botonActual() {
    return this._boton?.isConnected ? this._boton : this.el.querySelector(BOTON);
  }

  _expandir(abierta) {
    for (const boton of new Set([this.el.querySelector(BOTON), this._boton])) {
      boton?.setAttribute('aria-expanded', String(abierta));
    }
  }

  /** Ítems habilitados y visibles del menú. */
  _items() {
    return [...this.menu.querySelectorAll(ITEM)].filter((item) => habilitado(item) && item.getClientRects().length);
  }

  _enfocarItem(indice) {
    enfocar(this._items().at(indice));
  }

  // Clic (o toque) fuera del dropdown: lo cierra. Usa pointerup y no click
  // porque iOS no envía el click de elementos no interactivos a document; y
  // no pointerdown, para que deslizar la página en móvil no lo cierre.
  _vigilarFuera() {
    const fuera = (evento) => {
      const objetivo = evento.target;
      if (objetivo instanceof Node && !this.el.contains(objetivo) && !this._boton?.contains(objetivo)) this.close();
    };
    document.addEventListener('pointerup', fuera);
    return () => document.removeEventListener('pointerup', fuera);
  }

  // Vuelve a ubicar el menú al hacer scroll o cambiar el tamaño de la ventana.
  _seguir() {
    const reubicar = () => {
      cancelAnimationFrame(this._cuadro);
      this._cuadro = requestAnimationFrame(() => this.isOpen && this._ubicar());
    };
    addEventListener('resize', reubicar);
    document.addEventListener('scroll', reubicar, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(this._cuadro);
      removeEventListener('resize', reubicar);
      document.removeEventListener('scroll', reubicar, { capture: true });
    };
  }

  _limpiar() {
    const estilo = this.menu?.style;
    if (estilo) {
      for (const propiedad of ['position', 'top', 'right', 'bottom', 'left', 'margin', 'minWidth']) estilo[propiedad] = '';
    }
    this.el.classList.remove('is-flipped');
  }

  // Elige hacia dónde se abre (lo da vuelta si no cabe y al otro lado hay más
  // espacio) y evita que se salga por los costados de la ventana.
  _ubicar() {
    const { el, menu } = this;
    const estilo = menu.style;
    this._limpiar();
    const css = getComputedStyle(menu);
    const separacion = parseFloat(css.marginTop) + parseFloat(css.marginBottom);
    const fijo = recortado(el);
    const ancla = el.getBoundingClientRect();
    if (fijo) {
      Object.assign(estilo, { position: 'fixed', top: '0px', left: '0px', right: 'auto', bottom: 'auto', margin: '0px' });
      estilo.minWidth = `max(${ancla.width}px, var(--ds-dropdown-min-width))`;
    }

    const { offsetWidth: ancho, offsetHeight: alto } = menu;
    const { clientWidth: anchoVentana, clientHeight: altoVentana } = document.documentElement;
    const abajo = altoVentana - ancla.bottom - separacion - MARGEN;
    const arriba = ancla.top - separacion - MARGEN;
    const prefiereArriba = el.classList.contains('dropdown--up');
    const haciaArriba = prefiereArriba ? !(arriba < alto && abajo > arriba) : abajo < alto && arriba > abajo;
    el.classList.toggle('is-flipped', haciaArriba !== prefiereArriba);

    const deseado = menu.classList.contains('dropdown__menu--end') ? ancla.right - ancho : ancla.left;
    const x = Math.max(MARGEN, Math.min(deseado, anchoVentana - MARGEN - ancho));

    if (fijo) {
      // Con position: fixed el origen es la ventana, salvo que un contenedor
      // tenga transform o filter: se mide dónde quedó y se corrige.
      const origen = menu.getBoundingClientRect();
      const y = haciaArriba ? ancla.top - separacion - alto : ancla.bottom + separacion;
      estilo.left = `${x - origen.left}px`;
      estilo.top = `${y - (origen.top - desplazamientoY(menu))}px`;
    } else if (Math.abs(x - deseado) > 0.5) {
      estilo.left = `${x - ancla.left}px`;
      estilo.right = 'auto';
    }
  }
}

export const dropdown = definir('dropdown', SELECTOR, Dropdown);

// Clic en un ítem: cierra el menú (los deshabilitados no hacen nada).
alClic(ITEM, (evento, item) => {
  const el = item.closest(MENU)?.closest(SELECTOR);
  if (!el) return;
  if (!habilitado(item)) return evento.preventDefault();
  const instancia = dropdown(el);
  if (instancia.isOpen) instancia._cerrar(item, true);
});

// Flecha abajo (o arriba) en el botón: abre y enfoca el primer (o el último) ítem.
alTecla(BOTON, (evento, boton) => {
  const { key } = evento;
  if ((key !== 'ArrowDown' && key !== 'ArrowUp') || conModificador(evento) || deshabilitado(boton)) return;
  const el = destinoDe(boton, SELECTOR);
  if (!el?.matches(SELECTOR)) return;
  evento.preventDefault();
  const instancia = dropdown(el);
  if (!instancia.isOpen) instancia.open(boton);
  instancia._enfocarItem(key === 'ArrowDown' ? 0 : -1);
});

// Dentro del menú: flechas, Inicio y Fin recorren los ítems y saltan los deshabilitados.
alTecla(MENU, (evento, menu) => {
  const { key } = evento;
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key) || conModificador(evento) || editable(evento.target)) return;
  const el = menu.closest(SELECTOR);
  if (!el) return;
  const instancia = dropdown(el);
  const items = instancia.isOpen ? instancia._items() : [];
  if (!items.length) return;
  evento.preventDefault();
  const actual = items.indexOf(evento.target.closest(ITEM));
  const ultimo = items.length - 1;
  let destino;
  if (key === 'Home') destino = 0;
  else if (key === 'End') destino = ultimo;
  else if (key === 'ArrowDown') destino = actual < 0 ? 0 : Math.min(actual + 1, ultimo);
  else destino = actual < 0 ? ultimo : Math.max(actual - 1, 0);
  enfocar(items[destino]);
});
