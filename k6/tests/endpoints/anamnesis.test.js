/**
 * Anamnesis Endpoint Tests — EduTrace k6
 *
 * Endpoints testados:
 *   POST   /anamnesis
 *   GET    /anamnesis
 *   GET    /anamnesis/:email
 *   PATCH  /anamnesis/:email
 *   DELETE /anamnesis/:email
 *
 * ATENÇÃO: A API de anamnesis atualiza a fase do usuário (id_current_phase = 2).
 * Por isso, o usuário testado precisa existir no banco com fase 1 (Triagem já realizada).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { getToken, authHeaders } from '../../helpers/auth.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const token = getToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  return { token };
}

// Payload completo da anamnese baseado no CreateAnamnesisDto
function buildAnamnesisPayload(email) {
  return JSON.stringify({
    email,
    identification: {
      nome_unidade_plena: 'Escola Municipal Teste',
      serie_de_escolaridade_atual: '5º Ano',
      turma: 'A',
      curso: 'Ensino Fundamental',
      idade_iniciou_estudos: '6 anos',
      nome_completo: 'Estudante k6 Anamnese',
      data_de_nascimento: '01/01/2010',
      endereco: 'Rua dos Testes, 123',
      bairo: 'Bairro Teste',
      cep: '00000-000',
      municipio: 'Cidade Teste',
    },
    family_data: {
      nome_pai: 'Pai Teste',
      profissao_pai: 'Engenheiro',
      escolaridade_pai: 'Superior completo',
      idade_pai: '45 anos',
      nome_mae: 'Mãe Teste',
      profissao_mae: 'Professora',
      escolaridade_mae: 'Superior completo',
      idade_mae: '42 anos',
      outros_filhos: 'Não',
      uniao_pais: { casados: true, separados: false, separados_como_nova_estrutura_familia: false },
      reacao_estudante_situacao: 'Tranquilo',
      estudante_reside_com_quem: 'Pais',
      pais: { biologico: true, adotivo: false },
    },
    family_conditions: {
      moradia: { taipa: false, alvenaria: true, palafita: false },
      convivio_familiar: { excelente: true, bom: false, problematico: false, precario: false },
      medidas_disciplinares_com_estudante: 'Conversa',
      quem_usa_medidas_disciplinares: 'Pais',
      reacao_estudante_frente_medidas: 'Aceita bem',
      qualidade_comunicacao_com_estudante: { execelente: true, boa: false, ruim: false, pessima: false },
      reacao_contrariado: 'Fica quieto',
      condicao_ambiente_familiar_aprendizagem_escolar: 'Ótima',
    },
    mother_background: {
      gestacao: {
        transfusao_sanguinea_gravidez: 'Não',
        quando_sentiu_movimento_da_crianca: '4 meses',
        levou_tombo_durante_gravidez: 'Não',
        doenca_na_gestacao: 'Não',
        condicao_saude_da_mae_na_gravidez: 'Saudável',
        episodio_marcante_gravidez: 'Nenhum',
      },
      condicoes_nascimento: {
        nasceu_quantos_meses: '9 meses',
        nasceu_quantos_quilos: '3,5 quilos',
        nasceu_com_qual_comprimento: '50 cm',
        desenvolvimento_parto: 'Normal',
      },
      primeiras_reacoes: {
        chorou: 'Sim',
        ficou_vermelho_demais: 'Não',
        ficou_vermelho_por_quanto_tempo: 'Não ficou vermelho',
        precisou_de_oxigenio: 'Não',
        ficou_icterico: 'Não',
        como_era_quando_bebe: 'Tranquilo',
        qual_idade_afirmou_cabeca: '3 meses',
        qual_idade_sentou_sem_apoio: '6 meses',
        qual_idade_engatinhou: '8 meses',
        qual_idade_ficou_de_pe: '10 meses',
        qual_idade_andou: '12 meses',
      },
    },
    verbal_language_three_years: {
      balbuciou: true,
      primeiras_expressoes: 'Mamã, papá',
      trocou_letras: false,
      gaguejou: false,
    },
    development: {
      saude: {
        sofreu_acidente_ou_fez_cirurgia: 'Não',
        possui_alergia: 'Não',
        possui_bronquite_ou_asma: 'Não',
        possui_problema_visao_audicao: 'Não',
        ja_desmaiou: 'Não',
        quando_desmaiou: 'Nunca',
        teve_ou_tem_convulsoes: 'Não',
      },
      alimentacao: {
        foi_amamentada: 'Sim',
        foi_amementada_ate_quando: '6 meses',
        como_e_sua_alimentacao: 'Balanceada',
        foi_forcado_se_alimentar: 'Não',
        recebe_ajuda_na_alimentacao: 'Não',
      },
      sono: {
        dorme_bem: true,
        sono: { agitado: false, tranquilo: true, fala_dormindo: false, sonambulo: false },
        dorme_separado_dos_pais: true,
        com_quem_dorme: 'Sozinho',
      },
    },
    school_information: {
      historico_escolar_comum_antecedentes_relevantes: 'Nenhum',
      historico_escolar_especial_antecedentes_relevantes: 'Nenhum',
      deficiencia_apresentada_estudante: 'Física',
      retido_alguma_vez: 'Não',
      gosta_de_ir_escola: 'Sim',
      bem_aceito_pelos_amigous: 'Sim',
    },
    sexuality: {
      explanacao_sexual: false,
      curiosidade_sexual: false,
      conversa_com_pais_sobre_sexualidade: false,
    },
    student_assessment: {
      estudante_apresenta_outro_tipo_deficiencia: 'Não',
      apresenta_da_df_di_pc_tgd: false,
      se_sim_data_e_resultado_diagnostico: '',
      se_não_situacao_quanto_diagnostico_tem_outras_dificuldades: 'Nenhuma',
      se_tem_outras_dificuldades: 'Não',
      usa_medicamentos_controlados: false,
      usa_quais_medicamentos: '',
      medicamento_interfere_aprendizagem: false,
      se_intefere_aprendizagem: '',
      existem_recomendacoes_da_saude: false,
      se_possui_recomendacoes_da_saude: '',
    },
    student_development: {
      funcao_cognitiva: {
        percepcao: 'Normal',
        atencao: 'Normal',
        memoria: 'Normal',
        linguagem: 'Normal',
        raciocinio_logico: 'Normal',
      },
      funcao_motora: { desenvolvimento_e_capacidade_motora: 'Normal' },
      funcao_pressoal_social: { area_emocional_afetiva_social: 'Normal' },
    },
  });
}

export default function (data) {
  const headers = authHeaders(data.token);
  const testEmail = `k6.anamnesis.${Date.now()}.${Math.floor(Math.random() * 10000)}@test.com`;

  // ─── 1. POST /anamnesis ───────────────────────────────────────────────────
  const createRes = http.post(
    `${BASE_URL}/anamnesis`,
    buildAnamnesisPayload(testEmail),
    { headers },
  );
  check(createRes, {
    '[anamnesis] POST /anamnesis retorna 201': (r) => r.status === 201,
    '[anamnesis] POST /anamnesis retorna email correto': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.email === testEmail;
      } catch {
        return false;
      }
    },
  });

  // ─── 2. GET /anamnesis ────────────────────────────────────────────────────
  const listRes = http.get(`${BASE_URL}/anamnesis`, { headers });
  check(listRes, {
    '[anamnesis] GET /anamnesis retorna 200': (r) => r.status === 200,
    '[anamnesis] GET /anamnesis retorna array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  });

  // ─── 3. GET /anamnesis/:email ─────────────────────────────────────────────
  const getOneRes = http.get(`${BASE_URL}/anamnesis/${testEmail}`, { headers });
  check(getOneRes, {
    '[anamnesis] GET /anamnesis/:email retorna 200': (r) => r.status === 200,
  });

  // ─── 4. PATCH /anamnesis/:email ───────────────────────────────────────────
  const updateRes = http.patch(
    `${BASE_URL}/anamnesis/${testEmail}`,
    JSON.stringify({
      school_information: {
        historico_escolar_comum_antecedentes_relevantes: 'Atualizado pelo k6',
        historico_escolar_especial_antecedentes_relevantes: 'Atualizado pelo k6',
        deficiencia_apresentada_estudante: 'Visual',
        retido_alguma_vez: 'Não',
        gosta_de_ir_escola: 'Sim',
        bem_aceito_pelos_amigous: 'Sim',
      },
    }),
    { headers },
  );
  check(updateRes, {
    '[anamnesis] PATCH /anamnesis/:email retorna 200': (r) => r.status === 200,
  });

  // ─── 5. DELETE /anamnesis/:email ──────────────────────────────────────────
  const deleteRes = http.del(`${BASE_URL}/anamnesis/${testEmail}`, null, { headers });
  check(deleteRes, {
    '[anamnesis] DELETE /anamnesis/:email retorna 200': (r) => r.status === 200,
  });

  sleep(1);
}
