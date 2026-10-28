// Tabs: pestañas que cambian el contenido dentro de la página (patrón tabs de ARIA).
// Las pestañas con data-ds-toggle="tab" muestran su panel (aria-controls) al
// hacer clic; la activa no se cierra. Con el teclado, las flechas (izquierda y
// derecha, o arriba y abajo en vertical), Inicio y Fin mueven el foco entre las
// pestañas, saltan las deshabilitadas y activan la que reciben.
// Los paneles se ocultan con `hidden`, sin quitarlos del DOM. Al cambiar, el
// panel anterior se desvanece (is-closing) y después aparece el nuevo (is-opening).
import { alClic, alTecla, definir, deshabilitado, emitir, enfocar, esperarTransicion, reflow } from './core.js';

const SELECTOR = '.tabs';
const PESTANA = '[data-ds-toggle="tab"]';

const conModificador = (evento) => evento.altKey || evento.ctrlKey || evento.metaKey;
const activable = (tab) => !deshabilitado(tab) && !!tab.getClientRects().length;
const panelDe = (tab) => {
  const id = tab?.getAttribute('aria-controls');
  return id ? document.getElementById(id) : null;
};

class Tabs {
  component = 'tabs';

  constructor(el) {
    this.el = el;
    this._paso = 0;
    // Termina de golpe la transición en curso (si se cambia de pestaña a mitad).
    this._cortar = null;
  }

  /** Pestañas propias (sin las de unas tabs anidadas en un panel). */
  _tabs() {
    return [...this.el.querySelectorAll('[role="tab"]')].filter((tab) => tab.closest(SELECTOR) === this.el);
  }

  _seleccionada() {
    return this._tabs().find((tab) => tab.getAttribute('aria-selected') === 'true') ?? null;
  }

  /** Muestra la pestaña indicada (elemento o índice). La activa y las deshabilitadas no hacen nada. */
  show(destino, trigger = null) {
    const tabs = this._tabs();
    const tab = typeof destino === 'number' ? tabs.at(destino) : tabs.find((t) => t === destino);
    const anterior = this._seleccionada();
    if (!tab || tab === anterior || deshabilitado(tab)) return;
    const nuevo = panelDe(tab);
    if (!emitir(this, 'open', trigger, { el: nuevo ?? this.el })) return;

    this._cortar?.();
    const paso = ++this._paso;
    const viejo = panelDe(anterior);
    if (viejo) emitir(this, 'close', trigger, { el: viejo, cancelable: false });
    for (const t of tabs) {
      const activa = t === tab;
      t.setAttribute('aria-selected', String(activa));
      if (activa) t.removeAttribute('tabindex');
      else t.setAttribute('tabindex', '-1');
    }
    // Si el foco estaba en el panel que se oculta (cambio por la API), pasa a la pestaña.
    if (viejo?.contains(document.activeElement)) enfocar(tab);

    const cerrar = () => {
      viejo.hidden = true;
      viejo.classList.remove('is-opening', 'is-closing');
      emitir(this, 'closed', trigger, { el: viejo });
    };

    const abrir = () => {
      this._cortar = null;
      if (!nuevo) return;
      nuevo.classList.remove('is-closing');
      nuevo.classList.add('is-opening');
      nuevo.hidden = false;
      reflow(nuevo);
      nuevo.classList.remove('is-opening');
      esperarTransicion(nuevo, () => paso === this._paso && emitir(this, 'opened', trigger, { el: nuevo }));
    };

    if (viejo && !viejo.hidden) {
      viejo.classList.remove('is-opening');
      viejo.classList.add('is-closing');
      this._cortar = () => {
        this._cortar = null;
        cerrar();
      };
      esperarTransicion(viejo, () => {
        if (paso !== this._paso) return;
        this._cortar = null;
        cerrar();
        abrir();
      });
    } else {
      if (viejo) cerrar();
      abrir();
    }
  }
}

export const tabs = definir('tabs', SELECTOR, Tabs);

// Clic en una pestaña: la muestra (si ya está activa, no pasa nada).
alClic(PESTANA, (evento, tab) => {
  const el = tab.closest(SELECTOR);
  if (!el || deshabilitado(tab)) return;
  if (tab.tagName === 'A') evento.preventDefault();
  tabs(el).show(tab, tab);
});

// Teclado: flechas (según la orientación), Inicio y Fin. El foco da la vuelta
// en los extremos, salta las deshabilitadas y activa la pestaña que recibe.
alTecla(PESTANA, (evento, tab) => {
  const el = tab.closest(SELECTOR);
  if (!el || conModificador(evento)) return;
  const lista = tab.closest('[role="tablist"]');
  const vertical = lista?.getAttribute('aria-orientation') === 'vertical' || el.classList.contains('tabs--vertical');
  const rtl = !vertical && lista && getComputedStyle(lista).direction === 'rtl';
  const [atras, adelante] = vertical ? ['ArrowUp', 'ArrowDown'] : rtl ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
  const { key } = evento;
  if (![atras, adelante, 'Home', 'End'].includes(key)) return;

  const instancia = tabs(el);
  const todas = instancia._tabs();
  const habilitadas = todas.filter(activable);
  if (!habilitadas.length) return;
  evento.preventDefault();
  let destino;
  if (key === 'Home') destino = habilitadas[0];
  else if (key === 'End') destino = habilitadas.at(-1);
  else {
    const paso = key === adelante ? 1 : -1;
    let i = todas.indexOf(tab);
    do i = (i + paso + todas.length) % todas.length;
    while (!activable(todas[i]));
    destino = todas[i];
  }
  enfocar(destino);
  instancia.show(destino, destino);
});
