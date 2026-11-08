// Vite config for the README screenshot showcase (pnpm screenshots).
const here = (p) => new URL(p, import.meta.url).pathname.replace(/\/$/, '');
export default {
  root: here('.'),
  publicDir: here('../../public'),
  resolve: { alias: { '@': here('../..'), '#imports': here('./imports-stub.ts') } },
  server: { port: 5199, strictPort: true },
  logLevel: 'warn',
};
