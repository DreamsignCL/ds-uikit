// Toast: aviso flotante que se cierra solo. data-ds-toggle="toast" lo muestra
// (si ya está abierto, reinicia el tiempo) y data-ds-dismiss="toast" lo cierra.
// Se cierra a los 5 s (data-ds-delay en ms; data-ds-autohide="false" lo
// desactiva). El tiempo se pausa mientras el puntero está encima o el foco
// está dentro. Sin trampa de foco ni Escape. Se oculta con `hidden`, sin
// quitarlo del DOM.
import { definir, emitir, enfocarRegreso, esperarTransicion, reflow, rescatarFoco } from './core.js';

const DEMORA = 5000;

class Toast {
  component = 'toast';

  constructor(el) {
    this.el = el;
    this._paso = 0;
    this._reloj = null;
    this._restante = 0;
    this._fin = 0;
    this._encima = false;
    this._foco = false;
    // Dónde estaba el foco antes de entrar al toast: vuelve ahí al cerrarlo.
    this._origen = null;

    el.addEventListener('pointerenter', () => {
      this._encima = true;
      this._pausar();
    });
    el.addEventListener('pointerleave', () => {
      this._encima = false;
      this._seguir();
    });
    el.addEventListener('focusin', (evento) => {
      if (!el.contains(evento.relatedTarget)) this._origen = evento.relatedTarget;
      this._foco = true;
      this._pausar();
    });
    el.addEventListener('focusout', (evento) => {
      if (el.contains(evento.relatedTarget)) return;
      this._foco = false;
      this._seguir();
    });
  }

  /** true si el toast está visible (o apareciendo). */
  get isOpen() {
    return !this.el.hidden && !this.el.classList.contains('is-closing');
  }

  /** Muestra el toast. Si ya está abierto, reinicia el tiempo para cerrarse. */
  open(trigger = null) {
    if (this.isOpen) return this._reiniciar();
    const { el } = this;
    if (!emitir(this, 'open', trigger)) return;
    const paso = ++this._paso;
    el.classList.remove('is-closing');
    el.classList.add('is-opening');
    el.hidden = false;
    reflow(el);
    el.classList.remove('is-opening');
    this._reiniciar();
    esperarTransicion(el, () => paso === this._paso && emitir(this, 'opened', trigger));
  }

  close(trigger = null) {
    const { el } = this;
    if (!this.isOpen || !emitir(this, 'close', trigger)) return;
    const paso = ++this._paso;
    this._detener();
    // Si el foco estaba dentro, vuelve a donde estaba antes (o al siguiente enfocable).
    if (el.contains(document.activeElement)) {
      enfocarRegreso(this._origen);
      if (el.contains(document.activeElement)) rescatarFoco(el);
    }
    this._origen = null;
    el.classList.remove('is-opening');
    el.classList.add('is-closing');
    esperarTransicion(el, () => {
      if (paso !== this._paso) return;
      el.hidden = true;
      el.classList.remove('is-closing');
      this._encima = this._foco = false;
      emitir(this, 'closed', trigger);
    });
  }

  toggle(trigger = null) {
    if (this.isOpen) this.close(trigger);
    else this.open(trigger);
  }

  // --- Cierre automático

  _reiniciar() {
    const ms = Number.parseInt(this.el.dataset.dsDelay, 10);
    this._restante = ms >= 0 ? ms : DEMORA;
    this._detener();
    this._seguir();
  }

  _detener() {
    clearTimeout(this._reloj);
    this._reloj = null;
  }

  // Guarda el tiempo que falta y detiene el reloj.
  _pausar() {
    if (!this._reloj) return;
    this._restante = Math.max(0, this._fin - Date.now());
    this._detener();
  }

  // Sigue con el tiempo que faltaba, si nada lo pausa.
  _seguir() {
    if (this._reloj || !this.isOpen || this._encima || this._foco || this.el.dataset.dsAutohide === 'false') return;
    this._fin = Date.now() + this._restante;
    this._reloj = setTimeout(() => {
      this._reloj = null;
      this.close();
    }, this._restante);
  }
}

export const toast = definir('toast', '.toast', Toast, { alternar: 'open' });
