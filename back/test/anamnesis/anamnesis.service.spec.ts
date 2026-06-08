import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { PHASES } from 'src/constants';
import { AnamnesisService } from 'src/anamnesis/anamnesis.service';
import { NotFoundException } from '@nestjs/common';

describe('AnamnesisService', () => {
  let service: AnamnesisService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnamnesisService,
        {
          provide: PrismaService,
          useValue: {
            anamnesis: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            user: {
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AnamnesisService>(AnamnesisService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an anamnesis and update user phase', async () => {
      const createAnamnesisDto = {
        email: 'joao@example.com',
        identification: {
          nome_unidade_plena: 'Nome',
          serie_de_escolaridade_atual: 'Escolaridade',
          turma: 'Turma',
          curso: 'Curso',
          idade_iniciou_estudos: '13 anos',
          nome_completo: 'Nome completo',
          data_de_nascimento: 'DD/MM/YYYY',
          endereco: 'Rua...',
          bairo: 'Bairro',
          cep: 'Cep',
          municipio: 'Municipio',
        },
        family_data: {
          nome_pai: 'Nome',
          profissao_pai: 'Profissão',
          escolaridade_pai: 'Grau de escolaridade',
          idade_pai: '40 anos',
          nome_mae: 'Nome',
          profissao_mae: 'Profissão',
          escolaridade_mae: 'Grau de escolaridade',
          idade_mae: '40 anos',
          outros_filhos: 'Sim ....',
          uniao_pais: {
            casados: true,
            separados: false,
            separados_como_nova_estrutura_familia: false,
          },
          reacao_estudante_situacao: 'Reação',
          estudante_reside_com_quem: 'Pai',
          pais: {
            biologico: true,
            adotivo: false,
          },
        },
        family_conditions: {
          moradia: {
            taipa: true,
            alvenaria: false,
            palafita: false,
          },
          convivio_familiar: {
            excelente: true,
            bom: false,
            problematico: false,
            precario: false,
          },
          medidas_disciplinares_com_estudante: 'Medidas',
          quem_usa_medidas_disciplinares: 'Nome',
          reacao_estudante_frente_medidas: 'Reação',
          qualidade_comunicacao_com_estudante: {
            execelente: true,
            boa: false,
            ruim: false,
            pessima: false,
          },
          reacao_contrariado: 'Reação',
          condicao_ambiente_familiar_aprendizagem_escolar: 'Condição',
        },
        mother_background: {
          gestacao: {
            transfusao_sanguinea_gravidez: 'Sim...',
            quando_sentiu_movimento_da_crianca: '5 meses...',
            levou_tombo_durante_gravidez: 'Sim...',
            doenca_na_gestacao: 'Sim...',
            condicao_saude_da_mae_na_gravidez: 'Bem...',
            episodio_marcante_gravidez: 'Sim...',
          },
          condicoes_nascimento: {
            nasceu_quantos_meses: '2 meses',
            nasceu_quantos_quilos: '3 quilos',
            nasceu_com_qual_comprimento: '20 cm',
            desenvolvimento_parto: 'Bem...',
          },
          primeiras_reacoes: {
            chorou: 'Sim...',
            ficou_vermelho_demais: 'Sim...',
            ficou_vermelho_por_quanto_tempo: 'Não ficou vermelho',
            precisou_de_oxigenio: 'Sim...',
            ficou_icterico: 'Não...',
            como_era_quando_bebe: 'Lindo...',
            qual_idade_afirmou_cabeca: '2 anos',
            qual_idade_sentou_sem_apoio: '4 anos',
            qual_idade_engatinhou: '3 anos',
            qual_idade_ficou_de_pe: '4 anos',
            qual_idade_andou: '5 anos',
          },
        },
        verbal_language_three_years: {
          balbuciou: true,
          primeiras_expressoes: 'Primeiras expressoes',
          trocou_letras: false,
          gaguejou: false,
        },
        development: {
          saude: {
            sofreu_acidente_ou_fez_cirurgia: 'Sim...',
            possui_alergia: 'Não',
            possui_bronquite_ou_asma: 'Sim, bronquite...',
            possui_problema_visao_audicao: 'Não...',
            ja_desmaiou: 'Não',
            quando_desmaiou: 'Não desmaiou',
            teve_ou_tem_convulsoes: 'Sim...',
          },
          alimentacao: {
            foi_amamentada: 'Sim...',
            foi_amementada_ate_quando: '2 anos...',
            como_e_sua_alimentacao: 'Balanceada...',
            foi_forcado_se_alimentar: 'Não',
            recebe_ajuda_na_alimentacao: 'Não',
          },
          sono: {
            dorme_bem: true,
            sono: {
              agitado: true,
              tranquilo: false,
              fala_dormindo: true,
              sonambulo: false,
            },
            dorme_separado_dos_pais: true,
            com_quem_dorme: 'Ninguém',
          },
        },
        school_information: {
          historico_escolar_comum_antecedentes_relevantes: 'Antecedentes...',
          historico_escolar_especial_antecedentes_relevantes: 'Antecedentes...',
          deficiencia_apresentada_estudante: 'Deficiência...',
          retido_alguma_vez: 'Não...',
          gosta_de_ir_escola: 'Não...',
          bem_aceito_pelos_amigous: 'Sim...',
        },
        sexuality: {
          explanacao_sexual: true,
          curiosidade_sexual: true,
          conversa_com_pais_sobre_sexualidade: true,
        },
        student_assessment: {
          estudante_apresenta_outro_tipo_deficiencia: 'Sim...',
          apresenta_da_df_di_pc_tgd: true,
          se_sim_data_e_resultado_diagnostico:
            'Dia 23, possui DA(Deficiência Auditiva)...',
          se_não_situacao_quanto_diagnostico_tem_outras_dificuldades:
            'Tranquilo...',
          se_tem_outras_dificuldades: 'Dificuldade de conversar...',
          usa_medicamentos_controlados: true,
          usa_quais_medicamentos: 'Dipirona...',
          medicamento_interfere_aprendizagem: true,
          se_intefere_aprendizagem: 'Fica com sono...',
          existem_recomendacoes_da_saude: true,
          se_possui_recomendacoes_da_saude: 'Não tomar rémedio para estudar...',
        },
        student_development: {
          funcao_cognitiva: {
            percepcao: 'Tem dificuldade...',
            atencao: 'Tranquilo',
            memoria: 'Tranquilo',
            linguagem: 'Dificuldade de se expressar',
            raciocinio_logico: 'Não tem dificuldade',
          },
          funcao_motora: {
            desenvolvimento_e_capacidade_motora: 'Dificuldade de correr',
          },
          funcao_pressoal_social: {
            area_emocional_afetiva_social: 'Tranquilo...',
          },
        },
      };

      const createdAnamnesis = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        ...createAnamnesisDto,
      };

      jest
        .spyOn(prisma.anamnesis, 'create')
        .mockResolvedValue(createdAnamnesis);

      const result = await service.create(createAnamnesisDto);

      expect(prisma.anamnesis.create).toHaveBeenCalledWith({
        data: createAnamnesisDto,
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: createAnamnesisDto.email },
        data: { id_current_phase: PHASES.ANAMNESE },
      });
      expect(result).toEqual(createdAnamnesis);
    });
  });

  describe('findAll', () => {
    it('should return an array of anamnesis', async () => {
      const anamnesisList = [
        {
          id: 1,
          email: 'joao@example.com',
          identification: {
            nome_unidade_plena: 'Nome',
            serie_de_escolaridade_atual: 'Escolaridade',
            turma: 'Turma',
            curso: 'Curso',
            idade_iniciou_estudos: '13 anos',
            nome_completo: 'Nome completo',
            data_de_nascimento: 'DD/MM/YYYY',
            endereco: 'Rua...',
            bairo: 'Bairro',
            cep: 'Cep',
            municipio: 'Municipio',
          },
          family_data: {
            nome_pai: 'Nome',
            profissao_pai: 'Profissão',
            escolaridade_pai: 'Grau de escolaridade',
            idade_pai: '40 anos',
            nome_mae: 'Nome',
            profissao_mae: 'Profissão',
            escolaridade_mae: 'Grau de escolaridade',
            idade_mae: '40 anos',
            outros_filhos: 'Sim ....',
            uniao_pais: {
              casados: true,
              separados: false,
              separados_como_nova_estrutura_familia: false,
            },
            reacao_estudante_situacao: 'Reação',
            estudante_reside_com_quem: 'Pai',
            pais: {
              biologico: true,
              adotivo: false,
            },
          },
          family_conditions: {
            moradia: {
              taipa: true,
              alvenaria: false,
              palafita: false,
            },
            convivio_familiar: {
              excelente: true,
              bom: false,
              problematico: false,
              precario: false,
            },
            medidas_disciplinares_com_estudante: 'Medidas',
            quem_usa_medidas_disciplinares: 'Nome',
            reacao_estudante_frente_medidas: 'Reação',
            qualidade_comunicacao_com_estudante: {
              execelente: true,
              boa: false,
              ruim: false,
              pessima: false,
            },
            reacao_contrariado: 'Reação',
            condicao_ambiente_familiar_aprendizagem_escolar: 'Condição',
          },
          mother_background: {
            gestacao: {
              transfusao_sanguinea_gravidez: 'Sim...',
              quando_sentiu_movimento_da_crianca: '5 meses...',
              levou_tombo_durante_gravidez: 'Sim...',
              doenca_na_gestacao: 'Sim...',
              condicao_saude_da_mae_na_gravidez: 'Bem...',
              episodio_marcante_gravidez: 'Sim...',
            },
            condicoes_nascimento: {
              nasceu_quantos_meses: '2 meses',
              nasceu_quantos_quilos: '3 quilos',
              nasceu_com_qual_comprimento: '20 cm',
              desenvolvimento_parto: 'Bem...',
            },
            primeiras_reacoes: {
              chorou: 'Sim...',
              ficou_vermelho_demais: 'Sim...',
              ficou_vermelho_por_quanto_tempo: 'Não ficou vermelho',
              precisou_de_oxigenio: 'Sim...',
              ficou_icterico: 'Não...',
              como_era_quando_bebe: 'Lindo...',
              qual_idade_afirmou_cabeca: '2 anos',
              qual_idade_sentou_sem_apoio: '4 anos',
              qual_idade_engatinhou: '3 anos',
              qual_idade_ficou_de_pe: '4 anos',
              qual_idade_andou: '5 anos',
            },
          },
          verbal_language_three_years: {
            balbuciou: true,
            primeiras_expressoes: 'Primeiras expressoes',
            trocou_letras: false,
            gaguejou: false,
          },
          development: {
            saude: {
              sofreu_acidente_ou_fez_cirurgia: 'Sim...',
              possui_alergia: 'Não',
              possui_bronquite_ou_asma: 'Sim, bronquite...',
              possui_problema_visao_audicao: 'Não...',
              ja_desmaiou: 'Não',
              quando_desmaiou: 'Não desmaiou',
              teve_ou_tem_convulsoes: 'Sim...',
            },
            alimentacao: {
              foi_amamentada: 'Sim...',
              foi_amementada_ate_quando: '2 anos...',
              como_e_sua_alimentacao: 'Balanceada...',
              foi_forcado_se_alimentar: 'Não',
              recebe_ajuda_na_alimentacao: 'Não',
            },
            sono: {
              dorme_bem: true,
              sono: {
                agitado: true,
                tranquilo: false,
                fala_dormindo: true,
                sonambulo: false,
              },
              dorme_separado_dos_pais: true,
              com_quem_dorme: 'Ninguém',
            },
          },
          school_information: {
            historico_escolar_comum_antecedentes_relevantes: 'Antecedentes...',
            historico_escolar_especial_antecedentes_relevantes:
              'Antecedentes...',
            deficiencia_apresentada_estudante: 'Deficiência...',
            retido_alguma_vez: 'Não...',
            gosta_de_ir_escola: 'Não...',
            bem_aceito_pelos_amigous: 'Sim...',
          },
          sexuality: {
            explanacao_sexual: true,
            curiosidade_sexual: true,
            conversa_com_pais_sobre_sexualidade: true,
          },
          student_assessment: {
            estudante_apresenta_outro_tipo_deficiencia: 'Sim...',
            apresenta_da_df_di_pc_tgd: true,
            se_sim_data_e_resultado_diagnostico:
              'Dia 23, possui DA(Deficiência Auditiva)...',
            se_não_situacao_quanto_diagnostico_tem_outras_dificuldades:
              'Tranquilo...',
            se_tem_outras_dificuldades: 'Dificuldade de conversar...',
            usa_medicamentos_controlados: true,
            usa_quais_medicamentos: 'Dipirona...',
            medicamento_interfere_aprendizagem: true,
            se_intefere_aprendizagem: 'Fica com sono...',
            existem_recomendacoes_da_saude: true,
            se_possui_recomendacoes_da_saude:
              'Não tomar rémedio para estudar...',
          },
          student_development: {
            funcao_cognitiva: {
              percepcao: 'Tem dificuldade...',
              atencao: 'Tranquilo',
              memoria: 'Tranquilo',
              linguagem: 'Dificuldade de se expressar',
              raciocinio_logico: 'Não tem dificuldade',
            },
            funcao_motora: {
              desenvolvimento_e_capacidade_motora: 'Dificuldade de correr',
            },
            funcao_pressoal_social: {
              area_emocional_afetiva_social: 'Tranquilo...',
            },
          },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
        {
          id: 2,
          email: 'joao@example.com',
          identification: {
            nome_unidade_plena: 'Nome',
            serie_de_escolaridade_atual: 'Escolaridade',
            turma: 'Turma',
            curso: 'Curso',
            idade_iniciou_estudos: '13 anos',
            nome_completo: 'Nome completo',
            data_de_nascimento: 'DD/MM/YYYY',
            endereco: 'Rua...',
            bairo: 'Bairro',
            cep: 'Cep',
            municipio: 'Municipio',
          },
          family_data: {
            nome_pai: 'Nome',
            profissao_pai: 'Profissão',
            escolaridade_pai: 'Grau de escolaridade',
            idade_pai: '40 anos',
            nome_mae: 'Nome',
            profissao_mae: 'Profissão',
            escolaridade_mae: 'Grau de escolaridade',
            idade_mae: '40 anos',
            outros_filhos: 'Sim ....',
            uniao_pais: {
              casados: true,
              separados: false,
              separados_como_nova_estrutura_familia: false,
            },
            reacao_estudante_situacao: 'Reação',
            estudante_reside_com_quem: 'Pai',
            pais: {
              biologico: true,
              adotivo: false,
            },
          },
          family_conditions: {
            moradia: {
              taipa: true,
              alvenaria: false,
              palafita: false,
            },
            convivio_familiar: {
              excelente: true,
              bom: false,
              problematico: false,
              precario: false,
            },
            medidas_disciplinares_com_estudante: 'Medidas',
            quem_usa_medidas_disciplinares: 'Nome',
            reacao_estudante_frente_medidas: 'Reação',
            qualidade_comunicacao_com_estudante: {
              execelente: true,
              boa: false,
              ruim: false,
              pessima: false,
            },
            reacao_contrariado: 'Reação',
            condicao_ambiente_familiar_aprendizagem_escolar: 'Condição',
          },
          mother_background: {
            gestacao: {
              transfusao_sanguinea_gravidez: 'Sim...',
              quando_sentiu_movimento_da_crianca: '5 meses...',
              levou_tombo_durante_gravidez: 'Sim...',
              doenca_na_gestacao: 'Sim...',
              condicao_saude_da_mae_na_gravidez: 'Bem...',
              episodio_marcante_gravidez: 'Sim...',
            },
            condicoes_nascimento: {
              nasceu_quantos_meses: '2 meses',
              nasceu_quantos_quilos: '3 quilos',
              nasceu_com_qual_comprimento: '20 cm',
              desenvolvimento_parto: 'Bem...',
            },
            primeiras_reacoes: {
              chorou: 'Sim...',
              ficou_vermelho_demais: 'Sim...',
              ficou_vermelho_por_quanto_tempo: 'Não ficou vermelho',
              precisou_de_oxigenio: 'Sim...',
              ficou_icterico: 'Não...',
              como_era_quando_bebe: 'Lindo...',
              qual_idade_afirmou_cabeca: '2 anos',
              qual_idade_sentou_sem_apoio: '4 anos',
              qual_idade_engatinhou: '3 anos',
              qual_idade_ficou_de_pe: '4 anos',
              qual_idade_andou: '5 anos',
            },
          },
          verbal_language_three_years: {
            balbuciou: true,
            primeiras_expressoes: 'Primeiras expressoes',
            trocou_letras: false,
            gaguejou: false,
          },
          development: {
            saude: {
              sofreu_acidente_ou_fez_cirurgia: 'Sim...',
              possui_alergia: 'Não',
              possui_bronquite_ou_asma: 'Sim, bronquite...',
              possui_problema_visao_audicao: 'Não...',
              ja_desmaiou: 'Não',
              quando_desmaiou: 'Não desmaiou',
              teve_ou_tem_convulsoes: 'Sim...',
            },
            alimentacao: {
              foi_amamentada: 'Sim...',
              foi_amementada_ate_quando: '2 anos...',
              como_e_sua_alimentacao: 'Balanceada...',
              foi_forcado_se_alimentar: 'Não',
              recebe_ajuda_na_alimentacao: 'Não',
            },
            sono: {
              dorme_bem: true,
              sono: {
                agitado: true,
                tranquilo: false,
                fala_dormindo: true,
                sonambulo: false,
              },
              dorme_separado_dos_pais: true,
              com_quem_dorme: 'Ninguém',
            },
          },
          school_information: {
            historico_escolar_comum_antecedentes_relevantes: 'Antecedentes...',
            historico_escolar_especial_antecedentes_relevantes:
              'Antecedentes...',
            deficiencia_apresentada_estudante: 'Deficiência...',
            retido_alguma_vez: 'Não...',
            gosta_de_ir_escola: 'Não...',
            bem_aceito_pelos_amigous: 'Sim...',
          },
          sexuality: {
            explanacao_sexual: true,
            curiosidade_sexual: true,
            conversa_com_pais_sobre_sexualidade: true,
          },
          student_assessment: {
            estudante_apresenta_outro_tipo_deficiencia: 'Sim...',
            apresenta_da_df_di_pc_tgd: true,
            se_sim_data_e_resultado_diagnostico:
              'Dia 23, possui DA(Deficiência Auditiva)...',
            se_não_situacao_quanto_diagnostico_tem_outras_dificuldades:
              'Tranquilo...',
            se_tem_outras_dificuldades: 'Dificuldade de conversar...',
            usa_medicamentos_controlados: true,
            usa_quais_medicamentos: 'Dipirona...',
            medicamento_interfere_aprendizagem: true,
            se_intefere_aprendizagem: 'Fica com sono...',
            existem_recomendacoes_da_saude: true,
            se_possui_recomendacoes_da_saude:
              'Não tomar rémedio para estudar...',
          },
          student_development: {
            funcao_cognitiva: {
              percepcao: 'Tem dificuldade...',
              atencao: 'Tranquilo',
              memoria: 'Tranquilo',
              linguagem: 'Dificuldade de se expressar',
              raciocinio_logico: 'Não tem dificuldade',
            },
            funcao_motora: {
              desenvolvimento_e_capacidade_motora: 'Dificuldade de correr',
            },
            funcao_pressoal_social: {
              area_emocional_afetiva_social: 'Tranquilo...',
            },
          },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];
      jest.spyOn(prisma.anamnesis, 'findMany').mockResolvedValue(anamnesisList);

      const result = await service.findAll();

      expect(prisma.anamnesis.findMany).toHaveBeenCalled();
      expect(result).toEqual(anamnesisList);
    });
  });

  describe('findOne', () => {
    it('should return a single anamnesis by email', async () => {
      const email = 'test@example.com';
      const anamnesis = {
        id: 1,
        email: 'test@example.com',
        identification: {
          nome_unidade_plena: 'Nome',
          serie_de_escolaridade_atual: 'Escolaridade',
          turma: 'Turma',
          curso: 'Curso',
          idade_iniciou_estudos: '13 anos',
          nome_completo: 'Nome completo',
          data_de_nascimento: 'DD/MM/YYYY',
          endereco: 'Rua...',
          bairo: 'Bairro',
          cep: 'Cep',
          municipio: 'Municipio',
        },
        family_data: {
          nome_pai: 'Nome',
          profissao_pai: 'Profissão',
          escolaridade_pai: 'Grau de escolaridade',
          idade_pai: '40 anos',
          nome_mae: 'Nome',
          profissao_mae: 'Profissão',
          escolaridade_mae: 'Grau de escolaridade',
          idade_mae: '40 anos',
          outros_filhos: 'Sim ....',
          uniao_pais: {
            casados: true,
            separados: false,
            separados_como_nova_estrutura_familia: false,
          },
          reacao_estudante_situacao: 'Reação',
          estudante_reside_com_quem: 'Pai',
          pais: {
            biologico: true,
            adotivo: false,
          },
        },
        family_conditions: {
          moradia: {
            taipa: true,
            alvenaria: false,
            palafita: false,
          },
          convivio_familiar: {
            excelente: true,
            bom: false,
            problematico: false,
            precario: false,
          },
          medidas_disciplinares_com_estudante: 'Medidas',
          quem_usa_medidas_disciplinares: 'Nome',
          reacao_estudante_frente_medidas: 'Reação',
          qualidade_comunicacao_com_estudante: {
            execelente: true,
            boa: false,
            ruim: false,
            pessima: false,
          },
          reacao_contrariado: 'Reação',
          condicao_ambiente_familiar_aprendizagem_escolar: 'Condição',
        },
        mother_background: {
          gestacao: {
            transfusao_sanguinea_gravidez: 'Sim...',
            quando_sentiu_movimento_da_crianca: '5 meses...',
            levou_tombo_durante_gravidez: 'Sim...',
            doenca_na_gestacao: 'Sim...',
            condicao_saude_da_mae_na_gravidez: 'Bem...',
            episodio_marcante_gravidez: 'Sim...',
          },
          condicoes_nascimento: {
            nasceu_quantos_meses: '2 meses',
            nasceu_quantos_quilos: '3 quilos',
            nasceu_com_qual_comprimento: '20 cm',
            desenvolvimento_parto: 'Bem...',
          },
          primeiras_reacoes: {
            chorou: 'Sim...',
            ficou_vermelho_demais: 'Sim...',
            ficou_vermelho_por_quanto_tempo: 'Não ficou vermelho',
            precisou_de_oxigenio: 'Sim...',
            ficou_icterico: 'Não...',
            como_era_quando_bebe: 'Lindo...',
            qual_idade_afirmou_cabeca: '2 anos',
            qual_idade_sentou_sem_apoio: '4 anos',
            qual_idade_engatinhou: '3 anos',
            qual_idade_ficou_de_pe: '4 anos',
            qual_idade_andou: '5 anos',
          },
        },
        verbal_language_three_years: {
          balbuciou: true,
          primeiras_expressoes: 'Primeiras expressoes',
          trocou_letras: false,
          gaguejou: false,
        },
        development: {
          saude: {
            sofreu_acidente_ou_fez_cirurgia: 'Sim...',
            possui_alergia: 'Não',
            possui_bronquite_ou_asma: 'Sim, bronquite...',
            possui_problema_visao_audicao: 'Não...',
            ja_desmaiou: 'Não',
            quando_desmaiou: 'Não desmaiou',
            teve_ou_tem_convulsoes: 'Sim...',
          },
          alimentacao: {
            foi_amamentada: 'Sim...',
            foi_amementada_ate_quando: '2 anos...',
            como_e_sua_alimentacao: 'Balanceada...',
            foi_forcado_se_alimentar: 'Não',
            recebe_ajuda_na_alimentacao: 'Não',
          },
          sono: {
            dorme_bem: true,
            sono: {
              agitado: true,
              tranquilo: false,
              fala_dormindo: true,
              sonambulo: false,
            },
            dorme_separado_dos_pais: true,
            com_quem_dorme: 'Ninguém',
          },
        },
        school_information: {
          historico_escolar_comum_antecedentes_relevantes: 'Antecedentes...',
          historico_escolar_especial_antecedentes_relevantes: 'Antecedentes...',
          deficiencia_apresentada_estudante: 'Deficiência...',
          retido_alguma_vez: 'Não...',
          gosta_de_ir_escola: 'Não...',
          bem_aceito_pelos_amigous: 'Sim...',
        },
        sexuality: {
          explanacao_sexual: true,
          curiosidade_sexual: true,
          conversa_com_pais_sobre_sexualidade: true,
        },
        student_assessment: {
          estudante_apresenta_outro_tipo_deficiencia: 'Sim...',
          apresenta_da_df_di_pc_tgd: true,
          se_sim_data_e_resultado_diagnostico:
            'Dia 23, possui DA(Deficiência Auditiva)...',
          se_não_situacao_quanto_diagnostico_tem_outras_dificuldades:
            'Tranquilo...',
          se_tem_outras_dificuldades: 'Dificuldade de conversar...',
          usa_medicamentos_controlados: true,
          usa_quais_medicamentos: 'Dipirona...',
          medicamento_interfere_aprendizagem: true,
          se_intefere_aprendizagem: 'Fica com sono...',
          existem_recomendacoes_da_saude: true,
          se_possui_recomendacoes_da_saude: 'Não tomar rémedio para estudar...',
        },
        student_development: {
          funcao_cognitiva: {
            percepcao: 'Tem dificuldade...',
            atencao: 'Tranquilo',
            memoria: 'Tranquilo',
            linguagem: 'Dificuldade de se expressar',
            raciocinio_logico: 'Não tem dificuldade',
          },
          funcao_motora: {
            desenvolvimento_e_capacidade_motora: 'Dificuldade de correr',
          },
          funcao_pressoal_social: {
            area_emocional_afetiva_social: 'Tranquilo...',
          },
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(anamnesis);

      const result = await service.findOne(email);

      expect(prisma.anamnesis.findUnique).toHaveBeenCalledWith({
        where: { email: email },
      });
      expect(result).toEqual(anamnesis);
    });
  });

  describe('update', () => {
    it('should update an anamnesis when it exists', async () => {
      const email = 'joao@example.com';
      const updateDto = { identification: { nome_completo: 'Novo Nome' } } as any;
      const existing = { id: 1, email } as any;
      const updated = { ...existing, ...updateDto };

      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(existing);
      jest.spyOn(prisma.anamnesis, 'update').mockResolvedValue(updated);

      const result = await service.update(email, updateDto);

      expect(prisma.anamnesis.findUnique).toHaveBeenCalledWith({ where: { email } });
      expect(prisma.anamnesis.update).toHaveBeenCalledWith({
        where: { email },
        data: updateDto,
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when anamnesis does not exist', async () => {
      const email = 'notfound@example.com';

      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(null);

      await expect(service.update(email, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an anamnesis when it exists', async () => {
      const email = 'joao@example.com';
      const existing = { id: 1, email } as any;

      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(existing);
      jest.spyOn(prisma.anamnesis, 'delete').mockResolvedValue(existing);

      const result = await service.remove(email);

      expect(prisma.anamnesis.findUnique).toHaveBeenCalledWith({ where: { email } });
      expect(prisma.anamnesis.delete).toHaveBeenCalledWith({ where: { email } });
      expect(result).toEqual({ message: `Anamnese com email ${email} foi removida com sucesso` });
    });

    it('should throw NotFoundException when anamnesis does not exist', async () => {
      const email = 'notfound@example.com';

      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(null);

      await expect(service.remove(email)).rejects.toThrow(NotFoundException);
    });
  });
});
