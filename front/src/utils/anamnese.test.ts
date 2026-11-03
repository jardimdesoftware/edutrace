import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { camposDaTabela } from './formularioPorTabela';
import {
  LIMITES_ANAMNESE,
  SECOES_ANAMNESE,
  formularioDaAnamnese,
  formularioVazio,
  montarCorpo,
  validarFormulario,
} from './anamnese';
import { ANAMNESIS_EDIT_FIELDS } from './editPayload';
import { PESO_MAXIMO_DO_PASSO, passosDe, pesoDoPasso } from './passosDoFormulario';

// Cópia congelada do estado inicial que a tela de anamnese enviava antes dos
// passos (com os erros de digitação, que são o contrato com a API e com os
// registros gravados). Se a tabela mudar um caminho, o teste quebra.
const ESTADO_ANTIGO = {
  identification: { nome_unidade_plena: '', serie_de_escolaridade_atual: '', turma: '', curso: '', idade_iniciou_estudos: '', nome_completo: '', data_de_nascimento: '', endereco: '', bairo: '', cep: '', municipio: '' },
  family_data: { nome_pai: '', profissao_pai: '', escolaridade_pai: '', idade_pai: '', nome_mae: '', profissao_mae: '', escolaridade_mae: '', idade_mae: '', outros_filhos: '', uniao_pais: { casados: false, separados: false, separados_como_nova_estrutura_familia: false }, reacao_estudante_situacao: '', estudante_reside_com_quem: '', pais: { biologico: false, adotivo: false } },
  family_conditions: { moradia: { taipa: false, alvenaria: false, palafita: false }, convivio_familiar: { excelente: false, bom: false, problematico: false, precario: false }, medidas_disciplinares_com_estudante: '', quem_usa_medidas_disciplinares: '', reacao_estudante_frente_medidas: '', qualidade_comunicacao_com_estudante: { execelente: false, boa: false, ruim: false, pessima: false }, reacao_contrariado: '', condicao_ambiente_familiar_aprendizagem_escolar: '' },
  mother_background: { gestacao: { transfusao_sanguinea_gravidez: '', quando_sentiu_movimento_da_crianca: '', levou_tombo_durante_gravidez: '', doenca_na_gestacao: '', condicao_saude_da_mae_na_gravidez: '', episodio_marcante_gravidez: '' }, condicoes_nascimento: { nasceu_quantos_meses: '', nasceu_quantos_quilos: '', nasceu_com_qual_comprimento: '', desenvolvimento_parto: '' }, primeiras_reacoes: { chorou: '', ficou_vermelho_demais: '', ficou_vermelho_por_quanto_tempo: '', precisou_de_oxigenio: '', ficou_icterico: '', como_era_quando_bebe: '', qual_idade_afirmou_cabeca: '', qual_idade_sentou_sem_apoio: '', qual_idade_engatinhou: '', qual_idade_ficou_de_pe: '', qual_idade_andou: '' } },
  verbal_language_three_years: { balbuciou: false, primeiras_expressoes: '', trocou_letras: false, gaguejou: false },
  development: { saude: { sofreu_acidente_ou_fez_cirurgia: '', possui_alergia: '', possui_bronquite_ou_asma: '', possui_problema_visao_audicao: '', ja_desmaiou: '', quando_desmaiou: '', teve_ou_tem_convulsoes: '' }, alimentacao: { foi_amamentada: '', foi_amementada_ate_quando: '', como_e_sua_alimentacao: '', foi_forcado_se_alimentar: '', recebe_ajuda_na_alimentacao: '' }, sono: { dorme_bem: false, sono: { agitado: false, tranquilo: false, fala_dormindo: false, sonambulo: false }, dorme_separado_dos_pais: false, com_quem_dorme: '' } },
  school_information: { historico_escolar_comum_antecedentes_relevantes: '', historico_escolar_especial_antecedentes_relevantes: '', deficiencia_apresentada_estudante: '', retido_alguma_vez: '', gosta_de_ir_escola: '', bem_aceito_pelos_amigous: '' },
  sexuality: { explanacao_sexual: false, curiosidade_sexual: false, conversa_com_pais_sobre_sexualidade: false },
  student_assessment: { estudante_apresenta_outro_tipo_deficiencia: '', apresenta_da_df_di_pc_tgd: false, se_sim_data_e_resultado_diagnostico: '', se_não_situacao_quanto_diagnostico_tem_outras_dificuldades: '', se_tem_outras_dificuldades: '', usa_medicamentos_controlados: false, usa_quais_medicamentos: '', medicamento_interfere_aprendizagem: false, se_intefere_aprendizagem: '', existem_recomendacoes_da_saude: false, se_possui_recomendacoes_da_saude: '' },
  student_development: { funcao_cognitiva: { percepcao: '', atencao: '', memoria: '', linguagem: '', raciocinio_logico: '' }, funcao_motora: { desenvolvimento_e_capacidade_motora: '' }, funcao_pressoal_social: { area_emocional_afetiva_social: '' } },
};

function caminhosDasFolhas(valor: unknown, prefixo = ''): string[] {
  if (typeof valor !== 'object' || valor === null) return [prefixo];
  return Object.entries(valor).flatMap(([chave, filho]) =>
    caminhosDasFolhas(filho, prefixo ? `${prefixo}.${chave}` : chave),
  );
}

const CAMINHOS_ANTIGOS = caminhosDasFolhas(ESTADO_ANTIGO);
const CAMPOS = camposDaTabela(SECOES_ANAMNESE);

