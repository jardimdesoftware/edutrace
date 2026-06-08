import { Test, TestingModule } from '@nestjs/testing';
import { AnamnesisController } from 'src/anamnesis/anamnesis.controller';
import { AnamnesisService } from 'src/anamnesis/anamnesis.service';
import { CreateAnamnesisDto } from 'src/anamnesis/dto/create-anamnesis.dto';

describe('AnamnesisController', () => {
  let controller: AnamnesisController;
  let service: AnamnesisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnamnesisController],
      providers: [
        {
          provide: AnamnesisService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AnamnesisController>(AnamnesisController);
    service = module.get<AnamnesisService>(AnamnesisService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an anamnesis', async () => {
      const createAnamnesisDto: CreateAnamnesisDto = {
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
      const result = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        ...createAnamnesisDto,
      };
      jest.spyOn(service, 'create').mockResolvedValue(result);

      expect(await controller.create(createAnamnesisDto)).toEqual(result);
      expect(service.create).toHaveBeenCalledWith(createAnamnesisDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of anamnesis', async () => {
      const result = [
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
      jest.spyOn(service, 'findAll').mockResolvedValue(result);

      expect(await controller.findAll()).toEqual(result);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single anamnesis by email', async () => {
      const email = 'test@example.com';
      const result = {
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
      jest.spyOn(service, 'findOne').mockResolvedValue(result);

      expect(await controller.findOne(email)).toEqual(result);
      expect(service.findOne).toHaveBeenCalledWith(email);
    });
  });

  describe('update', () => {
    it('should update an anamnesis by email', async () => {
      const email = 'joao@example.com';
      const updateDto = { identification: { nome_completo: 'Novo Nome' } } as any;
      const result = { id: 1, email, ...updateDto } as any;

      jest.spyOn(service, 'update').mockResolvedValue(result);

      expect(await controller.update(email, updateDto)).toEqual(result);
      expect(service.update).toHaveBeenCalledWith(email, updateDto);
    });
  });

  describe('remove', () => {
    it('should remove an anamnesis by email', async () => {
      const email = 'joao@example.com';
      const result = { message: `Anamnese com email ${email} foi removida com sucesso` };

      jest.spyOn(service, 'remove').mockResolvedValue(result as any);

      expect(await controller.remove(email)).toEqual(result);
      expect(service.remove).toHaveBeenCalledWith(email);
    });
  });
});
