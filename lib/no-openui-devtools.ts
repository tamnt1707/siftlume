/**
 * Turns off OpenUI's development auto-mounted Inspect widget. It loads its UI from a CDN
 * (jsDelivr), which Manifest V3 forbids (no remote code), so inside the extension it can only fail
 * and add console errors. react-lang checks this flag when its module is evaluated, so this file
 * must be imported before anything that imports @openuidev/react-lang.
 */
(globalThis as Record<symbol, unknown>)[Symbol.for('openui.devtools.autoMount')] = true;

export {};
