import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { anuncioDoContador, textoDoContador } from './contadorDeCaracteres';

describe('textoDoContador', () => {
  it('prints the size and the limit', () => {
    assert.equal(textoDoContador(0, 2000), '0 de 2000 caracteres');
    assert.equal(textoDoContador(1250, 2000), '1250 de 2000 caracteres');
    assert.equal(textoDoContador(2000, 2000), '2000 de 2000 caracteres');
  });
});

describe('anuncioDoContador', () => {
  it('stays silent while the text is far from the limit', () => {
    for (const tamanho of [0, 1, 1000, 1799]) {
      assert.equal(anuncioDoContador(tamanho, 2000), '', String(tamanho));
    }
  });

  it('warns once, with the same text, from 90% of the limit until the limit', () => {
    const avisos = new Set([1800, 1850, 1999].map((tamanho) => anuncioDoContador(tamanho, 2000)));

    assert.deepEqual([...avisos], ['Você está perto do limite de 2000 caracteres.']);
  });

  it('announces the limit when it is reached', () => {
    assert.equal(anuncioDoContador(2000, 2000), 'Limite de 2000 caracteres atingido.');
  });

  it('announces the limit for a size above it, as a text loaded from the API could have', () => {
    assert.equal(anuncioDoContador(2100, 2000), 'Limite de 2000 caracteres atingido.');
  });

  it('follows the limit of each field', () => {
    assert.equal(anuncioDoContador(45, 50), 'Você está perto do limite de 50 caracteres.');
    assert.equal(anuncioDoContador(44, 50), '');
  });
});
