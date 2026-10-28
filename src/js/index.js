// Punto de entrada de ds-uikit.js. Cada componente con JS se exporta aquí y
// queda disponible como dsUIKit.<componente>(el) en la versión para <script>.
import { init } from './core.js';

export { version, init } from './core.js';
export { message } from './message.js';
export { modal } from './modal.js';
export { dropdown } from './dropdown.js';
export { collapse } from './collapse.js';
export { tabs } from './tabs.js';
export { toast } from './toast.js';

// Arranca solo en el navegador y una sola vez (aunque el archivo se cargue dos veces).
init();
