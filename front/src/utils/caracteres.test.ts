import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTROLE_EM_TEXTO,
  MARCAS_DEMAIS,
  removerControlesDeTexto,
} from './caracteres';

const ACENTO_AGUDO = String.fromCodePoint(0x0301);
const SINAL_VOGAL = String.fromCodePoint(0x093e);

describe('CONTROLE_EM_TEXTO', () => {
  it('matches the NUL, the other C0 controls, DEL and the C1 controls', () => {
    for (const controle of ['\u0000', '\u0007', '\u001b', '\u007f', '\u0085', '\u009f']) {
      assert.equal(CONTROLE_EM_TEXTO.test(`a${controle}b`), true);
    }
  });

  it('matches the vertical tab and the form feed, which are controls too', () => {
    assert.equal(CONTROLE_EM_TEXTO.test('a\u000bb'), true);
    assert.equal(CONTROLE_EM_TEXTO.test('a\u000cb'), true);
  });

  it('matches a lone surrogate, high or low', () => {
    assert.equal(CONTROLE_EM_TEXTO.test('a\uD800b'), true);
    assert.equal(CONTROLE_EM_TEXTO.test('a\uDC00b'), true);
  });

  it('does not match the tab, the line breaks, accents or an emoji', () => {
    assert.equal(CONTROLE_EM_TEXTO.test('Ação\tdo João\r\nsegunda linha\n😀 emoji'), false);
  });

  it('keeps no state between calls, so it is safe to share', () => {
    assert.equal(CONTROLE_EM_TEXTO.test('a\u0000b'), true);
    assert.equal(CONTROLE_EM_TEXTO.test('a\u0000b'), true);
  });
});

describe('MARCAS_DEMAIS', () => {
  it('accepts up to 30 combining marks in a row', () => {
    assert.equal(MARCAS_DEMAIS.test(`a${ACENTO_AGUDO.repeat(30)}`), false);
  });

  it('matches 31 combining marks in a row', () => {
    assert.equal(MARCAS_DEMAIS.test(`a${ACENTO_AGUDO.repeat(31)}`), true);
  });

  it('counts only the marks that are in a row: a letter between them restarts the count', () => {
    const duas = `a${ACENTO_AGUDO.repeat(20)}b${ACENTO_AGUDO.repeat(20)}`;

    assert.equal(MARCAS_DEMAIS.test(duas), false);
  });

  it('counts marks of other kinds too, such as the Devanagari vowel signs', () => {
    assert.equal(MARCAS_DEMAIS.test(`${String.fromCodePoint(0x0915)}${SINAL_VOGAL.repeat(31)}`), true);
  });
});

describe('removerControlesDeTexto', () => {
  it('removes every control and lone surrogate but keeps the tab and the line breaks', () => {
    assert.equal(
      removerControlesDeTexto('a\u0000b\u0085c\u007fd\uD800e\tf\r\ng\nh'),
      'abcde\tf\r\ng\nh',
    );
  });

  it('removes the vertical tab and the form feed', () => {
    assert.equal(removerControlesDeTexto('a\u000bb\u000cc'), 'abc');
  });

  it('returns the same text when there is nothing to remove', () => {
    assert.equal(removerControlesDeTexto('Ação 😀'), 'Ação 😀');
  });

  it('gives the same answer when called twice in a row', () => {
    const texto = 'a\u0000b\u0000c';

    assert.equal(removerControlesDeTexto(texto), 'abc');
    assert.equal(removerControlesDeTexto(texto), 'abc');
  });
});

const SRC_DIR = fileURLToPath(new URL('../', import.meta.url));

describe('definição única do caractere de controle', () => {
  function arquivosDeCodigo(pasta: string): string[] {
    return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
      const caminho = join(pasta, entrada.name);
      if (entrada.isDirectory()) return arquivosDeCodigo(caminho);

      return /\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)
        ? [caminho]
        : [];
    });
  }

  it('is written in caracteres.ts only: no other source file has its own copy', () => {
    const copias = arquivosDeCodigo(SRC_DIR).filter(
      (arquivo) =>
        !arquivo.endsWith('caracteres.ts') &&
        readFileSync(arquivo, 'utf8').includes('[\\p{Cc}\\p{Cs}]'),
    );

    assert.deepEqual(copias, []);
  });
});
