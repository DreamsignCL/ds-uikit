// Mensaje: cerrar (y volver a mostrar) un .message con transición.
// Se oculta con el atributo `hidden`, sin quitarlo del DOM: así React (o el
// framework que lo pintó) sigue a cargo del nodo. Para quitarlo, escucha ds:closed.
import { definir, emitir, esperarTransicion, reflow, rescatarFoco } from './core.js';

class Message {
  component = 'message';

  constructor(el) {
    this.el = el;
    this._paso = 0;
  }

  /** true si el mensaje está visible (o apareciendo). */
  get isOpen() {
    return !this.el.hidden && !this.el.classList.contains('is-closing');
  }

  open(trigger = null) {
    const { el } = this;
    if (this.isOpen || !emitir(this, 'open', trigger)) return;
    const paso = ++this._paso;
    el.classList.remove('is-closing');
    el.classList.add('is-opening');
    el.hidden = false;
    reflow(el);
    el.classList.remove('is-opening');
    esperarTransicion(el, () => paso === this._paso && emitir(this, 'opened', trigger));
  }

  close(trigger = null) {
    const { el } = this;
    if (!this.isOpen || !emitir(this, 'close', trigger)) return;
    const paso = ++this._paso;
    el.classList.remove('is-opening');
    el.classList.add('is-closing');
    esperarTransicion(el, () => {
      if (paso !== this._paso) return;
      rescatarFoco(el);
      el.hidden = true;
      el.classList.remove('is-closing');
      emitir(this, 'closed', trigger);
    });
  }
}

export const message = definir('message', '.message', Message);
