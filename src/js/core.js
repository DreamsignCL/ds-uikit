// Núcleo de ds-uikit.js: registro de componentes, delegación de eventos,
// eventos ds:*, pila de Escape, foco, bloqueo del scroll y transiciones.
// No toca `document` al importarse (funciona con SSR): todo arranca en init().

export const version = '__VERSION__';

const MARCA = Symbol.for('dsUIKit');
const componentes = {};
const instancias = new WeakMap();
const clics = [];
const teclas = [];
const pilaEscape = [];
const trampas = [];

const esElemento = (x) => typeof Element !== 'undefined' && x instanceof Element;

/**
 * Registra un componente y devuelve su fábrica: dsUIKit.<nombre>(el).
 * La fábrica acepta un elemento o un selector y devuelve siempre la misma instancia.
 * opciones.alternar: método que llama data-ds-toggle (p. ej. 'open' en el toast,
 * que al repetirse reinicia el tiempo); por defecto, toggle() u open/close.
 */
export function definir(nombre, selector, Clase, { alternar = null } = {}) {
  const fabrica = (el) => {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!esElemento(el)) return null;
    let mapa = instancias.get(el);
    if (!mapa) instancias.set(el, (mapa = {}));
    return (mapa[nombre] ??= new Clase(el));
  };
  componentes[nombre] = { selector, fabrica, alternar };
  return fabrica;
}

/** Ejecuta fn(evento, elemento) al hacer clic en un elemento que coincide con el selector. */
export function alClic(selector, fn) {
  clics.push([selector, fn]);
}

/** Ejecuta fn(evento, elemento) al presionar una tecla dentro de un elemento que coincide con el selector. */
export function alTecla(selector, fn) {
  teclas.push([selector, fn]);
}

/**
 * Emite ds:<tipo> en el elemento del componente (o en `el`, p. ej. el panel de
 * unas tabs). detail: { component, instance, trigger }.
 * Devuelve false si alguien llamó a preventDefault() (por defecto, solo open y close son cancelables).
 */
export function emitir(instancia, tipo, trigger = null, { el = instancia.el, cancelable = tipo === 'open' || tipo === 'close' } = {}) {
  const evento = new CustomEvent(`ds:${tipo}`, {
    bubbles: true,
    cancelable,
    detail: { component: instancia.component, instance: instancia, trigger },
  });
  return el.dispatchEvent(evento);
}

// --- Pila de Escape: solo responde el último elemento abierto (modal sobre dropdown, etc.).

/** Agrega fn a la pila de Escape. Devuelve la función para quitarla. */
export function apilarEscape(fn) {
  pilaEscape.push(fn);
  return () => quitar(pilaEscape, fn);
}

// --- Foco

const ENFOCABLES = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'audio[controls]', 'video[controls]',
  'summary', '[contenteditable]:not([contenteditable="false"])', '[tabindex]',
].join(',');

const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

/** Elementos enfocables con Tab dentro de raiz (por defecto, toda la página). */
export function enfocables(raiz = document) {
  return [...raiz.querySelectorAll(ENFOCABLES)].filter(
    (el) => el.tabIndex >= 0 && !el.closest('[hidden], [inert]') && visible(el),
  );
}

/** Enfoca sin desplazar la página. */
export function enfocar(el) {
  el?.focus({ preventScroll: true });
}

/** Mantiene el foco dentro de raiz al usar Tab. Devuelve la función para liberarlo. */
export function atraparFoco(raiz) {
  trampas.push(raiz);
  return () => quitar(trampas, raiz);
}

/**
 * Si el foco está dentro de el (que se va a ocultar), lo pasa al siguiente
 * elemento enfocable de la página o, si no hay, al anterior.
 */
