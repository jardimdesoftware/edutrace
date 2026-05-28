import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { ScreeningsService } from 'src/screenings/screenings.service';

describe('ScreeningsService', () => {
  let service: ScreeningsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreeningsService,
        {
          provide: PrismaService,
          useValue: {
            screening: {
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

    service = module.get<ScreeningsService>(ScreeningsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a screening', async () => {
      const createScreeningDto = {
        full_name: 'João Silva',
        email: 'joao@example.com',
        report: 'Link do Relatório Médico',
        specific_need: {
          deficiencia_fisica: true,
          deficiencia_auditiva: true,
          baixa_visao: true,
          cegueira: true,
          surdocegueira: true,
          transtornos_globais_de_desenvolvimento: true,
          superdotacao: true,
          disturbio_de_aprendizagem: true,
          outros: 'Algum outro tipo',
        },
        special_service: true,
        physical_disability: {
          necessita_de_transcritor: true,
          acesso_para_cadeirante: true,
          outros: 'Algum outro tipo',
        },
        visual_impairment: {
          necessita_de_braille: true,
          material_com_fonte_aumentada: true,
          necessita_de_transcritor: true,
          outros: 'Algum outro tipo',
        },
        hearing_impairment: {
          necessita_de_interprete_de_lingua_de_sinais: true,
          necessita_de_interprete_oralizador: true,
          outros: 'Algum outro tipo',
        },
        global_disorder: {
          necessita_de_ledor: true,
          necessita_de_transcritor: true,
          outros: 'Algum outro tipo',
        },
        other_disabilities: 'Descrição de outras deficiências não listadas',
      };
      const createdScreening = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        ...createScreeningDto,
      };

      jest
        .spyOn(prisma.screening, 'create')
        .mockResolvedValue(createdScreening);

      const result = await service.create(createScreeningDto);

      expect(prisma.screening.create).toHaveBeenCalledWith({
        data: createScreeningDto,
      });
      expect(result).toEqual(createdScreening);
    });
  });

  describe('findAll', () => {
    it('should return an array of screenings', async () => {
      const screeningsList = [
        {
          id: 1,
          full_name: 'João Silva',
          email: 'joao@example.com',
          report: 'Link do Relatório Médico',
          specific_need: {
            deficiencia_fisica: true,
            deficiencia_auditiva: true,
            baixa_visao: true,
            cegueira: true,
            surdocegueira: true,
            transtornos_globais_de_desenvolvimento: true,
            superdotacao: true,
            disturbio_de_aprendizagem: true,
            outros: 'Algum outro tipo',
          },
          special_service: true,
          physical_disability: {
            necessita_de_transcritor: true,
            acesso_para_cadeirante: true,
            outros: 'Algum outro tipo',
          },
          visual_impairment: {
            necessita_de_braille: true,
            material_com_fonte_aumentada: true,
            necessita_de_transcritor: true,
            outros: 'Algum outro tipo',
          },
          hearing_impairment: {
            necessita_de_interprete_de_lingua_de_sinais: true,
            necessita_de_interprete_oralizador: true,
            outros: 'Algum outro tipo',
          },
          global_disorder: {
            necessita_de_ledor: true,
            necessita_de_transcritor: true,
            outros: 'Algum outro tipo',
          },
          other_disabilities: 'Descrição de outras deficiências não listadas',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
        {
          id: 2,
          full_name: 'João Silva',
          email: 'joao@example.com',
          report: 'Link do Relatório Médico',
          specific_need: {
            deficiencia_fisica: true,
            deficiencia_auditiva: true,
            baixa_visao: true,
            cegueira: true,
            surdocegueira: true,
            transtornos_globais_de_desenvolvimento: true,
            superdotacao: true,
            disturbio_de_aprendizagem: true,
            outros: 'Algum outro tipo',
          },
          special_service: true,
          physical_disability: {
            necessita_de_transcritor: true,
            acesso_para_cadeirante: true,
            outros: 'Algum outro tipo',
          },
          visual_impairment: {
            necessita_de_braille: true,
            material_com_fonte_aumentada: true,
            necessita_de_transcritor: true,
            outros: 'Algum outro tipo',
          },
          hearing_impairment: {
            necessita_de_interprete_de_lingua_de_sinais: true,
            necessita_de_interprete_oralizador: true,
            outros: 'Algum outro tipo',
          },
          global_disorder: {
            necessita_de_ledor: true,
            necessita_de_transcritor: true,
            outros: 'Algum outro tipo',
          },
          other_disabilities: 'Descrição de outras deficiências não listadas',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];
      jest
        .spyOn(prisma.screening, 'findMany')
        .mockResolvedValue(screeningsList);

      const result = await service.findAll();

      expect(prisma.screening.findMany).toHaveBeenCalled();
      expect(result).toEqual(screeningsList);
    });
  });

  describe('findOne', () => {
    it('should return a single screening by email', async () => {
      const email = 'test@example.com';
      const screening = {
        id: 1,
        full_name: 'João Silva',
        email: 'joao@example.com',
        report: 'Link do Relatório Médico',
        specific_need: {
          deficiencia_fisica: true,
          deficiencia_auditiva: true,
          baixa_visao: true,
          cegueira: true,
          surdocegueira: true,
          transtornos_globais_de_desenvolvimento: true,
          superdotacao: true,
          disturbio_de_aprendizagem: true,
          outros: 'Algum outro tipo',
        },
        special_service: true,
        physical_disability: {
          necessita_de_transcritor: true,
          acesso_para_cadeirante: true,
          outros: 'Algum outro tipo',
        },
        visual_impairment: {
          necessita_de_braille: true,
          material_com_fonte_aumentada: true,
          necessita_de_transcritor: true,
          outros: 'Algum outro tipo',
        },
        hearing_impairment: {
          necessita_de_interprete_de_lingua_de_sinais: true,
          necessita_de_interprete_oralizador: true,
          outros: 'Algum outro tipo',
        },
        global_disorder: {
          necessita_de_ledor: true,
          necessita_de_transcritor: true,
          outros: 'Algum outro tipo',
        },
        other_disabilities: 'Descrição de outras deficiências não listadas',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(screening);

      const result = await service.findOne(email);

      expect(prisma.screening.findUnique).toHaveBeenCalledWith({
        where: { email: email },
      });
      expect(result).toEqual(screening);
    });
  });

  describe('update', () => {
    it('should update a screening when it exists', async () => {
      const email = 'joao@example.com';
      const updateDto = { full_name: 'João Atualizado' };
      const existingScreening = { id: 1, email, full_name: 'João Silva' } as any;
      const updatedScreening = { ...existingScreening, ...updateDto };

      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(existingScreening);
      jest.spyOn(prisma.screening, 'update').mockResolvedValue(updatedScreening);

      const result = await service.update(email, updateDto);

      expect(prisma.screening.findUnique).toHaveBeenCalledWith({ where: { email } });
      expect(prisma.screening.update).toHaveBeenCalledWith({
        where: { email },
        data: updateDto,
      });
      expect(result).toEqual(updatedScreening);
    });

    it('should throw NotFoundException when screening does not exist', async () => {
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(null);

      await expect(service.update('notfound@example.com', {})).rejects.toThrow(
        'Triagem com email notfound@example.com não encontrada',
      );
      expect(prisma.screening.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a screening when it exists', async () => {
      const email = 'joao@example.com';
      const existingScreening = { id: 1, email } as any;

      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(existingScreening);
      jest.spyOn(prisma.screening, 'delete').mockResolvedValue(existingScreening);

      const result = await service.remove(email);

      expect(prisma.screening.delete).toHaveBeenCalledWith({ where: { email } });
      expect(result).toEqual({ message: `Triagem com email ${email} foi removida com sucesso` });
    });

    it('should throw NotFoundException when screening does not exist', async () => {
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(null);

      await expect(service.remove('notfound@example.com')).rejects.toThrow(
        'Triagem com email notfound@example.com não encontrada',
      );
      expect(prisma.screening.delete).not.toHaveBeenCalled();
    });
  });
});
