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

  const mockPeiEntries = [
    {
      semester: '2026.2',
      subject: 'Física',
      adapted_objectives: 'Objetivos',
      syllabus_adaptations: [
        { syllabus_content: 'Cinemática', adaptation: 'Material concreto' },
      ],
      author: { full_name: 'Professora Ana' },
    },
    {
      semester: '2026.2',
      subject: 'Matemática',
      adapted_objectives: 'Outros objetivos',
      syllabus_adaptations: [],
      author: null,
    },
  ];

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

  const peiEntrySelect = {
    semester: true,
    subject: true,
    adapted_objectives: true,
    prioritized_contents: true,
    syllabus_adaptations: true,
    adapted_methodologies: true,
    adapted_assessments: true,
    adapted_resources: true,
    general_notes: true,
    semester_progress: true,
    semester_difficulties: true,
    next_semester_notes: true,
    individual_sessions: true,
    author: { select: { full_name: true } },
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
            peiEntry: { findMany: jest.fn().mockResolvedValue([]) },
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
    it('should return the screening, the PEI entries, the case study and the PAEE with only the report fields', async () => {
      jest
        .spyOn(prisma.screening, 'findUnique')
        .mockResolvedValue(mockScreening as never);
      jest
        .spyOn(prisma.peiEntry, 'findMany')
        .mockResolvedValue(mockPeiEntries as never);
      jest
        .spyOn(prisma.caseStudy, 'findUnique')
        .mockResolvedValue(mockCaseStudy as never);
      jest
        .spyOn(prisma.aeePlan, 'findMany')
        .mockResolvedValue(mockAeePlans as never);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: mockScreening,
        peiEntries: mockPeiEntries,
        caseStudy: mockCaseStudy,
        aeePlans: mockAeePlans,
      });
      expect(prisma.screening.findUnique).toHaveBeenCalledWith({
        where: { email },
        select: screeningSelect,
      });
      expect(prisma.peiEntry.findMany).toHaveBeenCalledWith({
        where: { id_student: 2, deleted_at: null },
        orderBy: [{ semester: 'desc' }, { subject: 'asc' }],
        select: peiEntrySelect,
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

    it('should return only the active PEI entries of the student', async () => {
      await service.findOne(email);

      const { where } = (prisma.peiEntry.findMany as jest.Mock).mock
        .calls[0][0] as { where: unknown };
      expect(where).toEqual({ id_student: 2, deleted_at: null });
    });

    it('should return the PEI entries from the newest semester to the oldest and then by subject', async () => {
      await service.findOne(email);

      const { orderBy } = (prisma.peiEntry.findMany as jest.Mock).mock
        .calls[0][0] as { orderBy: unknown };
      expect(orderBy).toEqual([{ semester: 'desc' }, { subject: 'asc' }]);
    });

    // O select explícito é o que impede o relatório de levar o id, o autor por
    // id, o deleted_at, o estudante ou qualquer dado do User além do nome.
    it('should return the PEI entries with the name of the author, and none of id, id_author, dates, id_student nor deleted_at', async () => {
      await service.findOne(email);

      const { select } = (prisma.peiEntry.findMany as jest.Mock).mock
        .calls[0][0] as { select: Record<string, unknown> };
      expect(select.author).toEqual({ select: { full_name: true } });
      for (const hidden of [
        'id',
        'id_author',
        'id_student',
        'deleted_at',
        'created_at',
        'updated_at',
        'student',
      ]) {
        expect(select).not.toHaveProperty(hidden);
      }
      expect(Object.keys(select).sort()).toEqual(
        Object.keys(peiEntrySelect).sort(),
      );
    });

    it('should return an empty PEI list for a student without entries', async () => {
      const result = await service.findOne(email);

      expect(result.peiEntries).toEqual([]);
      expect(result).not.toHaveProperty('plansEducation');
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

    it('should return the PAEE of a student without screening, PEI entries or case study', async () => {
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.caseStudy, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(prisma.aeePlan, 'findMany')
        .mockResolvedValue(mockAeePlans as never);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: null,
        peiEntries: [],
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

    it('should return the screening of a student without anamnesis, PEI entries or case study', async () => {
      jest
        .spyOn(prisma.screening, 'findUnique')
        .mockResolvedValue(mockScreening as never);
      jest.spyOn(prisma.caseStudy, 'findUnique').mockResolvedValue(null);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: mockScreening,
        peiEntries: [],
        caseStudy: null,
        aeePlans: [],
      });
    });

    it('should return the case study of a student without screening or PEI entries', async () => {
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(prisma.caseStudy, 'findUnique')
        .mockResolvedValue(mockCaseStudy as never);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: null,
        peiEntries: [],
        caseStudy: mockCaseStudy,
        aeePlans: [],
      });
    });

    it('should return the screening and the case study as null and both lists as empty when the student has no records', async () => {
      jest.spyOn(prisma.screening, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.caseStudy, 'findUnique').mockResolvedValue(null);

      const result = await service.findOne(email);

      expect(result).toEqual({
        screening: null,
        peiEntries: [],
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
      expect(prisma.peiEntry.findMany).not.toHaveBeenCalled();
      expect(prisma.caseStudy.findUnique).not.toHaveBeenCalled();
      expect(prisma.aeePlan.findMany).not.toHaveBeenCalled();
    });
  });
});
