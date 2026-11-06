import { StudentsService } from 'src/students/students.service';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { CreateAnamnesisDto } from 'src/anamnesis/dto/create-anamnesis.dto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS, PHASES } from 'src/constants';
import { FormRevisionsService } from 'src/form-revisions/form-revisions.service';
const AUTHOR = { id: 7, name: 'Autor' };
import { AnamnesisService } from 'src/anamnesis/anamnesis.service';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('AnamnesisService', () => {
  let service: AnamnesisService;
  let prisma: PrismaService;
  let formRevisions: {
    recordCreation: jest.Mock;
    recordEdit: jest.Mock;
    removeAll: jest.Mock;
  };
  let studentsService: StudentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnamnesisService,
        {
          provide: FormRevisionsService,
          useValue: {
            recordCreation: jest.fn(),
            recordEdit: jest.fn(),
            removeAll: jest.fn(),
          },
        },
        {
          provide: StudentsService,
          useValue: {
            findOneOrFail: jest
              .fn()
              .mockResolvedValue({ id: 2, email: 'estudante@example.com' }),
            findAllEmails: jest
              .fn()
              .mockResolvedValue(['estudante@example.com']),
          },
        },
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
            $transaction: jest.fn((operations: Promise<unknown>[]) =>
              Promise.all(operations),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AnamnesisService>(AnamnesisService);
    prisma = module.get<PrismaService>(PrismaService);
    formRevisions = module.get(FormRevisionsService);
    Object.assign(prisma, {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 2 }),
        update: jest.fn(),
      },
    });
    studentsService = module.get<StudentsService>(StudentsService);
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

      const result = await service.create(createAnamnesisDto, AUTHOR);

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
    it('should return the student own anamnesis', async () => {
      const email = 'test@example.com';
      const request = {
        user: { email, roles: [LEVELS.ALUNO_ESTUDANTE] },
      } as any;
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

      const result = await service.findOne(email, request);

      expect(prisma.anamnesis.findUnique).toHaveBeenCalledWith({
        where: { email: email },
      });
      expect(result).toEqual(anamnesis);
    });

    it("should throw ForbiddenException if student views another student's anamnesis", async () => {
      const request = {
        user: {
          email: 'student@example.com',
          roles: [LEVELS.ALUNO_ESTUDANTE],
        },
      } as any;

      await expect(
        service.findOne('other@example.com', request),
      ).rejects.toThrow(
        new ForbiddenException(
          'Você não tem permissão para visualizar esta anamnese',
        ),
      );
      expect(prisma.anamnesis.findUnique).not.toHaveBeenCalled();
      expect(studentsService.findOneOrFail).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException if a level outside the readers views another student's anamnesis", async () => {
      const request = {
        user: { email: 'nivel7@example.com', roles: [7] },
      } as any;

      await expect(
        service.findOne('other@example.com', request),
      ).rejects.toThrow(
        new ForbiddenException(
          'Você não tem permissão para visualizar esta anamnese',
        ),
      );
      expect(prisma.anamnesis.findUnique).not.toHaveBeenCalled();
    });

    it("should allow the NAPNE level to read any student's anamnesis", async () => {
      const email = 'other@example.com';
      const request = {
        user: {
          email: 'napne@example.com',
          roles: [LEVELS.PROFISSIONAL_NAPNE],
        },
      } as any;
      const anamnesis = { id: 1, email } as any;
      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(anamnesis);

      const result = await service.findOne(email, request);

      expect(studentsService.findOneOrFail).toHaveBeenCalledWith({ email });
      expect(prisma.anamnesis.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result).toEqual(anamnesis);
    });

    it.each([LEVELS.PROFISSIONAL_SAUDE, LEVELS.PROFESSOR_AEE])(
      "should allow level %s to read any student's anamnesis",
      async (id_level) => {
        const email = 'other@example.com';
        const request = {
          user: { email: 'professional@example.com', roles: [id_level] },
        } as any;
        const anamnesis = { id: 1, email } as any;
        jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(anamnesis);

        const result = await service.findOne(email, request);

        expect(studentsService.findOneOrFail).toHaveBeenCalledWith({ email });
        expect(result).toEqual(anamnesis);
      },
    );

    it.each([LEVELS.ADMIN, LEVELS.PROFISSIONAL_EDUCACAO])(
      "should throw ForbiddenException if level %s views another student's anamnesis",
      async (id_level) => {
        const request = {
          user: { email: 'professional@example.com', roles: [id_level] },
        } as any;

        await expect(
          service.findOne('other@example.com', request),
        ).rejects.toThrow(
          new ForbiddenException(
            'Você não tem permissão para visualizar esta anamnese',
          ),
        );
        expect(prisma.anamnesis.findUnique).not.toHaveBeenCalled();
        expect(studentsService.findOneOrFail).not.toHaveBeenCalled();
      },
    );
  });

  describe('update', () => {
    it('should update an anamnesis when it exists', async () => {
      const email = 'joao@example.com';
      const updateDto = {
        identification: { nome_completo: 'Novo Nome' },
      } as any;
      const existing = { id: 1, email } as any;
      const updated = { ...existing, ...updateDto };

      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(existing);
      jest.spyOn(prisma.anamnesis, 'update').mockResolvedValue(updated);

      const result = await service.update(email, updateDto, AUTHOR);

      expect(prisma.anamnesis.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(prisma.anamnesis.update).toHaveBeenCalledWith({
        where: { email },
        data: updateDto,
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when anamnesis does not exist', async () => {
      const email = 'notfound@example.com';

      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(null);

      await expect(service.update(email, {}, AUTHOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove an anamnesis when it exists', async () => {
      const email = 'joao@example.com';
      const existing = { id: 1, email } as any;

      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(existing);
      jest.spyOn(prisma.anamnesis, 'delete').mockResolvedValue(existing);

      const result = await service.remove(email);

      expect(prisma.anamnesis.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(prisma.anamnesis.delete).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result).toEqual({
        message: `Anamnese com email ${email} foi removida com sucesso`,
      });
    });

    it('should throw NotFoundException when anamnesis does not exist', async () => {
      const email = 'notfound@example.com';

      jest.spyOn(prisma.anamnesis, 'findUnique').mockResolvedValue(null);

      await expect(service.remove(email)).rejects.toThrow(NotFoundException);
    });
  });

  describe('titular estudante', () => {
    // O PATCH devolve o registro inteiro: sem a conferência, seria um caminho
    // de leitura e de alteração da ficha de quem não é estudante.
    it('should not update nor return the record of someone who is not a student', async () => {
      jest
        .spyOn(studentsService, 'findOneOrFail')
        .mockRejectedValue(new NotFoundException('Estudante não encontrado'));

      await expect(
        service.update(
          'profissional@example.com',
          { identification: {} },
          AUTHOR,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(studentsService.findOneOrFail).toHaveBeenCalledWith({
        email: 'profissional@example.com',
      });
      expect(prisma.anamnesis.findUnique).not.toHaveBeenCalled();
      expect(prisma.anamnesis.update).not.toHaveBeenCalled();
    });

    it('should not create an anamnesis nor change the phase of someone who is not a student', async () => {
      jest
        .spyOn(studentsService, 'findOneOrFail')
        .mockRejectedValue(new NotFoundException('Estudante não encontrado'));

      await expect(
        service.create(
          {
            email: 'profissional@example.com',
          } as CreateAnamnesisDto,
          AUTHOR,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.anamnesis.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    // Gravadas juntas: com a fase falhando, a anamnese não fica no banco.
    it('should record the anamnesis and the phase in a single transaction', async () => {
      jest.spyOn(prisma.anamnesis, 'create').mockResolvedValue({
        id: 1,
      } as never);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({} as never);

      const result = await service.create(
        {
          email: 'estudante@example.com',
        } as CreateAnamnesisDto,
        AUTHOR,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'estudante@example.com' },
        data: { id_current_phase: PHASES.ANAMNESE },
      });
      expect(formRevisions.recordCreation).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 1 });
    });

    it('should answer 404 when reading the anamnesis of someone who is not a student', async () => {
      jest
        .spyOn(studentsService, 'findOneOrFail')
        .mockRejectedValue(new NotFoundException('Estudante não encontrado'));
      const request = {
        user: {
          sub: 3,
          roles: [LEVELS.PROFISSIONAL_NAPNE],
          email: 'napne@example.com',
          name: 'NAPNE',
        },
      } as unknown as AuthenticatedRequest;

      await expect(
        service.findOne('profissional@example.com', request),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.anamnesis.findUnique).not.toHaveBeenCalled();
    });

    it('should list only the anamnesis of students', async () => {
      jest
        .spyOn(studentsService, 'findAllEmails')
        .mockResolvedValue(['a@example.com']);
      jest.spyOn(prisma.anamnesis, 'findMany').mockResolvedValue([]);

      await service.findAll();

      expect(prisma.anamnesis.findMany).toHaveBeenCalledWith({
        where: { email: { in: ['a@example.com'] } },
      });
    });
  });

  describe('histórico de versões', () => {
    const email = 'estudante@example.com';
    const existing = {
      id: 1,
      email,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: null,
    };

    it('should record the version 1 when the form is created', async () => {
      jest
        .spyOn(prisma.anamnesis, 'create')
        .mockResolvedValue({ id: 1 } as never);

      await service.create({ email } as any, AUTHOR);

      expect(formRevisions.recordCreation).toHaveBeenCalledWith(
        expect.anything(),
        { formType: 'ANAMNESIS', idStudent: 2 },
        { id: 1 },
        AUTHOR,
      );
    });

    it('should record the edit with the previous and the new content', async () => {
      jest
        .spyOn(prisma.anamnesis, 'findUnique')
        .mockResolvedValue(existing as never);
      jest
        .spyOn(prisma.anamnesis, 'update')
        .mockResolvedValue({ id: 1, novo: true } as never);

      await service.update(email, {}, AUTHOR);

      expect(formRevisions.recordEdit).toHaveBeenCalledWith(
        expect.anything(),
        { formType: 'ANAMNESIS', idStudent: 2 },
        {
          before: existing,
          beforeAt: existing.created_at,
          after: { id: 1, novo: true },
        },
        AUTHOR,
      );
    });

    it('should let the 409 of the version limit through', async () => {
      jest
        .spyOn(prisma.anamnesis, 'findUnique')
        .mockResolvedValue(existing as never);
      jest
        .spyOn(prisma.anamnesis, 'update')
        .mockResolvedValue({ id: 1 } as never);
      formRevisions.recordEdit.mockRejectedValue(
        new ConflictException('limite'),
      );

      await expect(service.update(email, {}, AUTHOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('should delete the history together with the form', async () => {
      jest
        .spyOn(prisma.anamnesis, 'findUnique')
        .mockResolvedValue(existing as never);
      jest
        .spyOn(prisma.anamnesis, 'delete')
        .mockResolvedValue(existing as never);

      await service.remove(email);

      expect(formRevisions.removeAll).toHaveBeenCalledWith(expect.anything(), {
        formType: 'ANAMNESIS',
        idStudent: 2,
      });
    });
  });
});
