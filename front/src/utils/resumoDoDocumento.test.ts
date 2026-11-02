import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resumoDoDocumento } from './resumoDoDocumento';

const formatar = (data: string) => `<${data}>`;

describe('resumoDoDocumento', () => {
  it('says when the document was created and by whom', () => {
    assert.equal(
      resumoDoDocumento('2026-10-01', '2026-10-01', 'Ana', formatar),
      'Criado em <2026-10-01>, por Ana.',
    );
  });

  it('adds the date of the last change only when the document was changed', () => {
    assert.equal(
      resumoDoDocumento('2026-10-01', '2026-10-05', 'Ana', formatar),
      'Criado em <2026-10-01>, atualizado em <2026-10-05>, por Ana.',
    );
  });

  it('leaves the author out when there is none', () => {
    assert.equal(resumoDoDocumento('2026-10-01', '2026-10-01', null, formatar), 'Criado em <2026-10-01>.');
    assert.equal(resumoDoDocumento('2026-10-01', '2026-10-01', '', formatar), 'Criado em <2026-10-01>.');
  });
});