describe('SECOES_ANAMNESE', () => {
  it('declares exactly the paths of the form the page used to send, typos included', () => {
    const caminhos = CAMPOS.map((campo) => campo.caminho);

    assert.equal(new Set(caminhos).size, caminhos.length, 'there is a path declared twice');
    assert.deepEqual([...caminhos].sort(), [...CAMINHOS_ANTIGOS].sort());
  });

  it('keeps the paths with a typo that the API and the saved records use', () => {
    const caminhos = CAMPOS.map((campo) => campo.caminho);

    for (const comErro of [
      'identification.bairo',
      'family_conditions.qualidade_comunicacao_com_estudante.execelente',
      'development.alimentacao.foi_amementada_ate_quando',
      'school_information.bem_aceito_pelos_amigous',
      'student_assessment.se_não_situacao_quanto_diagnostico_tem_outras_dificuldades',
      'student_assessment.se_intefere_aprendizagem',
      'student_development.funcao_pressoal_social.area_emocional_afetiva_social',
    ]) {
      assert.ok(caminhos.includes(comErro), comErro);
    }
  });

  it('makes a checkbox of every boolean of the old form and a text of every string', () => {
    const antigos = Object.fromEntries(
      CAMINHOS_ANTIGOS.map((caminho) => [
        caminho,
        caminho
          .split('.')
          .reduce<unknown>((valor, chave) => (valor as Record<string, unknown>)[chave], ESTADO_ANTIGO),
      ]),
    );

    for (const campo of CAMPOS) {
      assert.equal(
        campo.tipo === 'marcacao',
        typeof antigos[campo.caminho] === 'boolean',
        campo.caminho,
      );
    }
  });

  it('starts from the empty form of the old state', () => {
    assert.deepEqual(formularioVazio(), ESTADO_ANTIGO);
  });

  it('gives every text a limit, the short ones 200 and the long ones 1000', () => {
    for (const campo of CAMPOS) {
      if (campo.tipo !== 'texto' && campo.tipo !== 'textoLongo') continue;
      assert.ok(
        campo.max === LIMITES_ANAMNESE.CURTO || campo.max === LIMITES_ANAMNESE.LONGO,
        campo.caminho,
      );
    }
  });

  it('forms steps that fit a screen', () => {
    const passos = passosDe(SECOES_ANAMNESE);

    assert.equal(passos.length, 13);
    for (const passo of passos) {
      assert.ok(pesoDoPasso(passo) <= PESO_MAXIMO_DO_PASSO, `${passo.rotulo}: ${pesoDoPasso(passo)}`);
    }
  });
});

describe('montarCorpo', () => {
  it('sends the ten sections the API accepts, and only them', () => {
    assert.deepEqual(Object.keys(montarCorpo(formularioVazio())).sort(), [...ANAMNESIS_EDIT_FIELDS].sort());
  });

  it('keeps the shape of the form, trimming the texts', () => {
    const form = formularioVazio();
    form.identification.nome_completo = '  Ana Souza  ';
    form.sexuality.curiosidade_sexual = true;

    const corpo = montarCorpo(form);

    assert.equal(corpo.identification.nome_completo, 'Ana Souza');
    assert.equal(corpo.sexuality.curiosidade_sexual, true);
    assert.equal(corpo.sexuality.explanacao_sexual, false);
  });

  it('fits in the 100 kb the server accepts with every text at its limit, in two-byte letters', () => {
    const cheio = JSON.parse(JSON.stringify(formularioVazio()));
    for (const campo of CAMPOS) {
      if (campo.tipo !== 'texto' && campo.tipo !== 'textoLongo') continue;
      const chaves = campo.caminho.split('.');
      const ultima = chaves.pop() as string;
      const pai = chaves.reduce((valor, chave) => valor[chave], cheio);
      pai[ultima] = 'ã'.repeat(campo.max);
    }

    const bytes = Buffer.byteLength(JSON.stringify({ ...montarCorpo(cheio), email: 'a@b.c' }));

    assert.ok(bytes <= 100 * 1024, `${bytes} bytes`);
  });
});

describe('formularioDaAnamnese', () => {
  it('fills the form with what the record has and ignores what the table does not list', () => {
    const registro = {
      ...ESTADO_ANTIGO,
      email: 'a@b.c',
      id: 7,
      created_at: '2026-01-01',
      identification: { ...ESTADO_ANTIGO.identification, nome_completo: 'Ana' },
    };

    const form = formularioDaAnamnese(registro as never);

    assert.equal(form.identification.nome_completo, 'Ana');
    assert.equal('email' in form, false);
    assert.equal('id' in form, false);
    assert.deepEqual(Object.keys(form).sort(), [...ANAMNESIS_EDIT_FIELDS].sort());
  });

  it('turns a missing or null value of an old record into blank text or an unchecked box', () => {
    const registro = { email: 'a@b.c', identification: { nome_completo: null } };

    const form = formularioDaAnamnese(registro as never);

    assert.equal(form.identification.nome_completo, '');
    assert.equal(form.sexuality.curiosidade_sexual, false);
  });
});

describe('validarFormulario', () => {
  it('lets the empty form be concluded: nothing in the anamnesis is required', () => {
    assert.deepEqual(validarFormulario(formularioVazio()), {});
  });

  it('refuses a text above its limit, naming the field', () => {
    const form = formularioVazio();
    form.identification.turma = 'a'.repeat(LIMITES_ANAMNESE.CURTO + 1);

    assert.match(validarFormulario(form)['identification.turma'], /no máximo 200 caracteres/);
  });
});
