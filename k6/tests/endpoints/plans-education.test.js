/**
 * Plans Education Endpoint Tests — EduTrace k6
 *
 * Endpoints testados:
 *   POST   /plans-education
 *   GET    /plans-education
 *   GET    /plans-education/:email  (email do estudante)
 *   PATCH  /plans-education/:email
 *   DELETE /plans-education/:email
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { getToken, authHeaders } from '../../helpers/auth.js';
import { endpointOptions } from '../../config/options.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@edutrace.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'senhaSegura123';

export const options = endpointOptions;

export function setup() {
  const token = getToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  return { token };
}

function buildPlanPayload(studentEmail) {
  return JSON.stringify({
    professor_email: 'professor.k6@test.com',
    professor_name: 'Professor k6',
    student_email: studentEmail,
    student_name: 'Estudante k6',
    academic_semester: { primeiro_semestre: true, segundo_semestre: false },
    service_modality: {
      turma_regular: true,
      atendimento_pedagogico_domiciliar: false,
      atendimento_pedagogico_hospitalar: false,
    },
    support_service: {
      agente_educacao_especial_neuropsicopedagoro: true,
      interprete: false,
      instrutor: false,
      voluntario: false,
      outro: '',
    },
    skills: {
      atencao_em_sala_de_aula: true,
      interesse_ambiente_escolar: true,
      concentracao_atividades: true,
      memoria_auditiva_visual_sequencial: true,
      raciocinio_logico_matematico: true,
      sequencia_logica_fatos: true,
      interesse_por_objetos: false,
      exploracao_adequada_objetos: false,
      comparacao_associacao_classificacao: true,
      abstracao_conduta_simbolica: false,
      discriminacao_visual_auditiva_tatil: true,
      organizacao: true,
      nocao_autopreservacao_higiene: true,
      estrategias_aprendizado: true,
      planejamento_acoes: true,
      correcoes: true,
      julgamento_situacoes: true,
      relacionamento_social: true,
      autoestima_resistencia_frustracao: true,
      cooperacao_humor_agressividade: true,
      autoagressao: false,
      timidez_iniciativa_respeito: true,
      colaboracao_motivacao_isolamento: true,
      respeito_regras_rotina: true,
      iniciativa_social: true,
      comportamento_publico: true,
      permanencia_sala: true,
      foco_atividades: true,
      atencao_solicitacoes: true,
      compreensao_linguagem: true,
      comunicacao_nao_verbal: false,
      fala_inteligivel: true,
      adequacao_comunicacao: true,
      esforco_comunicacao: true,
      correspondencia_pensamento_fala: true,
      relato_experiencias: true,
      transmissao_recados: true,
      controle_salivacao: true,
      permanencia_sentado: true,
      locomocao: true,
      equilibrio_estatico_dinamico: true,
      dominancia_manual_esquema_corporal: true,
      discriminacao_direita_esquerda: true,
      coordenacao_motora_grossa_fina: true,
      coordenacao_grafomotora_visomotora: true,
      conceitos_basicos: true,
      agitacao_psicomotora: false,
      adequacao_postural: true,
      coordenacao_motora_equilibrio: true,
      alimentacao_independente: true,
    },
    resource_equipment_used: {
      reduzir_quantidade_material_atividade: true,
      provas_orais_escrita_minima: false,
      mais_tempo_conclusao_trabalhos: true,
      avaliacao_multipla_escolha: false,
      orientacoes_diretas_instrucoes_claras: true,
      nao_avaliar_caligrafia_ortografia: false,
      concentrar_notas_originalidade_ideias: false,
      encorajar_pratica_escrita: true,
      outro: '',
    },
    resource_equipment_needs: {
      acompanhante_sala_aula: false,
      adaptacao_metodologia_professor: true,
      compreensao_companheirismo_turma: true,
      outro: '',
    },
    curriculum_accessibility: {
      leitura_sem_entonacao: false,
      pronuncia_trocas_omissoes: false,
      confusao_palavras_parecidas: false,
      escrita_incorreta_ordem_letras: false,
      tempo_maior_trabalhos_escritos: true,
      disfuncao_linguagem_comunicacao: false,
      outro: '',
    },
    school_content: 'Matemática, Português e Ciências',
    activities_to_be_developed: {
      comunicacao_alternativa: false,
      informatica_acessivel: true,
      adequacao_material: true,
      outro: '',
    },
    objectives: 'Melhorar a compreensão de leitura e escrita',
    work_methodology: {
      aulas_praticas: true,
      aulas_expositivas_midia: true,
      dialogos: true,
      visitas_tecnicas: false,
      atividades_grupo: true,
      atividades_corte_colagem: false,
    },
    materials_used: {
      data_show: true,
      celular: false,
      cartolinas_pinceis: true,
      apostilas: true,
      artigos: false,
      tablet: false,
      outro: '',
    },
    evaluation_criteria: {
      participacao_coletiva: true,
      observacao_interacoes: true,
      atividades_paralelas: false,
      participacao_individual: true,
      uso_ferramentas_tecnologicas: false,
      fotos_videos_relatos: true,
      outro: '',
    },
  });
}

export default function (data) {
  const headers = authHeaders(data.token);
  const studentEmail = `k6.plan.${Date.now()}.${Math.floor(Math.random() * 10000)}@test.com`;

  // ─── 1. POST /plans-education ─────────────────────────────────────────────
  const createRes = http.post(
    `${BASE_URL}/plans-education`,
    buildPlanPayload(studentEmail),
    { headers },
  );
  check(createRes, {
    '[plans-education] POST retorna 201': (r) => r.status === 201,
    '[plans-education] POST retorna student_email correto': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.student_email === studentEmail;
      } catch {
        return false;
      }
    },
  });

  // ─── 2. GET /plans-education ──────────────────────────────────────────────
  const listRes = http.get(`${BASE_URL}/plans-education`, { headers });
  check(listRes, {
    '[plans-education] GET /plans-education retorna 200': (r) => r.status === 200,
    '[plans-education] GET /plans-education retorna array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  });

  // ─── 3. GET /plans-education/:email (por email do estudante) ─────────────
  const getOneRes = http.get(`${BASE_URL}/plans-education/${studentEmail}`, { headers });
  check(getOneRes, {
    '[plans-education] GET /plans-education/:email retorna 200': (r) => r.status === 200,
  });

  // ─── 4. PATCH /plans-education/:email ─────────────────────────────────────
  const updateRes = http.patch(
    `${BASE_URL}/plans-education/${studentEmail}`,
    JSON.stringify({ school_content: 'Conteúdo atualizado pelo k6', objectives: 'Objetivos atualizados' }),
    { headers },
  );
  check(updateRes, {
    '[plans-education] PATCH retorna 200': (r) => r.status === 200,
  });

  // ─── 5. DELETE /plans-education/:email ───────────────────────────────────
  const deleteRes = http.del(`${BASE_URL}/plans-education/${studentEmail}`, null, { headers });
  check(deleteRes, {
    '[plans-education] DELETE retorna 200': (r) => r.status === 200,
  });

  sleep(1);
}
