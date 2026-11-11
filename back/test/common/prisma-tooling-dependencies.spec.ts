import { readFileSync } from 'fs';
import { builtinModules } from 'module';
import { join } from 'path';

const BACK_ROOT = join(__dirname, '..', '..');
const TOOLING_FILES = ['prisma.config.ts', 'prisma/seed.ts'];

function packageName(specifier: string): string {
  const [scopeOrName, scopedName] = specifier.split('/');
  return scopeOrName.startsWith('@')
    ? `${scopeOrName}/${scopedName}`
    : scopeOrName;
}

function importedPackages(file: string): string[] {
  const source = readFileSync(join(BACK_ROOT, file), 'utf8');
  const specifiers = [
    ...source.matchAll(/^\s*import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/gm),
  ].map((match) => match[1]);

  return specifiers
    .filter((specifier) => !specifier.startsWith('.'))
    .map(packageName)
    .filter((name) => !builtinModules.includes(name.replace(/^node:/, '')));
}

describe('dependências do prisma.config.ts e do seed', () => {
  const manifest = JSON.parse(
    readFileSync(join(BACK_ROOT, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);

  it.each(TOOLING_FILES)(
    'should declare in package.json every package imported by %s',
    (file) => {
      const undeclared = importedPackages(file).filter(
        (name) => !declared.has(name),
      );

      expect(undeclared).toEqual([]);
    },
  );

  it('should detect the dotenv import of prisma.config.ts', () => {
    expect(importedPackages('prisma.config.ts')).toContain('dotenv');
  });
});
