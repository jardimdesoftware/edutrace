import { NotFoundException } from '@nestjs/common';
import { StudentsService } from 'src/students/students.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { ReportsService } from 'src/reports/reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;
  let studentsService: StudentsService;

  const email = 'estudante@example.com';

  const mockScreening = {
    report: 'Laudo',
    specific_need: { baixa_visao: true, outros: '' },
    physical_disability: {},
    visual_impairment: {},
    hearing_impairment: {},
    global_disorder: {},
    other_disabilities: null,
  };

  const mockPlansEducation = {
    professor_name: 'Professora',
    professor_email: 'professora@example.com',
    objectives: 'Objetivos',
  };

  const screeningSelect = {
    report: true,
    specific_need: true,
    physical_disability: true,
    visual_impairment: true,
    hearing_impairment: true,
    global_disorder: true,
    other_disabilities: true,
  };

  const plansEducationSelect = {
    professor_name: true,
    professor_email: true,
    academic_semester: true,
    service_modality: true,
    support_service: true,
    skills: true,
    resource_equipment_used: true,
    resource_equipment_needs: true,
    curriculum_accessibility: true,
    school_content: true,
    activities_to_be_developed: true,
    objectives: true,
    work_methodology: true,
    materials_used: true,
    evaluation_criteria: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: StudentsService,
          useValue: {
            findOneOrFail: jest.fn().mockResolvedValue({ id: 2, email }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            screening: { findUnique: jest.fn() },
            plansEducation: { findUnique: jest.fn() },
            anamnesis: { findUnique: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);
    studentsService = module.get<StudentsService>(StudentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return the screening and the PEI with only the report fields', async () => {
      jest
        .spyOn(prisma.screening, 'findUnique')
        .mockResolvedValue(mockScreening as never);
      jest
        .spyOn(prisma.plansEducation, 'findUnique')
        .mockResolvedValue(mockPlansEducation as never);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: mockScreening,
        plansEducation: mockPlansEducation,
      });
      expect(prisma.screening.findUnique).toHaveBeenCalledWith({
        where: { email },
        select: screeningSelect,
      });
      expect(prisma.plansEducation.findUnique).toHaveBeenCalledWith({
        where: { student_email: email },
        select: plansEducationSelect,
      });
    });

    it('should return the screening of a student without anamnesis or PEI', async () => {
      jest
        .spyOn(prisma.screening, 'findUnique')
        .mockResolvedValue(mockScreening as never);
      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(null);

      const result = await service.findOne(email);

      expect(result).toEqual({ screening: mockScreening, plansEducation: null });
    });

    it('should return both sections as null when the student has no records', async () => {
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(null);

      const result = await service.findOne(email);

      expect(result).toEqual({ screening: null, plansEducation: null });
    });

    it('should not read the anamnesis', async () => {
      await service.findOne(email);

      expect(prisma.anamnesis.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('titular estudante', () => {
    it('should answer 404 for someone who is not a student without querying', async () => {
      jest
        .spyOn(studentsService, 'findOneOrFail')
        .mockRejectedValue(new NotFoundException('Estudante não encontrado'));

      await expect(service.findOne('profissional@example.com')).rejects.toThrow(
        NotFoundException,
      );
      expect(studentsService.findOneOrFail).toHaveBeenCalledWith({
        email: 'profissional@example.com',
      });
      expect(prisma.screening.findUnique).not.toHaveBeenCalled();
      expect(prisma.plansEducation.findUnique).not.toHaveBeenCalled();
    });
  });
});
