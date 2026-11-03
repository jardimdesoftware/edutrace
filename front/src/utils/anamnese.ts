// A anamnese em passos: a tabela de seções diz quais campos existem, e daqui
// saem o formulário vazio, o formulário de um registro, o corpo da API e a
// leitura. Os caminhos são exatamente os do formulário que a tela sempre enviou,
// inclusive os com erro de digitação ("bairo", "execelente", "pressoal"...): são
// o contrato com a API e com os registros já gravados.
import type { AnamnesisData } from '@/interfaces/AnamnesisData';
import {
  formularioDoRegistro,
  formularioVazioDe,
  marcacao,
  montarCorpoDe,
  texto,
  textoLongo,
  validarFormularioDe,
  type CampoDef,
  type ErrosDoFormulario,
  type Formulario,
  type GrupoDef,
  type SecaoDef,
} from './formularioPorTabela';

// A API não limita o tamanho dos campos da anamnese; estes limites vêm do
// front, e o teste garante que o corpo inteiro cabe nos 100 kb que o servidor
// aceita.
export const LIMITES_ANAMNESE = {
  CURTO: 200,
  LONGO: 1000,
} as const;

export type AnamnesePayload = Omit<AnamnesisData, 'email'>;
export type AnamneseForm = Formulario<AnamnesePayload>;

const curto = (caminho: string, rotulo: string): CampoDef =>
  texto(caminho, rotulo, LIMITES_ANAMNESE.CURTO);
const longo = (caminho: string, rotulo: string): CampoDef =>
  textoLongo(caminho, rotulo, LIMITES_ANAMNESE.LONGO);

function opcoes(titulo: string, campos: CampoDef[]): GrupoDef {
  return { titulo, lista: true, campos };
}

