import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const srcDir = new URL('../src/', import.meta.url);
const CANDIDATES = ['', '.ts', '/index.ts'];

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

function localTarget(specifier, parentURL) {
  if (specifier.startsWith('@/')) {
    return new URL(specifier.slice(2), srcDir);
  }

  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');

  if (isRelative && parentURL?.startsWith('file:')) {
    return new URL(specifier, parentURL);
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const target = localTarget(specifier, context.parentURL);

  if (!target) {
    return nextResolve(specifier, context);
  }

  const match = CANDIDATES.map((suffix) => new URL(target.href + suffix)).find(
    isFile,
  );

  return nextResolve(match ? match.href : target.href, context);
}
