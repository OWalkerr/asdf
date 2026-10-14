import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Determinizm koruması (GDD §13.1, §13.7): sim ve shared kaynaklarında
 * platforma göre farklı sonuç verebilecek API'ler yasaktır.
 */
const FORBIDDEN: [RegExp, string][] = [
  [/Math\.random/, 'Math.random → Rng kullanın'],
  [/Date\.now|new Date\(|performance\.now/, 'zaman okuma → world.tick kullanın'],
  [
    /Math\.(sin|cos|tan|asin|acos|atan2?|exp|log\w*|pow|hypot|cbrt|sinh|cosh|tanh)\b/,
    'transandantal Math → fixed.ts',
  ],
  [/from ['"]three/, 'three importu → sim render bağımsız'],
  [/\bnew Float(32|64)Array/, 'float bileşen → Int32Array (Q16.16)'],
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });

describe('sim saflık kuralları', () => {
  const root = join(import.meta.dirname, '..', '..');
  const files = [...walk(join(root, 'sim', 'src')), ...walk(join(root, 'shared', 'src'))];

  it('kaynak dosyalar bulundu', () => expect(files.length).toBeGreaterThan(3));

  for (const file of files) {
    it(file.slice(root.length + 1), () => {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const [re, why] of FORBIDDEN) expect(re.test(code), why).toBe(false);
    });
  }
});
