import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsObject, IsString } from 'class-validator';

// professor_email e professor_name não são entrada do cliente: a autoria é
// gravada a partir do usuário autenticado (PlansEducationService.create).
export class CreatePlansEducationDto {
  @ApiProperty({
    description: 'Email do estudante',
    example: 'estudante@example.com',
  })
  @IsNotEmpty({ message: 'O campo student_email não deve estar vazio.' })
  @IsEmail({}, { message: 'O campo student_email deve ser um e-mail válido.' })
  student_email: string;

  @ApiProperty({
    description: 'Nome do Estudante',
    example: 'Estudante',
  })
  @IsNotEmpty({ message: 'O campo student_name não deve estar vazio.' })
  @IsString({ message: 'O campo student_name deve ser uma string.' })
  student_name: string;

  @ApiProperty({
    description: 'Semestre letivo em formato JSON',
    example: {
      primeiro_semestre: true,
      segundo_semestre: false,
    },
  })
  @IsNotEmpty({ message: 'O campo academic_semester não deve estar vazio.' })
  @IsObject({ message: 'O campo academic_semester deve ser um objeto JSON.' })
  academic_semester: object;

  @ApiProperty({
    description: 'Modalidade de atendimento em formato JSON',
    example: {
      turma_regular: true,
      atendimento_pedagogico_domiciliar: false,
      atendimento_pedagogico_hospitalar: false,
    },
  })
  @IsNotEmpty({ message: 'O campo service_modality não deve estar vazio.' })
  @IsObject({ message: 'O campo service_modality deve ser um objeto JSON.' })
  service_modality: object;

  @ApiProperty({
    description: 'Serviço de apoio em formato JSON',
    example: {
      agente_educacao_especial_neuropsicopedagoro: true,
      interprete: false,
      instrutor: false,
      voluntario: false,
      outro: 'Outro tipo de serviço de apoio',
    },
  })
  @IsNotEmpty({ message: 'O campo support_service não deve estar vazio.' })
  @IsObject({ message: 'O campo support_service deve ser um objeto JSON.' })
  support_service: object;

  @ApiProperty({
    description: 'Habilidades e Potencialidades em formato JSON',
    example: {
      atencao_em_sala_de_aula: true,
      interesse_ambiente_escolar: true,
      concentracao_atividades: true,
      memoria_auditiva_visual_sequencial: true,
      raciocinio_logico_matematico: true,
      sequencia_logica_fatos: true,
      interesse_por_objetos: true,
      exploracao_adequada_objetos: true,
      comparacao_associacao_classificacao: true,
      abstracao_conduta_simbolica: true,
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
      comunicacao_nao_verbal: true,
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
  })
  @IsNotEmpty({ message: 'O campo skills não deve estar vazio.' })
  @IsObject({ message: 'O campo skills deve ser um objeto JSON.' })
  skills: object;

  @ApiProperty({
    description:
      'Tipo de recurso e/ou equipamento já utilizado pelo aluno em formato JSON',
    example: {
      reduzir_quantidade_material_atividade: true,
      provas_orais_escrita_minima: true,
      mais_tempo_conclusao_trabalhos: true,
      avaliacao_multipla_escolha: true,
      orientacoes_diretas_instrucoes_claras: true,
      nao_avaliar_caligrafia_ortografia: true,
      concentrar_notas_originalidade_ideias: true,
      encorajar_pratica_escrita: true,
      outro: 'Nenhum recurso adicional',
    },
  })
  @IsNotEmpty({
    message: 'O campo resource_equipment_used não deve estar vazio.',
  })
  @IsObject({
    message: 'O campo resource_equipment_used deve ser um objeto JSON.',
  })
  resource_equipment_used: object;

  @ApiProperty({
    description:
      'Tipo de recurso e/ou equipamento que precisa ser providenciado para o aluno em formato JSON',
    example: {
      acompanhante_sala_aula: true,
      adaptacao_metodologia_professor: true,
      compreensao_companheirismo_turma: true,
      outro: '',
    },
  })
  @IsNotEmpty({
    message: 'O campo resource_equipment_needs não deve estar vazio.',
  })
  @IsObject({
    message: 'O campo resource_equipment_needs deve ser um objeto JSON.',
  })
  resource_equipment_needs: object;

  @ApiProperty({
    description:
      'Implicações da necessidade educacional especial do aluno para a acessibilidade curricular em formato JSON',
    example: {
      leitura_sem_entonacao: true,
      pronuncia_trocas_omissoes: true,
      confusao_palavras_parecidas: true,
      escrita_incorreta_ordem_letras: true,
      tempo_maior_trabalhos_escritos: true,
      disfuncao_linguagem_comunicacao: true,
      outro: '',
    },
  })
  @IsNotEmpty({
    message: 'O campo curriculum_accessibility não deve estar vazio.',
  })
  @IsObject({
    message: 'O campo curriculum_accessibility deve ser um objeto JSON.',
  })
  curriculum_accessibility: object;

  @ApiProperty({
    description: 'Conteúdos principais',
    example: 'Conteúdos',
  })
  @IsNotEmpty({ message: 'O campo school_content não deve estar vazio.' })
  @IsString({ message: 'O campo school_content deve ser uma string.' })
  school_content: string;

  @ApiProperty({
    description:
      'Descrever atividades que pretende desenvolver com o aluno em formato JSON',
    example: {
      comunicacao_alternativa: true,
      informatica_acessivel: true,
      adequacao_material: true,
      outro: '',
    },
  })
  @IsNotEmpty({
    message: 'O campo activities_to_be_developed não deve estar vazio.',
  })
  @IsObject({
    message: 'O campo activities_to_be_developed deve ser um objeto JSON.',
  })
  activities_to_be_developed: object;

  @ApiProperty({
    description: 'Objetivos',
    example: 'Descrever objetivos',
  })
  @IsNotEmpty({ message: 'O campo objectives não deve estar vazio.' })
  @IsString({ message: 'O campo objectives deve ser uma string.' })
  objectives: string;

  @ApiProperty({
    description: 'Metodologia de trabalho em formato JSON string',
    example: {
      aulas_praticas: true,
      aulas_expositivas_midia: true,
      dialogos: true,
      visitas_tecnicas: true,
      atividades_grupo: true,
      atividades_corte_colagem: true,
    },
  })
  @IsNotEmpty({ message: 'O campo work_methodology não deve estar vazio.' })
  @IsObject({ message: 'O campo work_methodology deve ser um objeto JSON.' })
  work_methodology: object;

  @ApiProperty({
    description: 'Recursos materiais utilizados em formato JSON',
    example: {
      data_show: true,
      celular: true,
      cartolinas_pinceis: true,
      apostilas: true,
      artigos: true,
      tablet: true,
      outro: '',
    },
  })
  @IsNotEmpty({ message: 'O campo materials_used não deve estar vazio.' })
  @IsObject({ message: 'O campo materials_used deve ser um objeto JSON.' })
  materials_used: object;

  @ApiProperty({
    description: 'Critérios de avaliação do aluno em formato JSON',
    example: {
      participacao_coletiva: true,
      observacao_interacoes: true,
      atividades_paralelas: true,
      participacao_individual: true,
      uso_ferramentas_tecnologicas: true,
      fotos_videos_relatos: true,
      outro: '',
    },
  })
  @IsNotEmpty({ message: 'O campo evaluation_criteria não deve estar vazio.' })
  @IsObject({ message: 'O campo evaluation_criteria deve ser um objeto JSON.' })
  evaluation_criteria: object;
}
