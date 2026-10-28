// Modal: abrir (data-ds-toggle="modal") y cerrar (data-ds-dismiss="modal",
// clic en el fondo o Escape) un .modal con transición.
// Al abrir bloquea el scroll, atrapa el foco y enfoca el elemento con
// autofocus (o data-autofocus) o el primer enfocable; al cerrar devuelve el
// foco al botón que lo abrió. Se oculta con `hidden`, sin quitarlo del DOM.
import {
  alClic,
  apilarEscape,
  atraparFoco,
  bloquearScroll,
  definir,
  emitir,
  enfocables,
  enfocar,
  enfocarRegreso,
  esperarTransicion,
  liberarScroll,
  reflow,
  rescatarFoco,
} from './core.js';

const VENTANA = '.modal__dialog';

class Modal {
  component = 'modal';

  constructor(el) {
    this.el = el;
    this._paso = 0;
    this._scroll = false;
    this._soltar = [];
    this._regreso = null;
    this._inicio = null;
    // Dónde empezó el clic: si fue dentro de la ventana (p. ej. al seleccionar
    // texto y soltar sobre el fondo), no cierra.
    el.addEventListener('pointerdown', (evento) => {
      this._inicio = evento.target;
    });
  }

  get dialog() {
    return this.el.querySelector(VENTANA) || this.el;
  }

  /** true si el modal está abierto (o abriéndose). */
  get isOpen() {
    return !this.el.hidden && !this.el.classList.contains('is-closing');
  }

  open(trigger = null) {
    const { el } = this;
    if (this.isOpen || !emitir(this, 'open', trigger)) return;
    const paso = ++this._paso;
    const activo = document.activeElement;
    this._regreso = trigger || (activo && activo !== document.body && !el.contains(activo) ? activo : null);
    this._inicio = null;
    if (!this._scroll) {
      bloquearScroll();
      this._scroll = true;
    }
    this._soltar = [apilarEscape(() => this.close()), atraparFoco(el)];

    el.classList.remove('is-closing');
    el.classList.add('is-opening');
    el.hidden = false;
    reflow(el);
    this._enfocarInicio();
    el.classList.remove('is-opening');
    esperarTransicion(this.dialog, () => paso === this._paso && emitir(this, 'opened', trigger));
  }

  close(trigger = null) {
    const { el } = this;
    if (!this.isOpen || !emitir(this, 'close', trigger)) return;
    const paso = ++this._paso;
    this._soltar.forEach((soltar) => soltar());
    this._soltar = [];

    // El foco vuelve de inmediato al botón que lo abrió (también si quedó en
    // el body, p. ej. tras un clic en el fondo).
    const regreso = this._regreso;
    const activo = document.activeElement;
    this._regreso = null;
    if (!activo || activo === document.body || el.contains(activo)) {
      enfocarRegreso(regreso);
      if (el.contains(document.activeElement)) rescatarFoco(el);
    }

    el.classList.remove('is-opening');
    el.classList.add('is-closing');
    esperarTransicion(this.dialog, () => {
      if (paso !== this._paso) return;
      el.hidden = true;
      el.classList.remove('is-closing');
      if (this._scroll) {
        liberarScroll();
        this._scroll = false;
      }
      emitir(this, 'closed', trigger);
    });
  }

  toggle(trigger = null) {
    if (this.isOpen) this.close(trigger);
    else this.open(trigger);
  }

  // Enfoca el elemento con autofocus (data-autofocus en React, porque autoFocus
  // no deja el atributo en el DOM), el primer enfocable o, si no hay, el modal.
  _enfocarInicio() {
    const { el } = this;
    const lista = enfocables(el);
    const destino = lista.find((x) => x.matches('[autofocus], [data-autofocus]')) || lista[0];
    if (destino) return enfocar(destino);
    if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
    enfocar(el);
  }
}

export const modal = definir('modal', '.modal', Modal);

// true si nodo está dentro de la ventana de este modal (no de uno anidado).
const enVentana = (el, nodo) => {
  const ventana = nodo instanceof Element ? nodo.closest(VENTANA) : null;
  return !!ventana && el.contains(ventana);
};

// Clic en el fondo (fuera de la ventana): cierra, salvo con data-ds-backdrop="static".
alClic('.modal', (evento, el) => {
  if (el.dataset.dsBackdrop === 'static' || enVentana(el, evento.target)) return;
  const instancia = modal(el);
  if (!instancia.isOpen || enVentana(el, instancia._inicio)) return;
  instancia.close(evento.target);
});
