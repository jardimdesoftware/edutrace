import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONTROLE_EM_TEXTO } from './caracteres';

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
