// Vite's import.meta.glob, resolved at build time (vite/client types are not on the TS path here).
interface ImportMeta {
  glob<T = unknown>(pattern: string, options: { eager: true; import: 'default' }): Record<string, T>;
}
