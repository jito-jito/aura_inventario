import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { withMermaid } from 'vitepress-plugin-mermaid';

const DOCS_ROOT = resolve(__dirname, '..');
const IGNORED_DIRS = new Set(['.vitepress', 'node_modules', 'public']);

/** Nombre legible de cada apartado. Una carpeta nueva sin entrada acá usa su propio nombre. */
const SECTION_TITLES: Record<string, string> = {
  arquitectura: 'Arquitectura',
  flujos: 'Flujos',
  frontend: 'Frontend',
  backend: 'Backend',
  infraestructura: 'Infraestructura',
  revisiones: 'Revisiones',
  ideas: 'Ideas',
};

/** Orden del sidebar; las carpetas que no figuran van al final, en orden alfabético. */
const SECTION_ORDER = Object.keys(SECTION_TITLES);

/** Toma el primer encabezado `# ...` del archivo como título; si no hay, el nombre del archivo. */
function readTitle(filePath: string, fallback: string): string {
  const match = /^#\s+(.+)$/m.exec(readFileSync(filePath, 'utf8'));
  return match ? match[1].replace(/`/g, '').trim() : fallback;
}

/**
 * Arma el sidebar a partir de las carpetas de docs/: cada carpeta es un apartado y
 * cada .md un documento. Así, agregar un documento no requiere tocar esta config.
 * Los documentos con fecha al inicio del nombre (AAAA-MM-DD-...) van del más nuevo
 * al más viejo; el resto, en orden alfabético.
 */
function buildSidebar() {
  const sections = readdirSync(DOCS_ROOT)
    .filter((name) => !IGNORED_DIRS.has(name) && statSync(join(DOCS_ROOT, name)).isDirectory())
    .sort((a, b) => {
      const ia = SECTION_ORDER.indexOf(a);
      const ib = SECTION_ORDER.indexOf(b);
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib) || a.localeCompare(b);
    });

  return sections
    .map((dir) => {
      const files = readdirSync(join(DOCS_ROOT, dir)).filter((f) => f.endsWith('.md'));
      const dated = files.every((f) => /^\d{4}-\d{2}-\d{2}-/.test(f));
      files.sort((a, b) => (dated ? b.localeCompare(a) : a.localeCompare(b)));

      return {
        text: SECTION_TITLES[dir] ?? dir,
        collapsed: false,
        items: files.map((file) => {
          const name = file.replace(/\.md$/, '');
          const link = name === 'README' || name === 'index' ? `/${dir}/` : `/${dir}/${name}`;
          return { text: readTitle(join(DOCS_ROOT, dir, file), name), link };
        }),
      };
    })
    .filter((section) => section.items.length > 0);
}

export default withMermaid({
  title: 'Aura Inventario',
  description: 'Documentación técnica y funcional de Aura Inventario',
  lang: 'es',
  cleanUrls: true,
  // README.md se mantiene como índice para que GitHub lo muestre al abrir docs/;
  // acá se publica como página de inicio. Lo mismo para el README.md de cada apartado.
  rewrites: {
    'README.md': 'index.md',
    ':dir/README.md': ':dir/index.md',
  },
  srcExclude: ['**/node_modules/**'],
  // mermaid importa `fastdom`, que es CommonJS: sin pre-empaquetarlo, `npm run dev`
  // muestra la página en blanco ("does not provide an export named 'default'").
  // El build de producción no tiene este problema.
  vite: {
    optimizeDeps: { include: ['mermaid > fastdom', 'mermaid > fastdom/extensions/fastdom-promised.js'] },
  },
  themeConfig: {
    nav: [{ text: 'Inicio', link: '/' }],
    sidebar: buildSidebar(),
    outline: { level: [2, 3], label: 'En esta página' },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
          modal: {
            noResultsText: 'Sin resultados para',
            resetButtonTitle: 'Limpiar búsqueda',
            footer: { selectText: 'abrir', navigateText: 'moverse', closeText: 'cerrar' },
          },
        },
      },
    },
    sidebarMenuLabel: 'Menú',
    returnToTopLabel: 'Volver arriba',
    darkModeSwitchLabel: 'Tema',
    docFooter: { prev: 'Anterior', next: 'Siguiente' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/jito-jito/aura_inventario' }],
  },
});
