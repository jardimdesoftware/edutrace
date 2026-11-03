import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS } from 'src/constants';
import {
  PUBLIC_USER_SELECT,
  USER_WITH_MANAGER_CONTACT_SELECT,
} from 'src/users/users.select';
import { StudentsService } from 'src/students/students.service';

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should not select the password nor the recovery fields', () => {
      const camposSensiveis = [
        'password',
        'password_reset_token',
        'password_reset_expires',
        'password_reset_attempts',
        'failed_login_attempts',
        'locked_until',
        'login_lock_count',
      ];

      camposSensiveis.forEach((campo) =>
        expect(PUBLIC_USER_SELECT).not.toHaveProperty(campo),
      );
    });

    it('should return an array of students', async () => {
      const studentsList = [
        {
          id: 1,
          full_name: 'Luizin',
          cpf: '12345678910',
          email: 'luizin@hotmail.com',
          affliation: 'Filiação',
          pedagogical_manager: { id: 9, full_name: 'Ana' },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          roles: [2],
          id_current_phase: 1,
          current_phase: { id: 1, name: 'Triagem' },
        },
        {
          id: 2,
          full_name: 'Luizin',
          cpf: '12345678910',
          email: 'luizin@hotmail.com',
          affliation: 'Filiação',
          pedagogical_manager: { id: 9, full_name: 'Ana' },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          roles: [2],
          id_current_phase: 1,
          current_phase: { id: 1, name: 'Triagem' },
        },
      ];
      jest
        .spyOn(prisma.user, 'findMany')
        .mockResolvedValue(studentsList as never);

      const result = await service.findAll([LEVELS.PROFISSIONAL_SAUDE]);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
        },
        select: PUBLIC_USER_SELECT,
      });
      expect(result).toEqual(studentsList);
    });

    it.each([LEVELS.PROFISSIONAL_NAPNE])(
      'should select the contact of the external manager for the level %s',
      async (level) => {
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as never);

        await service.findAll([level]);

        expect(prisma.user.findMany).toHaveBeenCalledWith({
          where: { roles: { has: LEVELS.ALUNO_ESTUDANTE } },
          select: USER_WITH_MANAGER_CONTACT_SELECT,
        });
      },
    );

    it.each([
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.ALUNO_ESTUDANTE,
      99,
    ])(
      'should not select the contact of the external manager for the level %s',
      async (level) => {
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as never);

        await service.findAll([level]);

        expect(prisma.user.findMany).toHaveBeenCalledWith({
          where: { roles: { has: LEVELS.ALUNO_ESTUDANTE } },
          select: PUBLIC_USER_SELECT,
        });
      },
    );
  });

  describe('findOne', () => {
    it('should search the email only among students, without sensitive fields', async () => {
      const student = {
        id: 1,
        full_name: 'Luizin',
        cpf: '12345678910',
        email: 'luizin@hotmail.com',
        roles: [LEVELS.ALUNO_ESTUDANTE],
      };
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(student as never);

      const result = await service.findOne(
        'luizin@hotmail.com',
        [LEVELS.PROFISSIONAL_SAUDE],
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'luizin@hotmail.com',
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
        },
        select: PUBLIC_USER_SELECT,
      });
      expect(result).toEqual(student);
    });

    it.each([
      [LEVELS.ADMIN, PUBLIC_USER_SELECT],
      [LEVELS.PROFISSIONAL_NAPNE, USER_WITH_MANAGER_CONTACT_SELECT],
      [LEVELS.PROFISSIONAL_EDUCACAO, PUBLIC_USER_SELECT],
      [LEVELS.PROFISSIONAL_SAUDE, PUBLIC_USER_SELECT],
      [99, PUBLIC_USER_SELECT],
    ])(
      'should choose the select of the level %s by the level of who asks',
      async (level, select) => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

        await service.findOne('luizin@hotmail.com', [level]);

        expect(prisma.user.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({ select }),
        );
      },
    );

    it('should return null for the email of an administrator or a professional', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

      await expect(
        service.findOne('admin@edutrace.com', [LEVELS.ADMIN]),
      ).resolves.toBeNull();
    });
  });

  describe('findOneOrFail', () => {
    it.each([{ email: 'estudante@example.com' }, { id: 2 }])(
      'should look the student up by %p filtering by the student level',
      async (where) => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({
          id: 2,
          email: 'estudante@example.com',
        } as never);

        await expect(service.findOneOrFail(where)).resolves.toEqual({
          id: 2,
          email: 'estudante@example.com',
        });
        expect(prisma.user.findFirst).toHaveBeenCalledWith({
          where: { ...where, roles: { has: LEVELS.ALUNO_ESTUDANTE } },
          select: { id: true, email: true },
        });
      },
    );

    // O filtro de nível fica na consulta: administrador, profissional e
    // e-mail sem conta caem no mesmo 404.
    it('should throw NotFoundException when no student matches', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

      await expect(
        service.findOneOrFail({ email: 'profissional@example.com' }),
      ).rejects.toThrow(new NotFoundException('Estudante não encontrado'));
    });
  });

  describe('findAllEmails', () => {
    it('should return the e-mails of the students', async () => {
      jest
        .spyOn(prisma.user, 'findMany')
        .mockResolvedValue([
          { email: 'a@example.com' },
          { email: 'b@example.com' },
        ] as never);

      await expect(service.findAllEmails()).resolves.toEqual([
        'a@example.com',
        'b@example.com',
      ]);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { roles: { has: LEVELS.ALUNO_ESTUDANTE } },
        select: { email: true },
      });
    });
  });
});
