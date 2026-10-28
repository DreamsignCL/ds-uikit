/*! dsUIKit v0.1.0 | MIT */
// src/js/core.js
const version = "0.1.0";
const MARCA = Symbol.for("dsUIKit");
const componentes = {};
const instancias = /* @__PURE__ */ new WeakMap();
const clics = [];
const teclas = [];
const pilaEscape = [];
const trampas = [];
const esElemento = (x) => typeof Element !== "undefined" && x instanceof Element;
/**
* Registra un componente y devuelve su fábrica: dsUIKit.<nombre>(el).
* La fábrica acepta un elemento o un selector y devuelve siempre la misma instancia.
* opciones.alternar: método que llama data-ds-toggle (p. ej. 'open' en el toast,
* que al repetirse reinicia el tiempo); por defecto, toggle() u open/close.
*/
function definir(nombre, selector, Clase, { alternar = null } = {}) {
	const fabrica = (el) => {
		if (typeof el === "string") el = document.querySelector(el);
		if (!esElemento(el)) return null;
		let mapa = instancias.get(el);
		if (!mapa) instancias.set(el, mapa = {});
		return mapa[nombre] ??= new Clase(el);
	};
	componentes[nombre] = {
		selector,
		fabrica,
		alternar
	};
	return fabrica;
}
/** Ejecuta fn(evento, elemento) al hacer clic en un elemento que coincide con el selector. */
function alClic(selector, fn) {
	clics.push([selector, fn]);
}
/** Ejecuta fn(evento, elemento) al presionar una tecla dentro de un elemento que coincide con el selector. */
function alTecla(selector, fn) {
	teclas.push([selector, fn]);
}
/**
* Emite ds:<tipo> en el elemento del componente (o en `el`, p. ej. el panel de
* unas tabs). detail: { component, instance, trigger }.
* Devuelve false si alguien llamó a preventDefault() (por defecto, solo open y close son cancelables).
*/
function emitir(instancia, tipo, trigger = null, { el = instancia.el, cancelable = tipo === "open" || tipo === "close" } = {}) {
	const evento = new CustomEvent(`ds:${tipo}`, {
		bubbles: true,
		cancelable,
		detail: {
			component: instancia.component,
			instance: instancia,
			trigger
		}
	});
	return el.dispatchEvent(evento);
}
/** Agrega fn a la pila de Escape. Devuelve la función para quitarla. */
function apilarEscape(fn) {
	pilaEscape.push(fn);
	return () => quitar(pilaEscape, fn);
}
const ENFOCABLES = [
	"a[href]",
	"area[href]",
	"button:not([disabled])",
	"input:not([disabled]):not([type=\"hidden\"])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"iframe",
	"audio[controls]",
	"video[controls]",
	"summary",
	"[contenteditable]:not([contenteditable=\"false\"])",
	"[tabindex]"
].join(",");
const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
/** Elementos enfocables con Tab dentro de raiz (por defecto, toda la página). */
function enfocables(raiz = document) {
	return [...raiz.querySelectorAll(ENFOCABLES)].filter((el) => el.tabIndex >= 0 && !el.closest("[hidden], [inert]") && visible(el));
}
/** Enfoca sin desplazar la página. */
function enfocar(el) {
	el?.focus({ preventScroll: true });
}
/** Mantiene el foco dentro de raiz al usar Tab. Devuelve la función para liberarlo. */
function atraparFoco(raiz) {
	trampas.push(raiz);
	return () => quitar(trampas, raiz);
}
/**
* Si el foco está dentro de el (que se va a ocultar), lo pasa al siguiente
* elemento enfocable de la página o, si no hay, al anterior.
*/
function rescatarFoco(el) {
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
function enfocarRegreso(el) {
	if (!el?.isConnected) return;
	enfocar(el);
	if (document.activeElement === el) return;
	enfocar(el.closest("[hidden]")?.parentElement?.querySelector("[aria-expanded]"));
}
let bloqueos = 0;
let estiloPrevio = "";
function bloquearScroll() {
	if (bloqueos++) return;
	const raiz = document.documentElement;
	const barra = window.innerWidth - raiz.clientWidth;
	estiloPrevio = raiz.getAttribute("style") || "";
	raiz.style.overflow = "hidden";
	if (barra > 0) raiz.style.scrollbarGutter = "stable";
}
function liberarScroll() {
	if (!bloqueos || --bloqueos) return;
	const raiz = document.documentElement;
	if (estiloPrevio) raiz.setAttribute("style", estiloPrevio);
	else raiz.removeAttribute("style");
}
const reducirMovimiento = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Fuerza un reflow para que la transición parta del estado actual. */
const reflow = (el) => el.offsetHeight;
const segundos = (lista) => Math.max(...lista.split(",").map((v) => parseFloat(v) || 0));
/**
* Llama a fn cuando termina la transición de el. Si no hay transición o la
* persona pidió reducir el movimiento, la llama de inmediato.
*/
function esperarTransicion(el, fn) {
	const estilo = getComputedStyle(el);
	const ms = (segundos(estilo.transitionDuration) + segundos(estilo.transitionDelay)) * 1e3;
	if (!ms || reducirMovimiento()) return fn();
	let pendiente = true;
	const fin = (evento) => {
		if (!pendiente || evento && evento.target !== el) return;
		pendiente = false;
		clearTimeout(reloj);
		el.removeEventListener("transitionend", fin);
		fn();
	};
	el.addEventListener("transitionend", fin);
	const reloj = setTimeout(fin, ms + 50);
}
function alHacerClic(evento) {
	if (!esElemento(evento.target)) return;
	for (const [selector, fn] of clics) {
		const el = evento.target.closest(selector);
		if (el) fn(evento, el);
	}
}
function alPresionarTecla(evento) {
	if (evento.defaultPrevented || evento.isComposing) return;
	if (evento.key === "Escape" && pilaEscape.length) {
		evento.preventDefault();
		pilaEscape.at(-1)(evento);
		return;
	}
	if (evento.key === "Tab" && trampas.length) {
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
const deshabilitado = (el) => el.disabled || el.getAttribute("aria-disabled") === "true";
/**
* Elemento que controla un disparador: el de data-ds-target (o el href="#id"
* de un enlace) o, si no indica uno, el que lo contiene (closest(selector)).
*/
function destinoDe(disparador, selector = null) {
	const href = disparador.tagName === "A" ? disparador.getAttribute("href") : null;
	const objetivo = disparador.dataset.dsTarget || (href?.startsWith("#") && href.length > 1 ? href : null);
	if (!objetivo) return selector ? disparador.closest(selector) : null;
	try {
		return document.querySelector(objetivo);
	} catch {
		return null;
	}
}
alClic("[data-ds-toggle]", (evento, disparador) => {
	const componente = componentes[disparador.dataset.dsToggle];
	if (!componente || deshabilitado(disparador)) return;
	const destino = destinoDe(disparador, componente.selector);
	if (!destino) return;
	if (disparador.tagName === "A") evento.preventDefault();
	const instancia = componente.fabrica(destino);
	if (componente.alternar) instancia[componente.alternar](disparador);
	else if (instancia.toggle) instancia.toggle(disparador);
	else if (instancia.isOpen) instancia.close(disparador);
	else instancia.open(disparador);
});
alClic("[data-ds-dismiss]", (evento, disparador) => {
	const componente = componentes[disparador.dataset.dsDismiss];
	if (!componente || deshabilitado(disparador)) return;
	const destino = disparador.dataset.dsTarget ? destinoDe(disparador) : disparador.closest(componente.selector);
	if (!destino) return;
	if (disparador.tagName === "A") evento.preventDefault();
	componente.fabrica(destino).close(disparador);
});
/** Conecta los listeners en document. Es seguro llamarla varias veces o en el servidor. */
function init() {
	if (typeof document === "undefined" || document[MARCA]) return;
	document[MARCA] = version;
	document.addEventListener("click", alHacerClic);
	document.addEventListener("keydown", alPresionarTecla);
}
function quitar(lista, item) {
	const i = lista.lastIndexOf(item);
	if (i > -1) lista.splice(i, 1);
}
// src/js/message.js
var Message = class {
	component = "message";
	constructor(el) {
		this.el = el;
		this._paso = 0;
	}
	/** true si el mensaje está visible (o apareciendo). */
	get isOpen() {
		return !this.el.hidden && !this.el.classList.contains("is-closing");
	}
	open(trigger = null) {
		const { el } = this;
		if (this.isOpen || !emitir(this, "open", trigger)) return;
		const paso = ++this._paso;
		el.classList.remove("is-closing");
		el.classList.add("is-opening");
		el.hidden = false;
		reflow(el);
		el.classList.remove("is-opening");
		esperarTransicion(el, () => paso === this._paso && emitir(this, "opened", trigger));
	}
	close(trigger = null) {
		const { el } = this;
		if (!this.isOpen || !emitir(this, "close", trigger)) return;
		const paso = ++this._paso;
		el.classList.remove("is-opening");
		el.classList.add("is-closing");
		esperarTransicion(el, () => {
			if (paso !== this._paso) return;
			rescatarFoco(el);
			el.hidden = true;
			el.classList.remove("is-closing");
			emitir(this, "closed", trigger);
		});
	}
};
const message = definir("message", ".message", Message);
// src/js/modal.js
const VENTANA = ".modal__dialog";
var Modal = class {
	component = "modal";
	constructor(el) {
		this.el = el;
		this._paso = 0;
		this._scroll = false;
		this._soltar = [];
		this._regreso = null;
		this._inicio = null;
		el.addEventListener("pointerdown", (evento) => {
			this._inicio = evento.target;
		});
	}
	get dialog() {
		return this.el.querySelector(VENTANA) || this.el;
	}
	/** true si el modal está abierto (o abriéndose). */
	get isOpen() {
		return !this.el.hidden && !this.el.classList.contains("is-closing");
	}
	open(trigger = null) {
		const { el } = this;
		if (this.isOpen || !emitir(this, "open", trigger)) return;
		const paso = ++this._paso;
		const activo = document.activeElement;
		this._regreso = trigger || (activo && activo !== document.body && !el.contains(activo) ? activo : null);
		this._inicio = null;
		if (!this._scroll) {
			bloquearScroll();
			this._scroll = true;
		}
		this._soltar = [apilarEscape(() => this.close()), atraparFoco(el)];
		el.classList.remove("is-closing");
		el.classList.add("is-opening");
		el.hidden = false;
		reflow(el);
		this._enfocarInicio();
		el.classList.remove("is-opening");
		esperarTransicion(this.dialog, () => paso === this._paso && emitir(this, "opened", trigger));
	}
	close(trigger = null) {
		const { el } = this;
		if (!this.isOpen || !emitir(this, "close", trigger)) return;
		const paso = ++this._paso;
		this._soltar.forEach((soltar) => soltar());
		this._soltar = [];
		const regreso = this._regreso;
		const activo = document.activeElement;
		this._regreso = null;
		if (!activo || activo === document.body || el.contains(activo)) {
			enfocarRegreso(regreso);
			if (el.contains(document.activeElement)) rescatarFoco(el);
		}
		el.classList.remove("is-opening");
		el.classList.add("is-closing");
		esperarTransicion(this.dialog, () => {
			if (paso !== this._paso) return;
			el.hidden = true;
			el.classList.remove("is-closing");
			if (this._scroll) {
				liberarScroll();
				this._scroll = false;
			}
			emitir(this, "closed", trigger);
		});
	}
	toggle(trigger = null) {
		if (this.isOpen) this.close(trigger);
		else this.open(trigger);
	}
	_enfocarInicio() {
		const { el } = this;
		const lista = enfocables(el);
		const destino = lista.find((x) => x.matches("[autofocus], [data-autofocus]")) || lista[0];
		if (destino) return enfocar(destino);
		if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
		enfocar(el);
	}
};
const modal = definir("modal", ".modal", Modal);
const enVentana = (el, nodo) => {
	const ventana = nodo instanceof Element ? nodo.closest(VENTANA) : null;
	return !!ventana && el.contains(ventana);
};
alClic(".modal", (evento, el) => {
	if (el.dataset.dsBackdrop === "static" || enVentana(el, evento.target)) return;
	const instancia = modal(el);
	if (!instancia.isOpen || enVentana(el, instancia._inicio)) return;
	instancia.close(evento.target);
});
// src/js/dropdown.js
const SELECTOR$2 = ".dropdown";
const BOTON$1 = "[data-ds-toggle=\"dropdown\"]";
const MENU = ".dropdown__menu";
const ITEM = ".dropdown__item";
const MARGEN = 8;
let abierto = null;
const habilitado = (item) => !deshabilitado(item) && !item.classList.contains("is-disabled");
const conModificador$1 = (evento) => evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey;
const editable = (el) => el.matches("input, textarea, select, [contenteditable]:not([contenteditable=\"false\"])");
function recortado(el) {
	for (let padre = el.parentElement; padre && padre !== document.body; padre = padre.parentElement) {
		const { overflowX, overflowY } = getComputedStyle(padre);
		if (overflowX !== "visible" || overflowY !== "visible") return true;
	}
	return false;
}
function desplazamientoY(el) {
	const transform = getComputedStyle(el).transform;
	return transform && transform !== "none" ? new DOMMatrixReadOnly(transform).m42 : 0;
}
var Dropdown = class {
	component = "dropdown";
	constructor(el) {
		this.el = el;
		this._paso = 0;
		this._soltar = [];
		this._boton = null;
		this._cuadro = 0;
		el.addEventListener("focusout", (evento) => {
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
		return !!menu && !menu.hidden && !menu.classList.contains("is-closing");
	}
	open(trigger = null) {
		const { menu } = this;
		if (!menu || this.isOpen || !emitir(this, "open", trigger)) return;
		if (abierto && abierto !== this) abierto.close();
		abierto = this;
		const paso = ++this._paso;
		if (trigger instanceof Element && trigger.matches(BOTON$1)) this._boton = trigger;
		this._expandir(true);
		this._soltar = [
			apilarEscape(() => this._cerrar(null, true)),
			this._seguir(),
			this._vigilarFuera()
		];
		menu.style.transition = "none";
		menu.classList.remove("is-closing");
		menu.classList.add("is-opening");
		menu.hidden = false;
		this._ubicar();
		reflow(menu);
		menu.style.transition = "";
		menu.classList.remove("is-opening");
		esperarTransicion(menu, () => paso === this._paso && emitir(this, "opened", trigger));
	}
	close(trigger = null) {
		this._cerrar(trigger, false);
	}
	toggle(trigger = null) {
		if (this.isOpen) this.close(trigger);
		else this.open(trigger);
	}
	_cerrar(trigger, regresar) {
		const { menu } = this;
		if (!this.isOpen || !emitir(this, "close", trigger)) return;
		const paso = ++this._paso;
		if (abierto === this) abierto = null;
		this._soltar.forEach((soltar) => soltar());
		this._soltar = [];
		const activo = document.activeElement;
		if (menu.contains(activo) || regresar && (!activo || activo === document.body)) enfocar(this._botonActual());
		rescatarFoco(menu);
		this._expandir(false);
		menu.classList.remove("is-opening");
		menu.classList.add("is-closing");
		esperarTransicion(menu, () => {
			if (paso !== this._paso) return;
			menu.hidden = true;
			menu.classList.remove("is-closing");
			this._limpiar();
			emitir(this, "closed", trigger);
		});
	}
	_botonActual() {
		return this._boton?.isConnected ? this._boton : this.el.querySelector(BOTON$1);
	}
	_expandir(abierta) {
		for (const boton of /* @__PURE__ */ new Set([this.el.querySelector(BOTON$1), this._boton])) boton?.setAttribute("aria-expanded", String(abierta));
	}
	/** Ítems habilitados y visibles del menú. */
	_items() {
		return [...this.menu.querySelectorAll(ITEM)].filter((item) => habilitado(item) && item.getClientRects().length);
	}
	_enfocarItem(indice) {
		enfocar(this._items().at(indice));
	}
	_vigilarFuera() {
		const fuera = (evento) => {
			const objetivo = evento.target;
			if (objetivo instanceof Node && !this.el.contains(objetivo) && !this._boton?.contains(objetivo)) this.close();
		};
		document.addEventListener("pointerup", fuera);
		return () => document.removeEventListener("pointerup", fuera);
	}
	_seguir() {
		const reubicar = () => {
			cancelAnimationFrame(this._cuadro);
			this._cuadro = requestAnimationFrame(() => this.isOpen && this._ubicar());
		};
		addEventListener("resize", reubicar);
		document.addEventListener("scroll", reubicar, {
			capture: true,
			passive: true
		});
		return () => {
			cancelAnimationFrame(this._cuadro);
			removeEventListener("resize", reubicar);
			document.removeEventListener("scroll", reubicar, { capture: true });
		};
	}
	_limpiar() {
		const estilo = this.menu?.style;
		if (estilo) for (const propiedad of [
			"position",
			"top",
			"right",
			"bottom",
			"left",
			"margin",
			"minWidth"
		]) estilo[propiedad] = "";
		this.el.classList.remove("is-flipped");
	}
	_ubicar() {
		const { el, menu } = this;
		const estilo = menu.style;
		this._limpiar();
		const css = getComputedStyle(menu);
		const separacion = parseFloat(css.marginTop) + parseFloat(css.marginBottom);
		const fijo = recortado(el);
		const ancla = el.getBoundingClientRect();
		if (fijo) {
			Object.assign(estilo, {
				position: "fixed",
				top: "0px",
				left: "0px",
				right: "auto",
				bottom: "auto",
				margin: "0px"
			});
			estilo.minWidth = `max(${ancla.width}px, var(--ds-dropdown-min-width))`;
		}
		const { offsetWidth: ancho, offsetHeight: alto } = menu;
		const { clientWidth: anchoVentana, clientHeight: altoVentana } = document.documentElement;
		const abajo = altoVentana - ancla.bottom - separacion - MARGEN;
		const arriba = ancla.top - separacion - MARGEN;
		const prefiereArriba = el.classList.contains("dropdown--up");
		const haciaArriba = prefiereArriba ? !(arriba < alto && abajo > arriba) : abajo < alto && arriba > abajo;
		el.classList.toggle("is-flipped", haciaArriba !== prefiereArriba);
		const deseado = menu.classList.contains("dropdown__menu--end") ? ancla.right - ancho : ancla.left;
		const x = Math.max(MARGEN, Math.min(deseado, anchoVentana - MARGEN - ancho));
		if (fijo) {
			const origen = menu.getBoundingClientRect();
			const y = haciaArriba ? ancla.top - separacion - alto : ancla.bottom + separacion;
			estilo.left = `${x - origen.left}px`;
			estilo.top = `${y - (origen.top - desplazamientoY(menu))}px`;
		} else if (Math.abs(x - deseado) > .5) {
			estilo.left = `${x - ancla.left}px`;
			estilo.right = "auto";
		}
	}
};
const dropdown = definir("dropdown", SELECTOR$2, Dropdown);
alClic(ITEM, (evento, item) => {
	const el = item.closest(MENU)?.closest(SELECTOR$2);
	if (!el) return;
	if (!habilitado(item)) return evento.preventDefault();
	const instancia = dropdown(el);
	if (instancia.isOpen) instancia._cerrar(item, true);
});
alTecla(BOTON$1, (evento, boton) => {
	const { key } = evento;
	if (key !== "ArrowDown" && key !== "ArrowUp" || conModificador$1(evento) || deshabilitado(boton)) return;
	const el = destinoDe(boton, SELECTOR$2);
	if (!el?.matches(SELECTOR$2)) return;
	evento.preventDefault();
	const instancia = dropdown(el);
	if (!instancia.isOpen) instancia.open(boton);
	instancia._enfocarItem(key === "ArrowDown" ? 0 : -1);
});
alTecla(MENU, (evento, menu) => {
	const { key } = evento;
	if (![
		"ArrowDown",
		"ArrowUp",
		"Home",
		"End"
	].includes(key) || conModificador$1(evento) || editable(evento.target)) return;
	const el = menu.closest(SELECTOR$2);
	if (!el) return;
	const instancia = dropdown(el);
	const items = instancia.isOpen ? instancia._items() : [];
	if (!items.length) return;
	evento.preventDefault();
	const actual = items.indexOf(evento.target.closest(ITEM));
	const ultimo = items.length - 1;
	let destino;
	if (key === "Home") destino = 0;
	else if (key === "End") destino = ultimo;
	else if (key === "ArrowDown") destino = actual < 0 ? 0 : Math.min(actual + 1, ultimo);
	else destino = actual < 0 ? ultimo : Math.max(actual - 1, 0);
	enfocar(items[destino]);
});
// src/js/collapse.js
const SELECTOR$1 = ".collapse";
const BOTON = "[data-ds-toggle=\"collapse\"]";
function contenedor(el, selector) {
	if (!selector) return null;
	try {
		return el.closest(selector) || document.querySelector(selector);
	} catch {
		return null;
	}
}
var Collapse = class {
	component = "collapse";
	constructor(el) {
		this.el = el;
		this._paso = 0;
	}
	/** true si el panel está abierto (o abriéndose). */
	get isOpen() {
		return !this.el.hidden && !this.el.classList.contains("is-closing");
	}
	open(trigger = null) {
		const { el } = this;
		if (this.isOpen || !emitir(this, "open", trigger)) return;
		const paso = ++this._paso;
		this._cerrarHermanos(trigger);
		this._expandir(true);
		const inicio = el.hidden ? 0 : el.getBoundingClientRect().height;
		el.classList.remove("is-closing");
		el.classList.add("is-opening");
		el.hidden = false;
		el.style.height = `${inicio}px`;
		reflow(el);
		el.style.height = `${el.scrollHeight}px`;
		esperarTransicion(el, () => {
			if (paso !== this._paso) return;
			el.classList.remove("is-opening");
			el.style.height = "";
			emitir(this, "opened", trigger);
		});
	}
	close(trigger = null) {
		const { el } = this;
		if (!this.isOpen || !emitir(this, "close", trigger)) return;
		const paso = ++this._paso;
		this._expandir(false);
		if (el.contains(document.activeElement)) enfocar(this._botones().find((boton) => boton.getClientRects().length));
		rescatarFoco(el);
		el.style.height = `${el.getBoundingClientRect().height}px`;
		el.classList.remove("is-opening");
		el.classList.add("is-closing");
		reflow(el);
		el.style.height = "0px";
		esperarTransicion(el, () => {
			if (paso !== this._paso) return;
			el.hidden = true;
			el.classList.remove("is-closing");
			el.style.height = "";
			emitir(this, "closed", trigger);
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
		for (const boton of this._botones()) boton.setAttribute("aria-expanded", String(abierto));
	}
	_cerrarHermanos(trigger) {
		const padre = contenedor(this.el, this.el.dataset.dsParent);
		if (!padre) return;
		for (const otro of padre.querySelectorAll(`${SELECTOR$1}[data-ds-parent]`)) if (otro !== this.el && contenedor(otro, otro.dataset.dsParent) === padre) collapse(otro).close(trigger);
	}
};
const collapse = definir("collapse", SELECTOR$1, Collapse);
// src/js/tabs.js
const SELECTOR = ".tabs";
const PESTANA = "[data-ds-toggle=\"tab\"]";
const conModificador = (evento) => evento.altKey || evento.ctrlKey || evento.metaKey;
const activable = (tab) => !deshabilitado(tab) && !!tab.getClientRects().length;
const panelDe = (tab) => {
	const id = tab?.getAttribute("aria-controls");
	return id ? document.getElementById(id) : null;
};
var Tabs = class {
	component = "tabs";
	constructor(el) {
		this.el = el;
		this._paso = 0;
		this._cortar = null;
	}
	/** Pestañas propias (sin las de unas tabs anidadas en un panel). */
	_tabs() {
		return [...this.el.querySelectorAll("[role=\"tab\"]")].filter((tab) => tab.closest(SELECTOR) === this.el);
	}
	_seleccionada() {
		return this._tabs().find((tab) => tab.getAttribute("aria-selected") === "true") ?? null;
	}
	/** Muestra la pestaña indicada (elemento o índice). La activa y las deshabilitadas no hacen nada. */
	show(destino, trigger = null) {
		const tabs = this._tabs();
		const tab = typeof destino === "number" ? tabs.at(destino) : tabs.find((t) => t === destino);
		const anterior = this._seleccionada();
		if (!tab || tab === anterior || deshabilitado(tab)) return;
		const nuevo = panelDe(tab);
		if (!emitir(this, "open", trigger, { el: nuevo ?? this.el })) return;
		this._cortar?.();
		const paso = ++this._paso;
		const viejo = panelDe(anterior);
		if (viejo) emitir(this, "close", trigger, {
			el: viejo,
			cancelable: false
		});
		for (const t of tabs) {
			const activa = t === tab;
			t.setAttribute("aria-selected", String(activa));
			if (activa) t.removeAttribute("tabindex");
			else t.setAttribute("tabindex", "-1");
		}
		if (viejo?.contains(document.activeElement)) enfocar(tab);
		const cerrar = () => {
			viejo.hidden = true;
			viejo.classList.remove("is-opening", "is-closing");
			emitir(this, "closed", trigger, { el: viejo });
		};
		const abrir = () => {
			this._cortar = null;
			if (!nuevo) return;
			nuevo.classList.remove("is-closing");
			nuevo.classList.add("is-opening");
			nuevo.hidden = false;
			reflow(nuevo);
			nuevo.classList.remove("is-opening");
			esperarTransicion(nuevo, () => paso === this._paso && emitir(this, "opened", trigger, { el: nuevo }));
		};
		if (viejo && !viejo.hidden) {
			viejo.classList.remove("is-opening");
			viejo.classList.add("is-closing");
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
};
const tabs = definir("tabs", SELECTOR, Tabs);
alClic(PESTANA, (evento, tab) => {
	const el = tab.closest(SELECTOR);
	if (!el || deshabilitado(tab)) return;
	if (tab.tagName === "A") evento.preventDefault();
	tabs(el).show(tab, tab);
});
alTecla(PESTANA, (evento, tab) => {
	const el = tab.closest(SELECTOR);
	if (!el || conModificador(evento)) return;
	const lista = tab.closest("[role=\"tablist\"]");
	const vertical = lista?.getAttribute("aria-orientation") === "vertical" || el.classList.contains("tabs--vertical");
	const rtl = !vertical && lista && getComputedStyle(lista).direction === "rtl";
	const [atras, adelante] = vertical ? ["ArrowUp", "ArrowDown"] : rtl ? ["ArrowRight", "ArrowLeft"] : ["ArrowLeft", "ArrowRight"];
	const { key } = evento;
	if (![
		atras,
		adelante,
		"Home",
		"End"
	].includes(key)) return;
	const instancia = tabs(el);
	const todas = instancia._tabs();
	const habilitadas = todas.filter(activable);
	if (!habilitadas.length) return;
	evento.preventDefault();
	let destino;
	if (key === "Home") destino = habilitadas[0];
	else if (key === "End") destino = habilitadas.at(-1);
	else {
		const paso = key === adelante ? 1 : -1;
		let i = todas.indexOf(tab);
		do
			i = (i + paso + todas.length) % todas.length;
		while (!activable(todas[i]));
		destino = todas[i];
	}
	enfocar(destino);
	instancia.show(destino, destino);
});
// src/js/toast.js
const DEMORA = 5e3;
var Toast = class {
	component = "toast";
	constructor(el) {
		this.el = el;
		this._paso = 0;
		this._reloj = null;
		this._restante = 0;
		this._fin = 0;
		this._encima = false;
		this._foco = false;
		this._origen = null;
		el.addEventListener("pointerenter", () => {
			this._encima = true;
			this._pausar();
		});
		el.addEventListener("pointerleave", () => {
			this._encima = false;
			this._seguir();
		});
		el.addEventListener("focusin", (evento) => {
			if (!el.contains(evento.relatedTarget)) this._origen = evento.relatedTarget;
			this._foco = true;
			this._pausar();
		});
		el.addEventListener("focusout", (evento) => {
			if (el.contains(evento.relatedTarget)) return;
			this._foco = false;
			this._seguir();
		});
	}
	/** true si el toast está visible (o apareciendo). */
	get isOpen() {
		return !this.el.hidden && !this.el.classList.contains("is-closing");
	}
	/** Muestra el toast. Si ya está abierto, reinicia el tiempo para cerrarse. */
	open(trigger = null) {
		if (this.isOpen) return this._reiniciar();
		const { el } = this;
		if (!emitir(this, "open", trigger)) return;
		const paso = ++this._paso;
		el.classList.remove("is-closing");
		el.classList.add("is-opening");
		el.hidden = false;
		reflow(el);
		el.classList.remove("is-opening");
		this._reiniciar();
		esperarTransicion(el, () => paso === this._paso && emitir(this, "opened", trigger));
	}
	close(trigger = null) {
		const { el } = this;
		if (!this.isOpen || !emitir(this, "close", trigger)) return;
		const paso = ++this._paso;
		this._detener();
		if (el.contains(document.activeElement)) {
			enfocarRegreso(this._origen);
			if (el.contains(document.activeElement)) rescatarFoco(el);
		}
		this._origen = null;
		el.classList.remove("is-opening");
		el.classList.add("is-closing");
		esperarTransicion(el, () => {
			if (paso !== this._paso) return;
			el.hidden = true;
			el.classList.remove("is-closing");
			this._encima = this._foco = false;
			emitir(this, "closed", trigger);
		});
	}
	toggle(trigger = null) {
		if (this.isOpen) this.close(trigger);
		else this.open(trigger);
	}
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
	_pausar() {
		if (!this._reloj) return;
		this._restante = Math.max(0, this._fin - Date.now());
		this._detener();
	}
	_seguir() {
		if (this._reloj || !this.isOpen || this._encima || this._foco || this.el.dataset.dsAutohide === "false") return;
		this._fin = Date.now() + this._restante;
		this._reloj = setTimeout(() => {
			this._reloj = null;
			this.close();
		}, this._restante);
	}
};
const toast = definir("toast", ".toast", Toast, { alternar: "open" });
// src/js/index.js
init();
export { collapse, dropdown, init, message, modal, tabs, toast, version };
