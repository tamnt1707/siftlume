#!/usr/bin/env node
// Checks every locale against English (the source): same keys, the plural forms each language
// needs (Intl.PluralRules / CLDR), the same {{placeholders}}, and no empty strings.
// Usage: pnpm check:i18n
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../locales/', import.meta.url).pathname;
const PLURAL = /_(zero|one|two|few|many|other)$/;
const placeholders = (s) => [...new Set(String(s).match(/\{\{\w+\}\}/g) ?? [])].sort().join(',');

const flat = (obj, prefix = '') =>
  Object.entries(obj).reduce((out, [k, v]) => {
    const key = prefix + k;
    return v && typeof v === 'object' ? { ...out, ...flat(v, key + '.') } : { ...out, [key]: v };
  }, {});

const namespaces = readdirSync(join(ROOT, 'en')).filter((f) => f.endsWith('.json'));
const languages = readdirSync(ROOT).filter((d) => d !== 'en');
let problems = 0;
const report = (msg) => {
  problems++;
  console.error('✗ ' + msg);
};

for (const file of namespaces) {
  const en = flat(JSON.parse(readFileSync(join(ROOT, 'en', file), 'utf8')));
  const bases = new Map();
  for (const k of Object.keys(en)) {
    const base = k.replace(PLURAL, '');
    bases.set(base, bases.get(base) || PLURAL.test(k));
  }

  for (const lng of languages) {
    let tr;
    try {
      tr = flat(JSON.parse(readFileSync(join(ROOT, lng, file), 'utf8')));
    } catch {
      report(`${lng}/${file}: missing or invalid JSON`);
      continue;
    }
    const categories = new Intl.PluralRules(lng).resolvedOptions().pluralCategories;
    const expected = new Set();
    for (const [base, plural] of bases) {
      if (plural) categories.forEach((c) => expected.add(`${base}_${c}`));
      else expected.add(base);
    }
    for (const k of expected) {
      if (!(k in tr)) report(`${lng}/${file}: missing "${k}"`);
      else {
        const source = en[k] ?? en[k.replace(PLURAL, '_other')];
        if (placeholders(source) !== placeholders(tr[k]))
          report(
            `${lng}/${file}: "${k}" placeholders ${placeholders(tr[k]) || '(none)'} ≠ ${placeholders(source) || '(none)'}`,
          );
        if (!String(tr[k]).trim()) report(`${lng}/${file}: "${k}" is empty`);
      }
    }
    for (const k of Object.keys(tr)) if (!expected.has(k)) report(`${lng}/${file}: unexpected key "${k}"`);
  }
}

if (problems) {
  console.error(`\n${problems} problem(s) in ${languages.length} locales.`);
  process.exit(1);
}
console.log(`✓ ${languages.length} locales × ${namespaces.length} namespaces match English.`);
