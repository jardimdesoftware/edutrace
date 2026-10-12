import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { errorAlertOptions } from './errorAlert';

describe('errorAlertOptions', () => {
  it('puts the error message in text, which the alert never renders as HTML', () => {
    const options = errorAlertOptions(
      'Não foi possível vincular',
      new Error('<img src=x onerror=alert(1)>'),
      'Erro ao vincular a Conta Google.',
    );

    assert.deepEqual(options, {
      title: 'Não foi possível vincular',
      text: '<img src=x onerror=alert(1)>',
      icon: 'error',
    });
    assert.equal('html' in options, false);
  });

  it('uses the fallback when the error is not an Error', () => {
    assert.equal(
      errorAlertOptions('Título', 'falhou', 'Tente novamente.').text,
      'Tente novamente.',
    );
  });
});
