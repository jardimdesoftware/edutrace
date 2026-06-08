import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LEVELS } from 'src/constants';
import { PlansEducationService } from 'src/plans-education/plans-education.service';

describe('PlansEducationService', () => {
  let service: PlansEducationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansEducationService,
        {
          provide: PrismaService,
          useValue: {
            plansEducation: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PlansEducationService>(PlansEducationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a plans education', async () => {
      const createPlansEducationDto = {
        professor_email: 'professor@example.com',
        professor_name: 'Professor',
        student_email: 'estudante@example.com',
        student_name: 'Estudante',
        academic_semester: {
          primeiro_semestre: true,
          segundo_semestre: false,
        },
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
          outro: 'Outro tipo de serviço de apoio',
        },
        skills: {
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
        resource_equipment_used: {
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
        resource_equipment_needs: {
          acompanhante_sala_aula: true,
          adaptacao_metodologia_professor: true,
          compreensao_companheirismo_turma: true,
          outro: '',
        },
        curriculum_accessibility: {
          leitura_sem_entonacao: true,
          pronuncia_trocas_omissoes: true,
          confusao_palavras_parecidas: true,
          escrita_incorreta_ordem_letras: true,
          tempo_maior_trabalhos_escritos: true,
          disfuncao_linguagem_comunicacao: true,
          outro: '',
        },
        school_content: 'Conteúdos',
        activities_to_be_developed: {
          comunicacao_alternativa: true,
          informatica_acessivel: true,
          adequacao_material: true,
          outro: '',
        },
        objectives: 'Descrever objetivos',
        work_methodology: {
          aulas_praticas: true,
          aulas_expositivas_midia: true,
          dialogos: true,
          visitas_tecnicas: true,
          atividades_grupo: true,
          atividades_corte_colagem: true,
        },
        materials_used: {
          data_show: true,
          celular: true,
          cartolinas_pinceis: true,
          apostilas: true,
          artigos: true,
          tablet: true,
          outro: '',
        },
        evaluation_criteria: {
          participacao_coletiva: true,
          observacao_interacoes: true,
          atividades_paralelas: true,
          participacao_individual: true,
          uso_ferramentas_tecnologicas: true,
          fotos_videos_relatos: true,
          outro: '',
        },
      };
      const createdPlansEducation = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        ...createPlansEducationDto,
      };

      jest
        .spyOn(prisma.plansEducation, 'create')
        .mockResolvedValue(createdPlansEducation);

      const result = await service.create(createPlansEducationDto);

      expect(prisma.plansEducation.create).toHaveBeenCalledWith({
        data: createPlansEducationDto,
      });
      expect(result).toEqual(createdPlansEducation);
    });
  });

  describe('findAll', () => {
    it('should return an array of plans education', async () => {
      const plansEducationList = [
        {
          id: 1,
          professor_email: 'professor@example.com',
          professor_name: 'Professor',
          student_email: 'estudante@example.com',
          student_name: 'Estudante',
          academic_semester: {
            primeiro_semestre: true,
            segundo_semestre: false,
          },
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
            outro: 'Outro tipo de serviço de apoio',
          },
          skills: {
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
          resource_equipment_used: {
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
          resource_equipment_needs: {
            acompanhante_sala_aula: true,
            adaptacao_metodologia_professor: true,
            compreensao_companheirismo_turma: true,
            outro: '',
          },
          curriculum_accessibility: {
            leitura_sem_entonacao: true,
            pronuncia_trocas_omissoes: true,
            confusao_palavras_parecidas: true,
            escrita_incorreta_ordem_letras: true,
            tempo_maior_trabalhos_escritos: true,
            disfuncao_linguagem_comunicacao: true,
            outro: '',
          },
          school_content: 'Conteúdos',
          activities_to_be_developed: {
            comunicacao_alternativa: true,
            informatica_acessivel: true,
            adequacao_material: true,
            outro: '',
          },
          objectives: 'Descrever objetivos',
          work_methodology: {
            aulas_praticas: true,
            aulas_expositivas_midia: true,
            dialogos: true,
            visitas_tecnicas: true,
            atividades_grupo: true,
            atividades_corte_colagem: true,
          },
          materials_used: {
            data_show: true,
            celular: true,
            cartolinas_pinceis: true,
            apostilas: true,
            artigos: true,
            tablet: true,
            outro: '',
          },
          evaluation_criteria: {
            participacao_coletiva: true,
            observacao_interacoes: true,
            atividades_paralelas: true,
            participacao_individual: true,
            uso_ferramentas_tecnologicas: true,
            fotos_videos_relatos: true,
            outro: '',
          },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
        {
          id: 2,
          professor_email: 'professor@example.com',
          professor_name: 'Professor',
          student_email: 'estudante@example.com',
          student_name: 'Estudante',
          academic_semester: {
            primeiro_semestre: true,
            segundo_semestre: false,
          },
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
            outro: 'Outro tipo de serviço de apoio',
          },
          skills: {
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
          resource_equipment_used: {
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
          resource_equipment_needs: {
            acompanhante_sala_aula: true,
            adaptacao_metodologia_professor: true,
            compreensao_companheirismo_turma: true,
            outro: '',
          },
          curriculum_accessibility: {
            leitura_sem_entonacao: true,
            pronuncia_trocas_omissoes: true,
            confusao_palavras_parecidas: true,
            escrita_incorreta_ordem_letras: true,
            tempo_maior_trabalhos_escritos: true,
            disfuncao_linguagem_comunicacao: true,
            outro: '',
          },
          school_content: 'Conteúdos',
          activities_to_be_developed: {
            comunicacao_alternativa: true,
            informatica_acessivel: true,
            adequacao_material: true,
            outro: '',
          },
          objectives: 'Descrever objetivos',
          work_methodology: {
            aulas_praticas: true,
            aulas_expositivas_midia: true,
            dialogos: true,
            visitas_tecnicas: true,
            atividades_grupo: true,
            atividades_corte_colagem: true,
          },
          materials_used: {
            data_show: true,
            celular: true,
            cartolinas_pinceis: true,
            apostilas: true,
            artigos: true,
            tablet: true,
            outro: '',
          },
          evaluation_criteria: {
            participacao_coletiva: true,
            observacao_interacoes: true,
            atividades_paralelas: true,
            participacao_individual: true,
            uso_ferramentas_tecnologicas: true,
            fotos_videos_relatos: true,
            outro: '',
          },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];
      jest
        .spyOn(prisma.plansEducation, 'findMany')
        .mockResolvedValue(plansEducationList);

      const result = await service.findAll();

      expect(prisma.plansEducation.findMany).toHaveBeenCalled();
      expect(result).toEqual(plansEducationList);
    });
  });

  describe('findOne', () => {
    it('should return a single plans education for the same student', async () => {
      const email = 'student@example.com';
      const request = {
        user: {
          email: 'student@example.com',
          id_level: LEVELS.ALUNO_ESTUDANTE,
        },
      } as any;
      const planEducation = {
        id: 1,
        professor_email: 'professor@example.com',
        professor_name: 'Professor',
        student_email: 'student@example.com',
        student_name: 'Estudante',
        academic_semester: {
          primeiro_semestre: true,
          segundo_semestre: false,
        },
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
          outro: 'Outro tipo de serviço de apoio',
        },
        skills: {
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
        resource_equipment_used: {
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
        resource_equipment_needs: {
          acompanhante_sala_aula: true,
          adaptacao_metodologia_professor: true,
          compreensao_companheirismo_turma: true,
          outro: '',
        },
        curriculum_accessibility: {
          leitura_sem_entonacao: true,
          pronuncia_trocas_omissoes: true,
          confusao_palavras_parecidas: true,
          escrita_incorreta_ordem_letras: true,
          tempo_maior_trabalhos_escritos: true,
          disfuncao_linguagem_comunicacao: true,
          outro: '',
        },
        school_content: 'Conteúdos',
        activities_to_be_developed: {
          comunicacao_alternativa: true,
          informatica_acessivel: true,
          adequacao_material: true,
          outro: '',
        },
        objectives: 'Descrever objetivos',
        work_methodology: {
          aulas_praticas: true,
          aulas_expositivas_midia: true,
          dialogos: true,
          visitas_tecnicas: true,
          atividades_grupo: true,
          atividades_corte_colagem: true,
        },
        materials_used: {
          data_show: true,
          celular: true,
          cartolinas_pinceis: true,
          apostilas: true,
          artigos: true,
          tablet: true,
          outro: '',
        },
        evaluation_criteria: {
          participacao_coletiva: true,
          observacao_interacoes: true,
          atividades_paralelas: true,
          participacao_individual: true,
          uso_ferramentas_tecnologicas: true,
          fotos_videos_relatos: true,
          outro: '',
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
      jest
        .spyOn(prisma.plansEducation, 'findUnique')
        .mockResolvedValue(planEducation);

      const result = await service.findOne(email, request);

      expect(prisma.plansEducation.findUnique).toHaveBeenCalledWith({
        where: { student_email: email },
      });
      expect(result).toEqual(planEducation);
    });

    it('should return a single plans education for a non-student viewing another profile', async () => {
      const email = 'other@example.com';
      const request = {
        user: {
          email: 'professional@example.com',
          id_level: LEVELS.PROFISSIONAL_EDUCACAO,
        },
      } as any;
      const planEducation = {
        id: 1,
        professor_email: 'professor@example.com',
        professor_name: 'Professor',
        student_email: 'other@example.com',
        student_name: 'Estudante',
        academic_semester: {
          primeiro_semestre: true,
          segundo_semestre: false,
        },
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
          outro: 'Outro tipo de serviço de apoio',
        },
        skills: {
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
        resource_equipment_used: {
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
        resource_equipment_needs: {
          acompanhante_sala_aula: true,
          adaptacao_metodologia_professor: true,
          compreensao_companheirismo_turma: true,
          outro: '',
        },
        curriculum_accessibility: {
          leitura_sem_entonacao: true,
          pronuncia_trocas_omissoes: true,
          confusao_palavras_parecidas: true,
          escrita_incorreta_ordem_letras: true,
          tempo_maior_trabalhos_escritos: true,
          disfuncao_linguagem_comunicacao: true,
          outro: '',
        },
        school_content: 'Conteúdos',
        activities_to_be_developed: {
          comunicacao_alternativa: true,
          informatica_acessivel: true,
          adequacao_material: true,
          outro: '',
        },
        objectives: 'Descrever objetivos',
        work_methodology: {
          aulas_praticas: true,
          aulas_expositivas_midia: true,
          dialogos: true,
          visitas_tecnicas: true,
          atividades_grupo: true,
          atividades_corte_colagem: true,
        },
        materials_used: {
          data_show: true,
          celular: true,
          cartolinas_pinceis: true,
          apostilas: true,
          artigos: true,
          tablet: true,
          outro: '',
        },
        evaluation_criteria: {
          participacao_coletiva: true,
          observacao_interacoes: true,
          atividades_paralelas: true,
          participacao_individual: true,
          uso_ferramentas_tecnologicas: true,
          fotos_videos_relatos: true,
          outro: '',
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
      jest
        .spyOn(prisma.plansEducation, 'findUnique')
        .mockResolvedValue(planEducation);

      const result = await service.findOne(email, request);

      expect(prisma.plansEducation.findUnique).toHaveBeenCalledWith({
        where: { student_email: email },
      });
      expect(result).toEqual(planEducation);
    });

    it("should throw ForbiddenException if student views another student\'s profile", async () => {
      const email = 'other@example.com';
      const request = {
        user: {
          email: 'student@example.com',
          id_level: LEVELS.ALUNO_ESTUDANTE,
        },
      } as any;

      let thrownError: any;
      try {
        await service.findOne(email, request);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ForbiddenException);
      expect(thrownError.message).toBe(
        'Você não tem permissão para visualizar este PEI',
      );
    });

    it('should throw NotFoundException when plans education is not found', async () => {
      const email = 'notfound@example.com';
      const request = {
        user: { email, id_level: 2 },
      } as any;

      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(null);

      await expect(service.findOne(email, request)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a plans education when it exists', async () => {
      const email = 'estudante@example.com';
      const updateDto = { student_name: 'Novo Nome' } as any;
      const existing = { id: 1, student_email: email } as any;
      const updated = { ...existing, ...updateDto };

      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(existing);
      jest.spyOn(prisma.plansEducation, 'update').mockResolvedValue(updated);

      const result = await service.update(email, updateDto);

      expect(prisma.plansEducation.findUnique).toHaveBeenCalledWith({
        where: { student_email: email },
      });
      expect(prisma.plansEducation.update).toHaveBeenCalledWith({
        where: { student_email: email },
        data: updateDto,
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when plans education does not exist', async () => {
      const email = 'notfound@example.com';

      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(null);

      await expect(service.update(email, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a plans education when it exists', async () => {
      const email = 'estudante@example.com';
      const existing = { id: 1, student_email: email } as any;

      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(existing);
      jest.spyOn(prisma.plansEducation, 'delete').mockResolvedValue(existing);

      const result = await service.remove(email);

      expect(prisma.plansEducation.findUnique).toHaveBeenCalledWith({
        where: { student_email: email },
      });
      expect(prisma.plansEducation.delete).toHaveBeenCalledWith({
        where: { student_email: email },
      });
      expect(result).toEqual({ message: `PEI do aluno ${email} removido com sucesso` });
    });

    it('should throw NotFoundException when plans education does not exist', async () => {
      const email = 'notfound@example.com';

      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(null);

      await expect(service.remove(email)).rejects.toThrow(NotFoundException);
    });
  });
});
