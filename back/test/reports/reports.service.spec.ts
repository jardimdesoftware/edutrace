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

  const mockCaseStudy = {
    identification: { grade: '3º ano', age: 17, date: '2026-10-17' },
    aee_opinion: { opinion: 'Parecer', date: '2026-10-17' },
    author: { full_name: 'Profissional NAPNE' },
    student: { course: 'Informática' },
  };

  const mockAeePlans = [
    {
      semester: '2026.2',
      basis: 'Embasamento',
      has_diagnosis: true,
      author: { full_name: 'Profissional NAPNE' },
      student: { course: 'Informática' },
    },
    {
      semester: '2026.1',
      basis: 'Embasamento anterior',
      has_diagnosis: false,
      author: null,
      student: { course: 'Informática' },
    },
  ];

  const aeePlanSelect = {
    semester: true,
    identification: true,
    basis: true,
    has_diagnosis: true,
    supports: true,
    purpose: true,
    objectives: true,
    evaluation_procedures: true,
    author: { select: { full_name: true } },
    student: { select: { course: true } },
  };

  const caseStudySelect = {
    identification: true,
    general_info: true,
    school_history: true,
    pedagogical_aspects: true,
    behavioral_social: true,
    potentialities_interests: true,
    barriers: true,
    resources_strategies: true,
    pei_recommendations: true,
    aee_opinion: true,
    author: { select: { full_name: true } },
    student: { select: { course: true } },
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
            caseStudy: { findUnique: jest.fn() },
            aeePlan: { findMany: jest.fn().mockResolvedValue([]) },
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
    it('should return the screening, the PEI, the case study and the PAEE with only the report fields', async () => {
      jest
        .spyOn(prisma.screening, 'findUnique')
        .mockResolvedValue(mockScreening as never);
      jest
        .spyOn(prisma.plansEducation, 'findUnique')
        .mockResolvedValue(mockPlansEducation as never);
      jest
        .spyOn(prisma.caseStudy, 'findUnique')
        .mockResolvedValue(mockCaseStudy as never);
      jest
        .spyOn(prisma.aeePlan, 'findMany')
        .mockResolvedValue(mockAeePlans as never);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: mockScreening,
        plansEducation: mockPlansEducation,
        caseStudy: mockCaseStudy,
        aeePlans: mockAeePlans,
      });
      expect(prisma.screening.findUnique).toHaveBeenCalledWith({
        where: { email },
        select: screeningSelect,
      });
      expect(prisma.plansEducation.findUnique).toHaveBeenCalledWith({
        where: { student_email: email },
        select: plansEducationSelect,
      });
      expect(prisma.caseStudy.findUnique).toHaveBeenCalledWith({
        where: { id_student: 2 },
        select: caseStudySelect,
      });
      expect(prisma.aeePlan.findMany).toHaveBeenCalledWith({
        where: { id_student: 2 },
        orderBy: { semester: 'desc' },
        select: aeePlanSelect,
      });
    });

    it('should return the PAEE with the name of the author and the course of the student, and nothing else of them', async () => {
      await service.findOne(email);

      const { select } = (prisma.aeePlan.findMany as jest.Mock).mock
        .calls[0][0] as { select: Record<string, unknown> };
      expect(select.author).toEqual({ select: { full_name: true } });
      expect(select.student).toEqual({ select: { course: true } });
      expect(select).not.toHaveProperty('created_at');
      expect(select).not.toHaveProperty('id');
    });

    it('should return the PAEE from the newest semester to the oldest', async () => {
      await service.findOne(email);

      const { orderBy } = (prisma.aeePlan.findMany as jest.Mock).mock
        .calls[0][0] as { orderBy: unknown };
      expect(orderBy).toEqual({ semester: 'desc' });
    });

    it('should return an empty PAEE list for a student without plans', async () => {
      const result = await service.findOne(email);

      expect(result.aeePlans).toEqual([]);
    });

    it('should return the PAEE of a student without screening, PEI or case study', async () => {
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.caseStudy, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(prisma.aeePlan, 'findMany')
        .mockResolvedValue(mockAeePlans as never);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: null,
        plansEducation: null,
        caseStudy: null,
        aeePlans: mockAeePlans,
      });
    });

    it('should return the case study with the name of the author and the course of the student, and nothing else of them', async () => {
      jest
        .spyOn(prisma.caseStudy, 'findUnique')
        .mockResolvedValue(mockCaseStudy as never);

      await service.findOne(email);

      const { select } = (prisma.caseStudy.findUnique as jest.Mock).mock
        .calls[0][0] as { select: Record<string, unknown> };
      expect(select.author).toEqual({ select: { full_name: true } });
      expect(select.student).toEqual({ select: { course: true } });
      expect(select).not.toHaveProperty('created_at');
      expect(select).not.toHaveProperty('id');
    });

    it('should return the screening of a student without anamnesis, PEI or case study', async () => {
      jest
        .spyOn(prisma.screening, 'findUnique')
        .mockResolvedValue(mockScreening as never);
      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.caseStudy, 'findUnique').mockResolvedValue(null);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: mockScreening,
        plansEducation: null,
        caseStudy: null,
        aeePlans: [],
      });
    });

    it('should return the case study of a student without screening or PEI', async () => {
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(prisma.caseStudy, 'findUnique')
        .mockResolvedValue(mockCaseStudy as never);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: null,
        plansEducation: null,
        caseStudy: mockCaseStudy,
        aeePlans: [],
      });
    });

    it('should return the three sections as null and the PAEE as an empty list when the student has no records', async () => {
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.plansEducation, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.caseStudy, 'findUnique').mockResolvedValue(null);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: null,
        plansEducation: null,
        caseStudy: null,
        aeePlans: [],
      });
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
      expect(prisma.caseStudy.findUnique).not.toHaveBeenCalled();
      expect(prisma.aeePlan.findMany).not.toHaveBeenCalled();
    });
  });
});