export const SECOES_ANAMNESE: readonly SecaoDef[] = [
  {
    titulo: 'Identificação',
    grupos: [
      {
        campos: [
          curto('identification.nome_unidade_plena', 'Nome da unidade plena'),
          curto('identification.nome_completo', 'Nome completo'),
          curto('identification.data_de_nascimento', 'Data de nascimento'),
          curto('identification.endereco', 'Endereço'),
          curto('identification.bairo', 'Bairro'),
          curto('identification.cep', 'CEP'),
          curto('identification.municipio', 'Município'),
          curto('identification.curso', 'Curso'),
          curto('identification.serie_de_escolaridade_atual', 'Série de escolaridade atual'),
          curto('identification.turma', 'Turma'),
          curto('identification.idade_iniciou_estudos', 'Idade que iniciou os estudos'),
        ],
      },
    ],
  },
  {
    titulo: 'Dados familiares',
    grupos: [
      {
        campos: [
          curto('family_data.nome_pai', 'Nome do pai'),
          curto('family_data.profissao_pai', 'Profissão do pai'),
          curto('family_data.escolaridade_pai', 'Escolaridade do pai'),
          curto('family_data.idade_pai', 'Idade do pai'),
          curto('family_data.nome_mae', 'Nome da mãe'),
          curto('family_data.profissao_mae', 'Profissão da mãe'),
          curto('family_data.escolaridade_mae', 'Escolaridade da mãe'),
          curto('family_data.idade_mae', 'Idade da mãe'),
          curto('family_data.outros_filhos', 'Outros filhos'),
        ],
      },
      opcoes('União dos pais', [
        marcacao('family_data.uniao_pais.casados', 'Casados'),
        marcacao('family_data.uniao_pais.separados', 'Separados'),
        marcacao(
          'family_data.uniao_pais.separados_como_nova_estrutura_familia',
          'Separados como uma nova estrutura familiar',
        ),
      ]),
      opcoes('Pais', [
        marcacao('family_data.pais.biologico', 'Biológico'),
        marcacao('family_data.pais.adotivo', 'Adotivo'),
      ]),
      {
        campos: [
          curto(
            'family_data.estudante_reside_com_quem',
            'Em caso de separação, o estudante vive com quem?',
          ),
          longo('family_data.reacao_estudante_situacao', 'Reação do estudante à situação'),
        ],
      },
    ],
  },
  {
    titulo: 'Condições familiares do estudante',
    grupos: [
      opcoes('Condições de moradia', [
        marcacao('family_conditions.moradia.taipa', 'Taipa'),
        marcacao('family_conditions.moradia.alvenaria', 'Alvenaria'),
        marcacao('family_conditions.moradia.palafita', 'Palafita'),
      ]),
      opcoes('Convívio familiar', [
        marcacao('family_conditions.convivio_familiar.excelente', 'Excelente'),
        marcacao('family_conditions.convivio_familiar.bom', 'Bom'),
        marcacao('family_conditions.convivio_familiar.problematico', 'Problemático'),
        marcacao('family_conditions.convivio_familiar.precario', 'Precário'),
      ]),
      opcoes('Qualidade de comunicação', [
        marcacao('family_conditions.qualidade_comunicacao_com_estudante.execelente', 'Excelente'),
        marcacao('family_conditions.qualidade_comunicacao_com_estudante.boa', 'Boa'),
        marcacao('family_conditions.qualidade_comunicacao_com_estudante.ruim', 'Ruim'),
        marcacao('family_conditions.qualidade_comunicacao_com_estudante.pessima', 'Péssima'),
      ]),
    ],
  },
  {
    titulo: 'Medidas disciplinares e ambiente familiar',
    grupos: [
      {
        campos: [
          longo(
            'family_conditions.medidas_disciplinares_com_estudante',
            'Que medidas disciplinares normalmente são usadas com o estudante',
          ),
          curto('family_conditions.quem_usa_medidas_disciplinares', 'Quem as usa'),
          longo(
            'family_conditions.reacao_estudante_frente_medidas',
            'Quais as reações do estudante frente a essas medidas',
          ),
          curto('family_conditions.reacao_contrariado', 'Como reage quando contrariado'),
          longo(
            'family_conditions.condicao_ambiente_familiar_aprendizagem_escolar',
            'Condições do ambiente familiar para a aprendizagem escolar',
          ),
        ],
      },
    ],
  },
  {
    titulo: 'Gestação',
    grupos: [
      {
        campos: [
          curto('mother_background.gestacao.transfusao_sanguinea_gravidez', 'Transfusão sanguínea na gravidez'),
          curto(
            'mother_background.gestacao.quando_sentiu_movimento_da_crianca',
            'Quando sentiu movimento da criança',
          ),
          curto('mother_background.gestacao.levou_tombo_durante_gravidez', 'Levou tombo durante a gravidez'),
          longo('mother_background.gestacao.doenca_na_gestacao', 'Doença na gestação'),
          longo(
            'mother_background.gestacao.condicao_saude_da_mae_na_gravidez',
            'Condição de saúde da mãe na gravidez',
          ),
          longo('mother_background.gestacao.episodio_marcante_gravidez', 'Episódio marcante na gravidez'),
        ],
      },
    ],
  },
  {
    titulo: 'Condições de nascimento',
    passo: 'Nascimento e primeiras reações',
    grupos: [
      {
        campos: [
          curto('mother_background.condicoes_nascimento.nasceu_quantos_meses', 'Nasceu com quantos meses'),
          curto('mother_background.condicoes_nascimento.nasceu_quantos_quilos', 'Nasceu com quantos quilos'),
          curto(
            'mother_background.condicoes_nascimento.nasceu_com_qual_comprimento',
            'Nasceu com qual comprimento',
          ),
          longo('mother_background.condicoes_nascimento.desenvolvimento_parto', 'Desenvolvimento do parto'),
        ],
      },
    ],
  },
  {
    titulo: 'Primeiras reações',
    passo: 'Nascimento e primeiras reações',
    grupos: [
      {
        campos: [
          curto('mother_background.primeiras_reacoes.chorou', 'Chorou'),
          curto('mother_background.primeiras_reacoes.ficou_vermelho_demais', 'Ficou vermelho demais'),
          curto(
            'mother_background.primeiras_reacoes.ficou_vermelho_por_quanto_tempo',
            'Ficou vermelho por quanto tempo',
          ),
          curto('mother_background.primeiras_reacoes.precisou_de_oxigenio', 'Precisou de oxigênio'),
          curto('mother_background.primeiras_reacoes.ficou_icterico', 'Ficou ictérico'),
          curto('mother_background.primeiras_reacoes.qual_idade_afirmou_cabeca', 'Qual idade afirmou a cabeça'),
          curto(
            'mother_background.primeiras_reacoes.qual_idade_sentou_sem_apoio',
            'Qual idade sentou sem apoio',
          ),
          curto('mother_background.primeiras_reacoes.qual_idade_engatinhou', 'Qual idade engatinhou'),
          curto('mother_background.primeiras_reacoes.qual_idade_ficou_de_pe', 'Qual idade ficou de pé'),
          curto('mother_background.primeiras_reacoes.qual_idade_andou', 'Qual idade andou'),
          longo('mother_background.primeiras_reacoes.como_era_quando_bebe', 'Como era quando bebê'),
        ],
      },
    ],
  },
  {
    titulo: 'Linguagem verbal (3 anos)',
    grupos: [
      opcoes('Linguagem verbal (3 anos)', [
        marcacao('verbal_language_three_years.balbuciou', 'Balbuciou'),
        marcacao('verbal_language_three_years.trocou_letras', 'Trocou letras'),
        marcacao('verbal_language_three_years.gaguejou', 'Gaguejou'),
        curto('verbal_language_three_years.primeiras_expressoes', 'Primeiras expressões'),
      ]),
    ],
  },
  {
    titulo: 'Desenvolvimento',
    grupos: [
      {
        titulo: 'Saúde',
        campos: [
          curto('development.saude.sofreu_acidente_ou_fez_cirurgia', 'Sofreu acidente ou fez cirurgia'),
          curto('development.saude.possui_alergia', 'Possui alergia'),
          curto('development.saude.possui_bronquite_ou_asma', 'Possui bronquite ou asma'),
          curto('development.saude.possui_problema_visao_audicao', 'Possui problema de visão ou audição'),
          curto('development.saude.ja_desmaiou', 'Já desmaiou'),
          curto('development.saude.quando_desmaiou', 'Quando desmaiou'),
          curto('development.saude.teve_ou_tem_convulsoes', 'Teve ou tem convulsões'),
        ],
      },
      {
        titulo: 'Alimentação',
        campos: [
          curto('development.alimentacao.foi_amamentada', 'Foi amamentada'),
          curto('development.alimentacao.foi_amementada_ate_quando', 'Foi amamentada até quando'),
          curto('development.alimentacao.foi_forcado_se_alimentar', 'Foi forçado a se alimentar'),
          curto('development.alimentacao.recebe_ajuda_na_alimentacao', 'Recebe ajuda na alimentação'),
          longo('development.alimentacao.como_e_sua_alimentacao', 'Como é sua alimentação'),
        ],
      },
      opcoes('Sono', [
        marcacao('development.sono.dorme_bem', 'Dorme bem'),
        marcacao('development.sono.dorme_separado_dos_pais', 'Dorme separado dos pais'),
        curto('development.sono.com_quem_dorme', 'Com quem dorme'),
      ]),
      opcoes('Tipo de sono', [
        marcacao('development.sono.sono.agitado', 'Agitado'),
        marcacao('development.sono.sono.tranquilo', 'Tranquilo'),
        marcacao('development.sono.sono.fala_dormindo', 'Fala dormindo'),
        marcacao('development.sono.sono.sonambulo', 'Sonâmbulo'),
      ]),
    ],
  },
  {
    titulo: 'Informações escolares',
    grupos: [
      {
        campos: [
          longo(
            'school_information.historico_escolar_comum_antecedentes_relevantes',
            'Histórico escolar comum - antecedentes relevantes',
          ),
          longo(
            'school_information.historico_escolar_especial_antecedentes_relevantes',
            'Histórico escolar especial - antecedentes relevantes',
          ),
          longo('school_information.deficiencia_apresentada_estudante', 'Deficiência apresentada pelo estudante'),
          curto('school_information.retido_alguma_vez', 'Foi retido alguma vez'),
          curto('school_information.gosta_de_ir_escola', 'Gosta de ir à escola'),
          curto('school_information.bem_aceito_pelos_amigous', 'É bem aceito pelos amigos'),
        ],
      },
    ],
  },
  {
    titulo: 'Sexualidade',
    grupos: [
      opcoes('Sexualidade', [
        marcacao('sexuality.explanacao_sexual', 'Explanação sexual'),
        marcacao('sexuality.curiosidade_sexual', 'Curiosidade sexual'),
        marcacao('sexuality.conversa_com_pais_sobre_sexualidade', 'Conversa com pais sobre sexualidade'),
      ]),
    ],
  },
  {
    titulo: 'Avaliação do estudante',
    grupos: [
      {
        campos: [
          curto(
            'student_assessment.estudante_apresenta_outro_tipo_deficiencia',
            'Estudante apresenta outro tipo de deficiência',
          ),
          marcacao('student_assessment.apresenta_da_df_di_pc_tgd', 'Apresenta DA/DF/DI/PC/TGD'),
          curto(
            'student_assessment.se_sim_data_e_resultado_diagnostico',
            'Se sim, data e resultado do diagnóstico',
          ),
          longo(
            'student_assessment.se_não_situacao_quanto_diagnostico_tem_outras_dificuldades',
            'Se não, situação quanto ao diagnóstico - tem outras dificuldades',
          ),
          curto('student_assessment.se_tem_outras_dificuldades', 'Se tem outras dificuldades'),
          marcacao('student_assessment.usa_medicamentos_controlados', 'Usa medicamentos controlados'),
          curto('student_assessment.usa_quais_medicamentos', 'Usa quais medicamentos'),
          marcacao(
            'student_assessment.medicamento_interfere_aprendizagem',
            'Medicamento interfere na aprendizagem',
          ),
          curto('student_assessment.se_intefere_aprendizagem', 'Se interfere na aprendizagem'),
          marcacao('student_assessment.existem_recomendacoes_da_saude', 'Existem recomendações da saúde'),
          longo(
            'student_assessment.se_possui_recomendacoes_da_saude',
            'Se possui recomendações da saúde',
          ),
        ],
      },
    ],
  },
  {
    titulo: 'Função cognitiva',
    grupos: [
      {
        campos: [
          longo('student_development.funcao_cognitiva.percepcao', 'Percepção'),
          longo('student_development.funcao_cognitiva.atencao', 'Atenção'),
          longo('student_development.funcao_cognitiva.memoria', 'Memória'),
          longo('student_development.funcao_cognitiva.linguagem', 'Linguagem'),
          longo('student_development.funcao_cognitiva.raciocinio_logico', 'Raciocínio lógico'),
        ],
      },
    ],
  },
  {
    titulo: 'Função motora',
    passo: 'Motora e pessoal-social',
    grupos: [
      {
        campos: [
          longo(
            'student_development.funcao_motora.desenvolvimento_e_capacidade_motora',
            'Desenvolvimento e capacidade motora',
          ),
        ],
      },
    ],
  },
  {
    titulo: 'Função pessoal social',
    passo: 'Motora e pessoal-social',
    grupos: [
      {
        campos: [
          longo(
            'student_development.funcao_pressoal_social.area_emocional_afetiva_social',
            'Área emocional, afetiva e social',
          ),
        ],
      },
    ],
  },
];

export function formularioVazio(): AnamneseForm {
  return formularioVazioDe<AnamneseForm>(SECOES_ANAMNESE);
}

export function formularioDaAnamnese(anamnese: AnamnesisData): AnamneseForm {
  return formularioDoRegistro<AnamneseForm>(SECOES_ANAMNESE, anamnese);
}

// As dez seções que o POST exige e o PATCH aceita; o POST soma o e-mail.
export function montarCorpo(form: AnamneseForm): AnamnesePayload {
  return montarCorpoDe<AnamnesePayload>(SECOES_ANAMNESE, form);
}

export function validarFormulario(form: AnamneseForm): ErrosDoFormulario {
  return validarFormularioDe(SECOES_ANAMNESE, form);
}