export function rescatarFoco(el) {
  if (!el.contains(document.activeElement)) return;
  const lista = enfocables();
  const siguiente = lista.find((x) => !el.contains(x) && el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
  const anterior = lista.reverse().find((x) => !el.contains(x) && el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_PRECEDING);
  const destino = siguiente || anterior;
  if (destino) enfocar(destino);
  else document.activeElement.blur();
}

/**
 * Devuelve el foco a el (el botón que abrió algo). Si el quedó oculto (p. ej.
 * un ítem de un dropdown que abrió un modal), lo pasa al botón con
 * aria-expanded que controla la parte oculta.
 */
export function enfocarRegreso(el) {
  if (!el?.isConnected) return;
  enfocar(el);
  if (document.activeElement === el) return;
  const oculto = el.closest('[hidden]');
  enfocar(oculto?.parentElement?.querySelector('[aria-expanded]'));
}

// --- Bloqueo del scroll (contador: se libera cuando se cierra el último que lo pidió).

let bloqueos = 0;
let estiloPrevio = '';

export function bloquearScroll() {
  if (bloqueos++) return;
  const raiz = document.documentElement;
  const barra = window.innerWidth - raiz.clientWidth;
  estiloPrevio = raiz.getAttribute('style') || '';
  raiz.style.overflow = 'hidden';
  // Reserva el espacio de la barra para que el contenido no salte.
  if (barra > 0) raiz.style.scrollbarGutter = 'stable';
}

export function liberarScroll() {
  if (!bloqueos || --bloqueos) return;
  const raiz = document.documentElement;
  if (estiloPrevio) raiz.setAttribute('style', estiloPrevio);
  else raiz.removeAttribute('style');
}

// --- Transiciones

export const reducirMovimiento = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fuerza un reflow para que la transición parta del estado actual. */
export const reflow = (el) => el.offsetHeight;

const segundos = (lista) => Math.max(...lista.split(',').map((v) => parseFloat(v) || 0));

/**
 * Llama a fn cuando termina la transición de el. Si no hay transición o la
 * persona pidió reducir el movimiento, la llama de inmediato.
 */
export function esperarTransicion(el, fn) {
  const estilo = getComputedStyle(el);
  const ms = (segundos(estilo.transitionDuration) + segundos(estilo.transitionDelay)) * 1000;
  if (!ms || reducirMovimiento()) return fn();
  let pendiente = true;
  const fin = (evento) => {
    if (!pendiente || (evento && evento.target !== el)) return;
    pendiente = false;
    clearTimeout(reloj);
    el.removeEventListener('transitionend', fin);
    fn();
  };
  el.addEventListener('transitionend', fin);
  const reloj = setTimeout(fin, ms + 50);
}

// --- Arranque

function alHacerClic(evento) {
  if (!esElemento(evento.target)) return;
  for (const [selector, fn] of clics) {
    const el = evento.target.closest(selector);
    if (el) fn(evento, el);
  }
}

function alPresionarTecla(evento) {
  if (evento.defaultPrevented || evento.isComposing) return;
  if (evento.key === 'Escape' && pilaEscape.length) {
    evento.preventDefault();
    pilaEscape.at(-1)(evento);
    return;
  }
  if (evento.key === 'Tab' && trampas.length) {
    const raiz = trampas.at(-1);
    const lista = enfocables(raiz);
    if (!lista.length) return evento.preventDefault();
    const [primero, ultimo] = [lista[0], lista.at(-1)];
    const activo = document.activeElement;
    if (!raiz.contains(activo) || activo === (evento.shiftKey ? primero : ultimo)) {
      evento.preventDefault();
      enfocar(evento.shiftKey ? ultimo : primero);
    }
  }
  if (evento.defaultPrevented || !esElemento(evento.target)) return;
  for (const [selector, fn] of teclas) {
    const el = evento.target.closest(selector);
    if (el) fn(evento, el);
  }
}

/** true si el elemento tiene disabled o aria-disabled="true". */
export const deshabilitado = (el) => el.disabled || el.getAttribute('aria-disabled') === 'true';

/**
 * Elemento que controla un disparador: el de data-ds-target (o el href="#id"
 * de un enlace) o, si no indica uno, el que lo contiene (closest(selector)).
 */
export function destinoDe(disparador, selector = null) {
  const href = disparador.tagName === 'A' ? disparador.getAttribute('href') : null;
  const objetivo = disparador.dataset.dsTarget || (href?.startsWith('#') && href.length > 1 ? href : null);
  if (!objetivo) return selector ? disparador.closest(selector) : null;
  try {
    return document.querySelector(objetivo);
  } catch {
    return null;
  }
}

// data-ds-toggle="<componente>": abre o cierra el componente indicado en
// data-ds-target o, si no hay, el que contiene al botón (p. ej. el .dropdown).
alClic('[data-ds-toggle]', (evento, disparador) => {
  const componente = componentes[disparador.dataset.dsToggle];
  if (!componente || deshabilitado(disparador)) return;
  const destino = destinoDe(disparador, componente.selector);
  if (!destino) return;
  if (disparador.tagName === 'A') evento.preventDefault();
  const instancia = componente.fabrica(destino);
  if (componente.alternar) instancia[componente.alternar](disparador);
  else if (instancia.toggle) instancia.toggle(disparador);
  else if (instancia.isOpen) instancia.close(disparador);
  else instancia.open(disparador);
});

// data-ds-dismiss="<componente>": cierra el componente que lo contiene
// (o el indicado en data-ds-target).
alClic('[data-ds-dismiss]', (evento, disparador) => {
  const componente = componentes[disparador.dataset.dsDismiss];
  if (!componente || deshabilitado(disparador)) return;
  const destino = disparador.dataset.dsTarget ? destinoDe(disparador) : disparador.closest(componente.selector);
  if (!destino) return;
  if (disparador.tagName === 'A') evento.preventDefault();
  componente.fabrica(destino).close(disparador);
});

/** Conecta los listeners en document. Es seguro llamarla varias veces o en el servidor. */
export function init() {
  if (typeof document === 'undefined' || document[MARCA]) return;
  document[MARCA] = version;
  document.addEventListener('click', alHacerClic);
  document.addEventListener('keydown', alPresionarTecla);
}

function quitar(lista, item) {
  const i = lista.lastIndexOf(item);
  if (i > -1) lista.splice(i, 1);
}
