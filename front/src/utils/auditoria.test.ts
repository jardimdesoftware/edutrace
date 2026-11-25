import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  consultaDaAuditoria,
  csvDaAuditoria,
  linhasDasMudancas,
  rotuloDaEntidade,
  totalDePaginas,
} from './auditoria';

describe('auditoria', () => {
  it('sends only the filters that were filled', () => {
    assert.equal(consultaDaAuditoria({}), '');
    assert.equal(
      consultaDaAuditoria({ search: '  ana ', action: 'UPDATE', entity: 'User', page: 2 }),
      '?search=ana&action=UPDATE&entity=User&page=2',
    );
  });

  it('covers the whole chosen days, from 00:00 to 23:59:59.999 local time', () => {
    const params = new URLSearchParams(
      consultaDaAuditoria({ from: '2026-03-01', to: '2026-03-02' }),
    );

    assert.equal(params.get('from'), new Date('2026-03-01T00:00:00').toISOString());
    assert.equal(params.get('to'), new Date('2026-03-02T23:59:59.999').toISOString());
  });

  it('lists each changed field with the value before and after', () => {
    assert.deepEqual(
      linhasDasMudancas({
        full_name: { from: 'Ana', to: 'Bia' },
        roles: { from: [2], to: null },
      }),
      [
        { campo: 'full_name', de: 'Ana', para: 'Bia' },
        { campo: 'roles', de: '[2]', para: '(vazio)' },
      ],
    );
    assert.deepEqual(linhasDasMudancas(null), []);
  });

  it('shows ISO dates in the local pt-BR format and keeps other text as is', () => {
    const iso = '2026-11-24T22:44:21.167Z';

    assert.deepEqual(linhasDasMudancas({ created_at: { from: null, to: iso } }), [
      { campo: 'created_at', de: '(vazio)', para: new Date(iso).toLocaleString('pt-BR') },
    ]);
    assert.deepEqual(linhasDasMudancas({ name: { from: '2026-11-24', to: 'UFRPE' } }), [
      { campo: 'name', de: '2026-11-24', para: 'UFRPE' },
    ]);
  });

  it('names the tables in Portuguese and keeps unknown names', () => {
    assert.equal(rotuloDaEntidade('Comments'), 'Anotação');
    assert.equal(rotuloDaEntidade('Outra'), 'Outra');
  });

  it('exports the rows as CSV for Excel and neutralizes formulas (OWASP CSV Injection)', () => {
    const csv = csvDaAuditoria([
      {
        id: 7,
        created_at: '2026-11-24T22:44:21.167Z',
        action: 'UPDATE',
        entity: 'User',
        entity_id: 3,
        changes: { full_name: { from: 'Ana', to: 'Bia "B"' } },
        detail: null,
        succeeded: false,
        actor_id: 1,
        actor_name: '=HYPERLINK("http://x")',
        actor_email: '@a.com',
        method: 'PATCH',
        route: '/users/:id',
        ip: null,
      },
    ]);
    const [cabecalho, linha] = csv.split('\r\n');

    assert.ok(csv.startsWith('﻿"id";"quando";"acao"'));
    assert.ok(cabecalho.endsWith('"mudancas";"detalhe"'));
    assert.equal(
      linha,
      [
        '"7"', '"2026-11-24T22:44:21.167Z"', '"Alterou"', '"Usuário"', '"3"', '"não"', '"1"',
        `"'=HYPERLINK(""http://x"")"`, `"'@a.com"`, '"PATCH"', '"/users/:id"', '""',
        '"{""full_name"":{""from"":""Ana"",""to"":""Bia \\""B\\""""}}"', '""',
      ].join(';'),
    );
  });

  it('counts at least one page', () => {
    assert.equal(totalDePaginas({ total: 0, pageSize: 50 }), 1);
    assert.equal(totalDePaginas({ total: 101, pageSize: 50 }), 3);
  });
});
