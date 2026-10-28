# dsUIKit

UI Kit de la familia [Dreamsign](https://dreamsign.cl): CSS con variables `--ds-*`, temas que cambian colores y tipografías, y un JS liviano para los componentes interactivos.

**Documentación y ejemplos: [dsuikit.dreamsign.cl](https://dsuikit.dreamsign.cl)**

> Este repositorio se genera automáticamente con cada versión y no se edita a mano. Para reportar un problema o proponer algo, abre un [issue](https://github.com/DreamsignCL/ds-uikit/issues).

## Descarga

Descarga `ds-uikit-0.1.0-dist.zip` desde [Releases](https://github.com/DreamsignCL/ds-uikit/releases/latest). Trae:

| Archivo | Uso |
| --- | --- |
| `dist/ds-uikit.min.css` | Estilos del kit (`ds-uikit.css`, sin comprimir). |
| `dist/ds-uikit.min.js` | JS de los componentes interactivos para `<script>`, con el global `dsUIKit` (`ds-uikit.js`, sin comprimir). |
| `dist/ds-uikit.esm.js` | El mismo JS como módulo ES, para React, Vite y otros empaquetadores. |
| `themes/theme-dreamsign.css` | Tema Dreamsign. Sirve de plantilla para el tuyo. |
| `themes/theme-demo.css` | Tema de ejemplo. |

El código fuente (Sass en `src/scss` y módulos JS en `src/js`) está en este repositorio.

## Instalación

1. Copia `ds-uikit.min.css` y el tema de tu sitio en tu carpeta de estilos.
2. Carga primero el kit, después el tema y al final el CSS propio del sitio:

   ```html
   <link rel="stylesheet" href="/css/ds-uikit.min.css">
   <link rel="stylesheet" href="/css/theme.css">
   <link rel="stylesheet" href="/css/sitio.css">
   ```

3. Si usas componentes interactivos (cerrar un mensaje, modal, dropdown, collapse, tabs, toast), carga también el JS:

   ```html
   <script src="/js/ds-uikit.min.js" defer></script>
   ```

4. Usa las clases de los componentes, por ejemplo `<button type="button" class="btn btn--primary">`.

### React y empaquetadores

Instala la versión desde GitHub (necesita git):

```sh
npm install github:DreamsignCL/ds-uikit#v0.1.0
```

E impórtala una sola vez, en el punto de entrada (`main.jsx`):

```js
import 'ds-uikit/dist/ds-uikit.min.css';
import './css/theme.css';
import 'ds-uikit/dist/ds-uikit.esm.js';
```

Cada ejemplo de la documentación trae su versión React lista para copiar.

## CDN

[jsDelivr](https://www.jsdelivr.com) sirve los archivos directo desde este repositorio:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/DreamsignCL/ds-uikit@v0.1.0/dist/ds-uikit.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/DreamsignCL/ds-uikit@v0.1.0/themes/theme-dreamsign.css">
<script src="https://cdn.jsdelivr.net/gh/DreamsignCL/ds-uikit@v0.1.0/dist/ds-uikit.min.js" defer></script>
```

Usa siempre una versión fija (`@v0.1.0`): así una versión nueva no cambia tu sitio sin aviso.

## Temas

Cada sitio carga `ds-uikit.css` y después su `theme.css`. El tema **solo cambia colores y tipografías**; espacios, radios, sombras y tamaños son iguales en toda la familia.

- El tema va **sin** `@layer`, así siempre gana a los valores del kit (que van en capas).
- El kit no trae fuentes: por defecto usa la del sistema y cada tema carga la suya (`theme-dreamsign.css` carga Inter desde Google Fonts).
- Para crear uno, copia `theme-dreamsign.css` y cambia los valores de las variables `--ds-color-*` y `--ds-font-*`. Las que no cambies se pueden borrar.

```css
:root {
  --ds-color-primary: #0f766e;
  --ds-color-primary-hover: #115e59;
  --ds-font-family-base: "DM Sans", system-ui, sans-serif;
}
```

Todas las variables están en [Personalización](https://dsuikit.dreamsign.cl/personalizacion/).

## Navegadores

Chrome y Edge 111+, Firefox 113+ y Safari 16.2+ (soportan `@layer` y `color-mix()`).

## Licencia

[MIT](LICENSE) © Dreamsign
