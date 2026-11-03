import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { camposDaTabela } from './formularioPorTabela';
import { SCREENING_EDIT_FIELDS } from './editPayload';
import { PESO_MAXIMO_DO_PASSO, passosDe, pesoDoPasso } from './passosDoFormulario';
import {
  LIMITES_TRIAGEM,
  SECOES_TRIAGEM,
  formularioDaTriagem,
  formularioVazio,
  montarCorpo,
  validarFormulario,
} from './triagem';

// Cópia congelada do estado inicial que a tela de triagem enviava antes dos
// passos, sem o nome e o e-mail (do estudante da URL) e sem o atendimento
// especializado (que nenhuma tela pede). Se a tabela mudar um caminho, o teste
// quebra.
const ESTADO_ANTIGO = {
  report: '',
  specific_need: {
    deficiencia_fisica: false,
    deficiencia_auditiva: false,
    baixa_visao: false,
    cegueira: false,
    surdocegueira: false,
    transtornos_globais_de_desenvolvimento: false,
    superdotacao: false,
    disturbio_de_aprendizagem: false,
    outros: '',
  },
  physical_disability: { necessita_de_transcritor: false, acesso_para_cadeirante: false, outros: '' },
  visual_impairment: {
    necessita_de_braille: false,
    material_com_fonte_aumentada: false,
    necessita_de_transcritor: false,
    outros: '',
  },
  hearing_impairment: {
    necessita_de_interprete_de_lingua_de_sinais: false,
    necessita_de_interprete_oralizador: false,
    outros: '',
  },
  global_disorder: { necessita_de_ledor: false, necessita_de_transcritor: false, outros: '' },
  other_disabilities: '',
};

function caminhosDasFolhas(valor: unknown, prefixo = ''): string[] {
  if (typeof valor !== 'object' || valor === null) return [prefixo];
  return Object.entries(valor).flatMap(([chave, filho]) =>
    caminhosDasFolhas(filho, prefixo ? `${prefixo}.${chave}` : chave),
  );
}

const CAMPOS = camposDaTabela(SECOES_TRIAGEM);

describe('SECOES_TRIAGEM', () => {
  it('declares exactly the paths of the form the page used to send', () => {
    const caminhos = CAMPOS.map((campo) => campo.caminho);

    assert.equal(new Set(caminhos).size, caminhos.length, 'there is a path declared twice');
    assert.deepEqual([...caminhos].sort(), caminhosDasFolhas(ESTADO_ANTIGO).sort());
  });

  it('starts from the empty form of the old state', () => {
    assert.deepEqual(formularioVazio(), ESTADO_ANTIGO);
  });

  it('makes a checkbox of every option and a text of the others, with a limit each', () => {
    for (const campo of CAMPOS) {
      if (campo.tipo === 'marcacao') continue;
      assert.ok(campo.tipo === 'texto' || campo.tipo === 'textoLongo', campo.caminho);
      assert.ok(
        campo.max === LIMITES_TRIAGEM.CURTO || campo.max === LIMITES_TRIAGEM.LONGO,
        campo.caminho,
      );
    }
    assert.equal(CAMPOS.filter((campo) => campo.tipo === 'marcacao').length, 17);
  });

  it('forms three steps that fit a screen', () => {
    const passos = passosDe(SECOES_TRIAGEM);

    assert.deepEqual(
      passos.map((passo) => passo.rotulo),
      [
        'Necessidade específica',
        'Deficiências física, visual e auditiva',
        'Transtornos globais e outros casos',
      ],
    );
    for (const passo of passos) {
      assert.ok(pesoDoPasso(passo) <= PESO_MAXIMO_DO_PASSO, `${passo.rotulo}: ${pesoDoPasso(passo)}`);
    }
  });
});

describe('montarCorpo', () => {
  it('sends only fields the API accepts in the update, and not the name or the special service', () => {
    const chaves = Object.keys(montarCorpo(formularioVazio()));

    assert.deepEqual(chaves.sort(), [
      'global_disorder',
      'hearing_impairment',
      'other_disabilities',
      'physical_disability',
      'report',
      'specific_need',
      'visual_impairment',
    ]);
    for (const chave of chaves) {
      assert.ok((SCREENING_EDIT_FIELDS as readonly string[]).includes(chave), chave);
    }
  });

  it('keeps the checkboxes and trims the texts', () => {
    const form = formularioVazio();
    form.report = '  Laudo do CAPS  ';
    form.visual_impairment.necessita_de_braille = true;

    const corpo = montarCorpo(form);

    assert.equal(corpo.report, 'Laudo do CAPS');
    assert.equal(corpo.visual_impairment.necessita_de_braille, true);
    assert.equal(corpo.visual_impairment.necessita_de_transcritor, false);
  });
});

describe('formularioDaTriagem', () => {
  it('fills the form with what the record has and ignores the name, the e-mail and the special service', () => {
    const registro = {
      ...ESTADO_ANTIGO,
      full_name: 'Ana',
      email: 'a@b.c',
      special_service: true,
      report: 'Laudo',
    };

    const form = formularioDaTriagem(registro);

    assert.equal(form.report, 'Laudo');
    assert.equal('full_name' in form, false);
    assert.equal('email' in form, false);
    assert.equal('special_service' in form, false);
  });

  it('turns a missing value of an old record into blank text or an unchecked box', () => {
    const form = formularioDaTriagem({ email: 'a@b.c', specific_need: { outros: null } } as never);

    assert.equal(form.specific_need.outros, '');
    assert.equal(form.specific_need.cegueira, false);
  });
});

describe('validarFormulario', () => {
  it('lets the empty form be concluded: nothing in the screening is required', () => {
    assert.deepEqual(validarFormulario(formularioVazio()), {});
  });

  it('refuses a text above its limit, naming the field', () => {
    const form = formularioVazio();
    form.specific_need.outros = 'a'.repeat(LIMITES_TRIAGEM.CURTO + 1);

    assert.match(validarFormulario(form)['specific_need.outros'], /no máximo 200 caracteres/);
  });
});
